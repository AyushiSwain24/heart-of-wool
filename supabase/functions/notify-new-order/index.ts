// Supabase Edge Function: notify-new-order
//
// Called by a Database Webhook (see supabase/migration_004_order_notify.sql
// setup instructions) every time a new row is inserted into `orders` — i.e.
// whenever a customer places an order via checkout. Sends the shop owner a
// short email via Resend so a new order never gets missed.
//
// This function is deliberately "fire and forget" from the database's
// perspective: if the email fails to send, the order itself is NOT rolled
// back (the webhook is async and post-commit, and place_order has already
// committed by the time this runs) — a notification hiccup should never
// block a customer from checking out.
//
// Required secrets (set via `supabase secrets set`, see setup instructions):
//   RESEND_API_KEY   — your Resend API key
//   NOTIFY_TO_EMAIL  — who to notify. Supports multiple recipients as a
//                       comma-separated list, e.g.
//                       "you@example.com,partner@example.com"
//   NOTIFY_FROM_EMAIL — the "from" address Resend sends as (must be a
//                        domain verified in Resend, or their shared
//                        onboarding@resend.dev sender — which only delivers
//                        to your own Resend signup email until you verify
//                        a domain, see setup instructions)
//   SITE_URL          — your live site's base URL, e.g.
//                        https://heart-of-wool.vercel.app (no trailing
//                        slash). Used to build the "View in Admin" button
//                        link — the email still sends fine without this
//                        set, it just falls back to a relative /admin
//                        link that won't be clickable from an email client.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface OrderWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: string;
    order_number: string;
    customer_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    pincode: string;
    payment_method: "upi" | "cod";
    payment_confirmed: boolean;
    status: string;
    notes: string | null;
    subtotal: number;
    created_at: string;
  } | null;
}

Deno.serve(async (req: Request) => {
  try {
    const payload: OrderWebhookPayload = await req.json();

    // Guard: only act on actual inserts into orders, in case this
    // function's webhook is ever reused/misconfigured for other events.
    if (payload.type !== "INSERT" || payload.table !== "orders" || !payload.record) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const toEmailRaw = Deno.env.get("NOTIFY_TO_EMAIL");
    const fromEmail = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "onboarding@resend.dev";
    const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

    // Supports one or many recipients: "a@x.com" or "a@x.com,b@x.com".
    const toEmails = toEmailRaw
      ?.split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (!resendApiKey || !toEmails || toEmails.length === 0) {
      console.error("notify-new-order: missing RESEND_API_KEY or NOTIFY_TO_EMAIL secret");
      // Return 200 so Supabase doesn't retry forever on a config error —
      // this needs a human to fix the secret, not a retry.
      return new Response(JSON.stringify({ error: "not configured" }), { status: 200 });
    }

    const order = payload.record;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Heart of Wool <${fromEmail}>`,
        to: toEmails,
        subject: `🧶 New order ${order.order_number} — ₹${order.subtotal}`,
        html: buildOrderEmailHtml(order, siteUrl),
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("notify-new-order: Resend API error", emailResponse.status, errorText);
      return new Response(JSON.stringify({ error: "email send failed" }), { status: 200 });
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200 });
  } catch (err) {
    console.error("notify-new-order: unexpected error", err);
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

type OrderRecord = {
  order_number: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  payment_method: "upi" | "cod";
  payment_confirmed: boolean;
  notes: string | null;
  subtotal: number;
};

/**
 * Branded HTML email, matching the storefront's cream/olive/pink look
 * (see src/index.css) so this reads as "Heart of Wool" at a glance rather
 * than a generic system alert. Built as inline-styled table-based HTML
 * (not CSS classes / flexbox) since that's what actually renders
 * consistently across email clients like Gmail and Outlook.
 */
function buildOrderEmailHtml(order: OrderRecord, siteUrl: string): string {
  const isUpi = order.payment_method === "upi";
  const paymentLabel = isUpi ? "UPI" : "Cash on Delivery";
  const paymentBadgeColor = order.payment_confirmed ? "#e7f5ea" : "#fdf0e0";
  const paymentBadgeText = order.payment_confirmed ? "#2f7a3e" : "#a8620a";
  const paymentBadgeLabel = order.payment_confirmed
    ? "Payment confirmed"
    : isUpi
      ? "Awaiting payment confirmation"
      : "Pay on delivery";

  // Deep-links straight to this order in /admin (see Admin.tsx's ?order=
  // handling) so opening the email and tapping the button lands you right
  // on the order, pre-searched and highlighted — no extra clicks needed.
  const adminUrl = siteUrl
    ? `${siteUrl}/admin?order=${encodeURIComponent(order.order_number)}`
    : `/admin?order=${encodeURIComponent(order.order_number)}`;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding: 9px 0; font-size: 13px; color: #7a7460; white-space: nowrap; vertical-align: top;">${label}</td>
      <td style="padding: 9px 0 9px 16px; font-size: 14px; color: #4a4635; font-weight: 500;">${value}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; background-color: #f7ead4; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7ead4; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width: 480px;" cellpadding="0" cellspacing="0">

            <!-- Header -->
            <tr>
              <td align="center" style="padding-bottom: 20px;">
                <span style="font-size: 26px;">🧶</span>
                <div style="font-family: Georgia, 'Playfair Display', serif; font-size: 22px; color: #4a4635; margin-top: 4px;">
                  Heart of Wool
                </div>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color: #fffdf9; border-radius: 20px; padding: 28px 28px 24px; box-shadow: 0 8px 24px rgba(74,70,53,0.08);">

                <div style="display: inline-block; background-color: #e8a0a8; color: #fffdf9; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 12px; border-radius: 999px;">
                  New Order
                </div>

                <div style="font-family: Georgia, 'Playfair Display', serif; font-size: 24px; color: #4a4635; margin-top: 14px;">
                  ${escapeHtml(order.order_number)}
                </div>
                <div style="font-size: 28px; font-weight: 700; color: #4a4635; margin-top: 2px;">
                  ₹${order.subtotal}
                </div>

                <div style="margin-top: 14px; display: inline-block; background-color: ${paymentBadgeColor}; color: ${paymentBadgeText}; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 999px;">
                  ${paymentLabel} · ${paymentBadgeLabel}
                </div>

                <!-- CTA -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 22px;">
                  <tr>
                    <td align="center">
                      <a href="${adminUrl}"
                         style="display: inline-block; background-color: #d97e8c; color: #fffdf9; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; text-decoration: none; padding: 13px 28px; border-radius: 999px;">
                        View &amp; Confirm in Admin →
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="border-top: 1px solid rgba(74,70,53,0.12); margin: 24px 0 4px;"></div>

                <!-- Customer details -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                  ${row("Customer", escapeHtml(order.customer_name))}
                  ${row("Email", escapeHtml(order.email))}
                  ${row("Phone", escapeHtml(order.phone))}
                  ${row("Ship to", `${escapeHtml(order.address)}, ${escapeHtml(order.city)} ${escapeHtml(order.pincode)}`)}
                  ${order.notes ? row("Note", escapeHtml(order.notes)) : ""}
                </table>

                <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.5; color: #7a7460;">
                  Line items aren't shown here — tap the button above to see the full order and mark payment/status in Admin.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top: 20px;">
                <p style="font-size: 11px; color: #7a7460; margin: 0;">
                  You're getting this because a new order came in on Heart of Wool.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
