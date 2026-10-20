// Supabase Edge Function: notify-new-product
//
// Called by a Database Webhook (see supabase/migration_004_product_notify.sql
// setup instructions) every time a new row is inserted into `products`.
// Sends the shop owner a short email via Resend so they get a confirmation
// whenever a product is added — including if it's ever added by someone
// other than themselves.
//
// This function is deliberately "fire and forget" from the database's
// perspective: if the email fails to send, the product insert itself is
// NOT rolled back (the webhook is async and post-commit) — a notification
// hiccup should never block someone from actually adding a product.
//
// Required secrets (set via `supabase secrets set`, see setup instructions):
//   RESEND_API_KEY   — your Resend API key
//   NOTIFY_TO_EMAIL  — who to notify. Supports multiple recipients as a
//                       comma-separated list, e.g.
//                       "you@example.com,partner@example.com"
//   NOTIFY_FROM_EMAIL — the "from" address Resend sends as (must be a
//                        domain verified in Resend, or their shared
//                        onboarding@resend.dev sender for testing)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface ProductWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: string;
    name: string;
    price: number;
    category: string;
    stock: number;
    image: string;
  } | null;
}

Deno.serve(async (req: Request) => {
  try {
    const payload: ProductWebhookPayload = await req.json();

    // Guard: only act on actual inserts into products, in case this
    // function's webhook is ever reused/misconfigured for other events.
    if (payload.type !== "INSERT" || payload.table !== "products" || !payload.record) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const toEmailRaw = Deno.env.get("NOTIFY_TO_EMAIL");
    const fromEmail = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "onboarding@resend.dev";

    // Supports one or many recipients: "a@x.com" or "a@x.com,b@x.com".
    const toEmails = toEmailRaw
      ?.split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (!resendApiKey || !toEmails || toEmails.length === 0) {
      console.error("notify-new-product: missing RESEND_API_KEY or NOTIFY_TO_EMAIL secret");
      // Return 200 so Supabase doesn't retry forever on a config error —
      // this needs a human to fix the secret, not a retry.
      return new Response(JSON.stringify({ error: "not configured" }), { status: 200 });
    }

    const product = payload.record;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Heart of Wool <${fromEmail}>`,
        to: toEmails,
        subject: `New product added: ${product.name}`,
        html: `
          <p>A new product was just added to Heart of Wool:</p>
          <table cellpadding="6" style="border-collapse: collapse;">
            <tr><td><strong>Name</strong></td><td>${escapeHtml(product.name)}</td></tr>
            <tr><td><strong>Category</strong></td><td>${escapeHtml(product.category)}</td></tr>
            <tr><td><strong>Price</strong></td><td>₹${product.price}</td></tr>
            <tr><td><strong>Stock</strong></td><td>${product.stock}</td></tr>
            <tr><td><strong>Product ID</strong></td><td>${escapeHtml(product.id)}</td></tr>
          </table>
          ${product.image ? `<p><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" width="200" /></p>` : ""}
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("notify-new-product: Resend API error", emailResponse.status, errorText);
      return new Response(JSON.stringify({ error: "email send failed" }), { status: 200 });
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200 });
  } catch (err) {
    console.error("notify-new-product: unexpected error", err);
    return new Response(JSON.stringify({ error: "unexpected error" }), { status: 200 });
  }
});

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
