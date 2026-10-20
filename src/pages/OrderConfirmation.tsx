import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import type { Order } from "@/types";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/CopyButton";
import { UPI_ID, CONTACT_EMAIL, INSTAGRAM_URL } from "@/data/shop";

export function OrderConfirmation() {
  const { orderNumber: orderNumberParam } = useParams();
  const location = useLocation();
  const order = (location.state as { order?: Order } | null)?.order;
  const orderNumber = order?.orderNumber ?? orderNumberParam ?? "";

  return (
    <div className="mx-auto max-w-xl px-5 py-16 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-pink-deep" />
      <h1 className="mt-4 font-serif text-3xl text-olive">Order placed!</h1>
      <p className="mt-2 text-sm text-olive-soft">
        We've got it — here's your order number. Save it, you'll need it to track your order.
      </p>

      <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-card px-4 py-2 shadow-soft">
        <span className="font-mono text-sm font-semibold text-olive">{orderNumber}</span>
        {orderNumber && <CopyButton value={orderNumber} />}
      </div>

      {order && (
        <div className="mt-6 rounded-2xl bg-card p-5 text-left shadow-soft">
          <p className="text-sm font-semibold text-olive">What happens next</p>

          {order.paymentMethod === "upi" ? (
            <ol className="mt-3 space-y-3 text-xs text-olive-soft">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink text-[10px] font-bold text-primary-foreground">
                  1
                </span>
                <span>
                  Send <strong className="text-olive">₹{order.subtotal}</strong> to{" "}
                  <span className="font-mono text-olive">{UPI_ID}</span>
                  {" — "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-olive">
                    email
                  </a>{" "}
                  or{" "}
                  <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="underline hover:text-olive">
                    Instagram DM
                  </a>{" "}
                  us the payment screenshot.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-deep text-[10px] font-bold text-olive-soft">
                  2
                </span>
                <span>We confirm your payment by hand, usually within a few hours.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-deep text-[10px] font-bold text-olive-soft">
                  3
                </span>
                <span>We make/pack your order and ship it — track progress any time with your order number.</span>
              </li>
            </ol>
          ) : (
            <ol className="mt-3 space-y-3 text-xs text-olive-soft">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink text-[10px] font-bold text-primary-foreground">
                  1
                </span>
                <span>We start making/packing your order right away.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-deep text-[10px] font-bold text-olive-soft">
                  2
                </span>
                <span>
                  Have <strong className="text-olive">₹{order.subtotal}</strong> ready in cash when it arrives.
                </span>
              </li>
            </ol>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/track-order">
          <Button variant="outline" size="lg" className="w-full sm:w-auto">
            Track this order
          </Button>
        </Link>
        <Link to="/products">
          <Button size="lg" className="w-full sm:w-auto">
            Continue shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}
