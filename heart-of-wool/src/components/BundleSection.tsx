import { Gift } from "lucide-react";
import { useBundles } from "@/hooks/useBundles";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/Button";
import { ProductImage } from "@/components/ProductImage";
import { toast } from "sonner";

/**
 * "Bundles & Deals" — curated multi-product sets at a fixed price, shown
 * in their own section so they stand out from regular products. Renders
 * nothing when there are no active bundles, so shops that never use this
 * feature see no empty section.
 */
export function BundleSection() {
  const { bundles, loading } = useBundles();
  const { addBundle } = useCart();

  if (loading) {
    return (
      <section className="bg-olive/5 px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="h-6 w-48 animate-pulse rounded bg-cream-deep" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-3xl bg-card" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (bundles.length === 0) return null;

  return (
    <section className="bg-olive/5 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-center gap-2 text-center">
          <Gift className="h-5 w-5 text-pink-deep" />
          <h2 className="font-serif text-2xl text-olive sm:text-3xl">Bundles &amp; Deals</h2>
        </div>
        <p className="mt-1 text-center text-sm text-olive-soft">
          Curated sets at a special price — better together.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => {
            const fullPrice = bundle.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
            const savings = fullPrice - bundle.bundlePrice;

            return (
              <div key={bundle.id} className="overflow-hidden rounded-3xl bg-card shadow-card">
                <div className="flex gap-3 p-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-cream-deep">
                    <ProductImage src={bundle.image} alt={bundle.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg text-olive">{bundle.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-olive-soft">{bundle.description}</p>
                    <p className="mt-1.5 text-[11px] text-olive-soft/80">
                      Includes: {bundle.items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-lg font-semibold text-pink-deep">₹{bundle.bundlePrice}</p>
                      {savings > 0 && <p className="text-xs text-olive-soft/60 line-through">₹{fullPrice}</p>}
                    </div>
                    {savings > 0 && <p className="text-[11px] font-medium text-pink-deep">Save ₹{savings}</p>}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      addBundle(bundle);
                      toast.success(`${bundle.name} added to cart`);
                    }}
                  >
                    Add Bundle
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
