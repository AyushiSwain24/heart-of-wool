import { useState, type FormEvent } from "react";
import { CheckCircle2, Clock, Gift, Package, PackageCheck, PackageOpen, Truck } from "lucide-react";
import { findOrder } from "@/lib/orderStore";
import type { Order, OrderStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils";

const steps: { status: OrderStatus; label: string; icon: typeof Package }[] = [
  { status: "placed", label: "Placed", icon: Package },
  { status: "packed", label: "Packed", icon: PackageOpen },
  { status: "shipped", label: "Shipped", icon: Truck },
  { status: "delivered", label: "Delivered", icon: PackageCheck },
];

export function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [result, setResult] = useState<Order | null | undefined>(undefined);
  const [searching, setSearching] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSearching(true);
    try {
      const order = await findOrder(orderNumber, contact);
      setResult(order ?? null);
    } catch (err) {
      console.error("Failed to look up order", err);
      setResult(null);
    } finally {
      setSearching(false);
    }
  };

  const activeStepIndex = result ? steps.findIndex((s) => s.status === result.status) : -1;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-serif text-4xl text-olive">Track Your Order 📦</h1>
      <p className="mt-3 text-sm text-olive-soft">
        Enter your order number along with the email or phone number you used at checkout.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl bg-card p-5 shadow-soft">
        <div>
          <Label htmlFor="orderNumber">Order number</Label>
          <Input
            id="orderNumber"
            placeholder="HOW-1001"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="contact">Email or phone</Label>
          <Input
            id="contact"
            placeholder="you@example.com"
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={searching}>
          {searching ? "Searching…" : "Track Order"}
        </Button>
      </form>

      {result === null && (
        <div className="mt-6 rounded-2xl bg-card p-5 text-center shadow-soft">
          <p className="text-sm text-olive-soft">
            We couldn't find an order matching those details — double-check the order number (it looks like{" "}
            <span className="font-mono">HOW-1001</span>) and the email or phone used at checkout.
          </p>
          <p className="mt-2 text-xs text-olive-soft">
            Still stuck? Message us on{" "}
            <a href="/contact" className="font-semibold text-olive underline">
              Contact
            </a>{" "}
            and we'll sort it out.
          </p>
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-2xl bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-olive">Order {result.orderNumber}</p>
            <p className="text-xs text-olive-soft">{new Date(result.createdAt).toLocaleDateString()}</p>
          </div>

          {result.status === "cancelled" ? (
            <p className="mt-4 text-sm text-destructive">This order has been cancelled.</p>
          ) : (
            <div className="relative mt-6">
              {/* Track line sits behind the icons, spanning icon-center to icon-center. */}
              <div className="absolute top-4.5 right-[12.5%] left-[12.5%] h-0.5 bg-cream-deep" aria-hidden="true">
                <div
                  className="h-full bg-pink transition-all"
                  style={{
                    width:
                      activeStepIndex <= 0
                        ? "0%"
                        : `${(Math.min(activeStepIndex, steps.length - 1) / (steps.length - 1)) * 100}%`,
                  }}
                />
              </div>

              <div className="relative flex items-start justify-between">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  const reached = i <= activeStepIndex;
                  return (
                    <div key={step.status} className="flex flex-1 flex-col items-center">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full",
                          reached ? "bg-pink text-primary-foreground" : "bg-cream-deep text-olive-soft",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <p
                        className={cn(
                          "mt-1.5 text-[10px] font-medium uppercase",
                          reached ? "text-olive" : "text-olive-soft",
                        )}
                      >
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2 border-t border-border pt-4">
            {result.items.map((item) => (
              <div
                key={`${item.productId ?? item.bundleId}:${item.colorId ?? ""}`}
                className="flex justify-between text-xs text-olive-soft"
              >
                <span className="flex items-center gap-1">
                  {item.bundleId && <Gift className="h-3 w-3 shrink-0 text-pink-deep" />}
                  {item.name}
                  {item.colorName ? ` (${item.colorName})` : ""}
                  {item.bundleId ? " (Bundle)" : ""} × {item.quantity}
                </span>
                <span>₹{item.price * item.quantity}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-sm font-medium text-olive">
              <span>Total</span>
              <span>₹{result.subtotal}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-cream-deep px-3.5 py-2.5">
            <span className="text-xs text-olive-soft">
              Payment: {result.paymentMethod === "upi" ? "UPI" : "Cash on Delivery"}
            </span>
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase",
                result.paymentConfirmed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800",
              )}
            >
              {result.paymentConfirmed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {result.paymentConfirmed ? "Confirmed" : "Pending confirmation"}
            </span>
          </div>
          {result.paymentMethod === "upi" && !result.paymentConfirmed && (
            <p className="mt-2 text-[11px] text-olive-soft">
              Sent your payment already? Confirmation can take a few hours — no need to send it twice.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
