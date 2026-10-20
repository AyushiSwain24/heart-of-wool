import { ClipboardCheck, MessageCircleHeart, PackageCheck, ShoppingBag } from "lucide-react";

const steps = [
  {
    icon: ShoppingBag,
    title: "1. Place your order",
    description: "Add items to your cart and check out with your address and UPI or Cash on Delivery.",
  },
  {
    icon: MessageCircleHeart,
    title: "2. We confirm together",
    description:
      "For UPI, send your payment screenshot via email or Instagram — a real person checks and confirms it, usually within a few hours.",
  },
  {
    icon: ClipboardCheck,
    title: "3. We make & pack it",
    description: "Each order is handmade or hand-packed after confirmation, not mass-produced ahead of time.",
  },
  {
    icon: PackageCheck,
    title: "4. Track it any time",
    description: "Look up your order number whenever you like to see exactly where it's at.",
  },
];

/**
 * Trust-building explainer for a small handmade shop with manual payment
 * confirmation (no payment gateway yet). Without this, "pay via UPI, then
 * send a screenshot" can read as informal or even scammy to a first-time
 * visitor — spelling out that a real person checks every order, and that
 * tracking is available, closes that gap.
 */
export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-center">
        <h2 className="font-serif text-2xl text-olive sm:text-3xl">How ordering works</h2>
        <p className="mt-1 text-sm text-olive-soft">Small-batch and handmade — here's exactly what happens after you order.</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {steps.map((step) => (
          <div key={step.title} className="rounded-2xl bg-card p-3.5 text-center shadow-soft sm:p-5">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-cream-deep text-pink-deep sm:h-11 sm:w-11">
              <step.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <p className="mt-2.5 text-xs font-semibold text-olive sm:mt-3 sm:text-sm">{step.title}</p>
            <p className="mt-1 text-[11px] leading-snug text-olive-soft sm:mt-1.5 sm:text-xs sm:leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
