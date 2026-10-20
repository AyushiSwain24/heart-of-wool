import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, ShieldCheck, Sparkles } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { createOrder, OutOfStockError } from "@/lib/orderStore";
import { invalidateProductsCache } from "@/hooks/useProducts";
import { invalidateBundlesCache } from "@/hooks/useBundles";
import { finalUnitPriceForBundle, finalUnitPriceForProduct } from "@/lib/pricing";
import { UPI_ID } from "@/data/shop";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { ProductImage } from "@/components/ProductImage";
import { CopyButton } from "@/components/CopyButton";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/types";
import { toast } from "sonner";

export function Checkout() {
  const { lineItems, bundleLineItems, subtotal, pricing, clearCart } = useCart();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
    notes: "",
  });

  if (lineItems.length === 0 && bundleLineItems.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="font-serif text-3xl text-olive">Nothing to check out</h1>
        <p className="mt-2 text-sm text-olive-soft">Add something to your cart first.</p>
        <Button className="mt-6" onClick={() => navigate("/products")}>
          Browse Products
        </Button>
      </div>
    );
  }

  const updateField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const order = await createOrder({
        items: [
          ...lineItems.map((li) => ({
            productId: li.product.id,
            name: li.product.name,
            // Sent for the mock (no-Supabase) fallback path only — when Supabase
            // is configured, place_order() recomputes the real price itself
            // (product discount vs. the storewide spend-threshold deal,
            // whichever is better — see migration_008) and ignores this
            // value, so a client can never manipulate what it pays.
            price: finalUnitPriceForProduct(li.product.price, li.unitPrice, pricing),
            quantity: li.quantity,
            colorId: li.color?.id ?? null,
            colorName: li.color?.name ?? null,
            bundleId: null,
            bundleName: null,
          })),
          ...bundleLineItems.map((bl) => ({
            productId: null,
            name: bl.bundle.name,
            // Same note as above — the server resolves the bundle's real
            // current price itself and ignores this value.
            price: finalUnitPriceForBundle(bl.bundle.bundlePrice, pricing),
            quantity: bl.quantity,
            colorId: null,
            colorName: null,
            bundleId: bl.bundle.id,
            bundleName: bl.bundle.name,
          })),
        ],
        customerName: form.customerName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        city: form.city,
        pincode: form.pincode,
        paymentMethod,
        notes: form.notes || undefined,
      });

      clearCart();
      invalidateProductsCache(); // stock just changed server-side — force a fresh fetch next time
      invalidateBundlesCache(); // safe/cheap even though bundles don't touch stock (see place_order)
      toast.success("Order placed!");
      navigate(`/order-confirmation/${order.orderNumber}`, { state: { order } });
    } catch (err) {
      console.error("Failed to place order", err);
      if (err instanceof OutOfStockError) {
        // Stock may have changed underneath the cart (e.g. someone else
        // bought the last one) — refresh so the UI reflects reality.
        invalidateProductsCache();
        toast.error("Sorry, one of the items in your cart just sold out. Please update your cart and try again.");
      } else {
        toast.error("Something went wrong placing your order. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-serif text-3xl text-olive">Checkout</h1>

      <div className="mt-6 grid gap-8 sm:grid-cols-[1.3fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl bg-card p-5 shadow-soft">
            <p className="text-sm font-semibold text-olive">Contact & Shipping</p>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="customerName">Full name</Label>
                <Input id="customerName" required value={form.customerName} onChange={updateField("customerName")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={form.email} onChange={updateField("email")} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" required value={form.phone} onChange={updateField("phone")} />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" required rows={2} value={form.address} onChange={updateField("address")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" required value={form.city} onChange={updateField("city")} />
                </div>
                <div>
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input id="pincode" required value={form.pincode} onChange={updateField("pincode")} />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Order notes (optional)</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="Custom colour, gift note, etc."
                  value={form.notes}
                  onChange={updateField("notes")}
                />
              </div>
            </div>
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-olive-soft">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive-soft" />
              Your details are only used to fulfil this order and get in touch if we have a question about it —
              never shared or sold.
            </p>
          </div>

          <div className="rounded-2xl bg-card p-5 shadow-soft">
            <p className="text-sm font-semibold text-olive">Payment</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={cn(
                  "rounded-2xl border p-4 text-left text-sm transition-colors",
                  paymentMethod === "upi" ? "border-pink bg-cream-deep" : "border-input",
                )}
              >
                <p className="font-medium text-olive">Pay via UPI</p>
                <p className="mt-1 text-xs text-olive-soft">Pay to {UPI_ID}, then share the screenshot with us.</p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("cod")}
                className={cn(
                  "rounded-2xl border p-4 text-left text-sm transition-colors",
                  paymentMethod === "cod" ? "border-pink bg-cream-deep" : "border-input",
                )}
              >
                <p className="font-medium text-olive">Cash on Delivery</p>
                <p className="mt-1 text-xs text-olive-soft">Pay in cash when your order arrives.</p>
              </button>
            </div>
            {paymentMethod === "upi" && (
              <div className="mt-3 rounded-xl bg-cream-deep p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-olive-soft">
                    After placing your order, send <strong className="text-olive">₹{subtotal}</strong> to:
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2">
                  <span className="font-mono text-sm font-medium text-olive">{UPI_ID}</span>
                  <CopyButton value={UPI_ID} />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-olive-soft">
                  Then share the payment screenshot via email or Instagram DM (links in the footer). A real person
                  checks and confirms every payment — you'll be able to see "Payment confirmed" when you track your
                  order.
                </p>
              </div>
            )}
            {paymentMethod === "cod" && (
              <p className="mt-3 rounded-xl bg-cream-deep p-3.5 text-[11px] leading-relaxed text-olive-soft">
                No payment needed now — just have ₹{subtotal} ready in cash when your order arrives.
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Placing order…" : `Place Order — ₹${subtotal}`}
          </Button>
        </form>

        <aside className="h-fit rounded-2xl bg-card p-5 shadow-soft">
          <p className="text-sm font-semibold text-olive">Order Summary</p>

          {pricing.spendDiscountWon ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-pink/10 px-3 py-2 text-[11px] font-medium text-pink-deep">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              Storewide discount applied — saving ₹{pricing.spendDiscountApplied}.
            </div>
          ) : pricing.amountToQualify > 0 ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-cream-deep px-3 py-2 text-[11px] font-medium text-olive">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-pink-deep" />
              Add ₹{pricing.amountToQualify} more to unlock a storewide discount.
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {bundleLineItems.map(({ bundle, quantity }) => (
              <div key={`bundle:${bundle.id}`} className="flex items-center gap-3">
                <ProductImage src={bundle.image} alt={bundle.name} className="h-12 w-12 rounded-lg object-cover" />
                <div className="flex-1 text-xs">
                  <p className="flex items-center gap-1 font-medium text-olive">
                    <Gift className="h-3 w-3 text-pink-deep" /> {bundle.name}
                  </p>
                  <p className="text-olive-soft">Bundle · Qty {quantity}</p>
                </div>
                <p className="text-xs text-olive">₹{finalUnitPriceForBundle(bundle.bundlePrice, pricing) * quantity}</p>
              </div>
            ))}
            {lineItems.map(({ product, color, quantity, image, unitPrice }) => (
              <div key={`${product.id}:${color?.id ?? ""}`} className="flex items-center gap-3">
                <ProductImage src={image} alt={product.name} className="h-12 w-12 rounded-lg object-cover" />
                <div className="flex-1 text-xs">
                  <p className="font-medium text-olive">{product.name}</p>
                  {color && <p className="text-olive-soft">{color.name}</p>}
                  <p className="text-olive-soft">Qty {quantity}</p>
                </div>
                <p className="text-xs text-olive">
                  ₹{finalUnitPriceForProduct(product.price, unitPrice, pricing) * quantity}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-4 text-sm">
            {pricing.spendDiscountWon && (
              <div className="flex items-center justify-between text-xs text-olive-soft">
                <span>Discount</span>
                <span className="font-medium text-pink-deep">−₹{pricing.spendDiscountApplied}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between font-medium text-olive">
              <span>Total</span>
              <span>₹{subtotal}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
