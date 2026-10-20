import { Link, useNavigate } from "react-router-dom";
import { Gift, Minus, Plus, Sparkles, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { finalUnitPriceForBundle, finalUnitPriceForProduct, type CartPricing } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";
import { ProductImage } from "@/components/ProductImage";

export function Cart() {
  const { lineItems, bundleLineItems, subtotal, pricing, setQuantity, removeItem, setBundleQuantity, removeBundle } =
    useCart();
  const navigate = useNavigate();

  if (lineItems.length === 0 && bundleLineItems.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="font-serif text-3xl text-olive">Your cart is empty</h1>
        <p className="mt-2 text-sm text-olive-soft">Find something you love and it'll show up here.</p>
        <Link
          to="/products"
          className="mt-6 inline-block rounded-full bg-pink px-6 py-3 text-xs font-semibold tracking-wide text-primary-foreground uppercase"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl text-olive">Your Cart</h1>

      <SpendDiscountBanner pricing={pricing} />

      <div className="mt-6 space-y-4">
        {bundleLineItems.map(({ bundle, quantity }) => (
          <div key={`bundle:${bundle.id}`} className="flex gap-4 rounded-2xl bg-olive/5 p-3 shadow-soft">
            <ProductImage src={bundle.image} alt={bundle.name} className="h-20 w-20 rounded-xl object-cover" />
            <div className="flex flex-1 flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1 text-sm font-medium text-olive">
                    <Gift className="h-3.5 w-3.5 text-pink-deep" /> {bundle.name}
                  </p>
                  <p className="text-xs text-olive-soft">Bundle</p>
                  <p className="text-sm font-semibold text-pink-deep">
                    ₹{finalUnitPriceForBundle(bundle.bundlePrice, pricing)}
                  </p>
                </div>
                <button
                  onClick={() => removeBundle(bundle.id)}
                  className="text-olive-soft hover:text-destructive"
                  aria-label={`Remove ${bundle.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full border border-input">
                  <button
                    className="flex h-7 w-7 items-center justify-center text-olive"
                    onClick={() => setBundleQuantity(bundle.id, quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-medium text-olive">{quantity}</span>
                  <button
                    className="flex h-7 w-7 items-center justify-center text-olive"
                    onClick={() => setBundleQuantity(bundle.id, quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {lineItems.map(({ product, color, quantity, image, availableStock, unitPrice }) => {
          const finalUnitPrice = finalUnitPriceForProduct(product.price, unitPrice, pricing);
          return (
          <div key={`${product.id}:${color?.id ?? ""}`} className="flex gap-4 rounded-2xl bg-card p-3 shadow-soft">
            <ProductImage src={image} alt={product.name} className="h-20 w-20 rounded-xl object-cover" />
            <div className="flex flex-1 flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-olive">{product.name}</p>
                  {color && <p className="text-xs text-olive-soft">{color.name}</p>}
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-olive-soft">₹{finalUnitPrice}</p>
                    {finalUnitPrice < product.price && (
                      <p className="text-xs text-olive-soft/60 line-through">₹{product.price}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(product.id, color?.id ?? null)}
                  className="text-olive-soft hover:text-destructive"
                  aria-label={`Remove ${product.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full border border-input">
                  <button
                    className="flex h-7 w-7 items-center justify-center text-olive"
                    onClick={() => setQuantity(product.id, color?.id ?? null, quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-medium text-olive">{quantity}</span>
                  <button
                    className="flex h-7 w-7 items-center justify-center text-olive disabled:opacity-40"
                    onClick={() => setQuantity(product.id, color?.id ?? null, quantity + 1)}
                    disabled={quantity >= availableStock}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                {quantity >= availableStock && (
                  <span className="text-[11px] text-olive-soft">Max stock reached</span>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl bg-card p-5 shadow-soft">
        {pricing.spendDiscountWon && (
          <div className="mb-3 flex items-center justify-between text-xs text-olive-soft">
            <span>Discount</span>
            <span className="font-medium text-pink-deep">−₹{pricing.spendDiscountApplied}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-olive-soft">
          <span>Subtotal</span>
          <span className="font-medium text-olive">₹{subtotal}</span>
        </div>
        <p className="mt-1 text-xs text-olive-soft">Shipping is calculated and confirmed at checkout.</p>
        <Button className="mt-5 w-full" size="lg" onClick={() => navigate("/checkout")}>
          Proceed to Checkout
        </Button>
      </div>
    </div>
  );
}

/** Promotional banner: nudges toward qualifying for the spend-threshold deal,
 * or confirms it's already applied. Renders nothing when the deal is off,
 * or the cart already gets a better price from per-product discounts. */
function SpendDiscountBanner({ pricing }: { pricing: CartPricing }) {
  if (pricing.spendDiscountWon) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-pink/10 px-4 py-3 text-xs font-medium text-pink-deep">
        <Sparkles className="h-4 w-4 shrink-0" />
        Storewide discount applied — you're saving ₹{pricing.spendDiscountApplied} on this order.
      </div>
    );
  }
  if (pricing.amountToQualify > 0) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-cream-deep px-4 py-3 text-xs font-medium text-olive">
        <Sparkles className="h-4 w-4 shrink-0 text-pink-deep" />
        Add ₹{pricing.amountToQualify} more to unlock a storewide discount.
      </div>
    );
  }
  return null;
}
