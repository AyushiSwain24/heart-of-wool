import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { categories } from "@/data/categories";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProductImage } from "@/components/ProductImage";
import { cn } from "@/lib/utils";
import { discountedPrice, hasDiscount } from "@/lib/pricing";
import { toast } from "sonner";

export function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const { products, loading } = useProducts();

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 h-4 w-16 animate-pulse rounded bg-cream-deep" />
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-3xl bg-cream-deep" />
          <div className="space-y-3">
            <div className="h-5 w-24 animate-pulse rounded-full bg-cream-deep" />
            <div className="h-8 w-2/3 animate-pulse rounded bg-cream-deep" />
            <div className="h-5 w-20 animate-pulse rounded bg-cream-deep" />
            <div className="h-16 w-full animate-pulse rounded bg-cream-deep" />
            <div className="h-11 w-40 animate-pulse rounded-full bg-cream-deep" />
          </div>
        </div>
      </div>
    );
  }

  const product = products.find((p) => p.id === productId);

  if (!product) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-olive">We couldn't find that product.</p>
        <Link to="/products" className="mt-4 inline-block text-sm font-semibold text-pink-deep">
          Back to all products
        </Link>
      </div>
    );
  }

  const category = categories.find((c) => c.id === product.category);
  const hasColors = product.colors.length > 0;
  // Default to the first in-stock color (falls back to the first color if all are sold out).
  const activeColorId = hasColors
    ? (selectedColorId ?? product.colors.find((c) => c.stock > 0)?.id ?? product.colors[0].id)
    : null;
  const activeColor = hasColors ? (product.colors.find((c) => c.id === activeColorId) ?? null) : null;
  const displayImage = activeColor?.image ?? product.image;
  const availableStock = activeColor ? activeColor.stock : product.stock;
  const soldOut = availableStock <= 0;
  const onSale = hasDiscount(product.discountPercent);
  const finalPrice = discountedPrice(product.price, product.discountPercent);

  const handleAddToCart = () => {
    addItem(product, activeColorId, qty);
    toast.success(`${product.name}${activeColor ? ` (${activeColor.name})` : ""} added to cart`);
  };

  const handleBuyNow = () => {
    addItem(product, activeColorId, qty);
    navigate("/cart");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-olive-soft uppercase hover:text-olive"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="overflow-hidden rounded-3xl bg-card shadow-card">
          <ProductImage src={displayImage} alt={product.name} className="aspect-square w-full object-cover" />
        </div>

        <div>
          {category && <Badge>{category.label}</Badge>}
          {onSale && (
            <Badge className="ml-2 bg-pink text-primary-foreground">{product.discountPercent}% OFF</Badge>
          )}
          <h1 className="mt-3 font-serif text-3xl text-olive">{product.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-xl text-olive-soft">₹{finalPrice}</p>
            {onSale && <p className="text-sm text-olive-soft/60 line-through">₹{product.price}</p>}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-olive-soft">{product.description}</p>

          {hasColors && (
            <div className="mt-5">
              <p className="text-xs font-semibold tracking-wide text-olive-soft uppercase">
                Color{activeColor ? `: ${activeColor.name}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.colors.map((color) => {
                  const isSelected = color.id === activeColorId;
                  const isColorSoldOut = color.stock <= 0;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => {
                        setSelectedColorId(color.id);
                        setQty(1);
                      }}
                      disabled={isColorSoldOut}
                      title={`${color.name}${isColorSoldOut ? " (Sold out)" : ""}`}
                      aria-label={color.name}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative h-9 w-9 rounded-full border-2 transition-all",
                        isSelected ? "border-pink-deep" : "border-input",
                        isColorSoldOut && "opacity-40",
                      )}
                      style={{ backgroundColor: color.hex ?? "#e5ded0" }}
                    >
                      {isColorSoldOut && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="h-[1.5px] w-full rotate-45 bg-olive/60" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs font-semibold tracking-wide text-olive-soft uppercase">
            {soldOut
              ? "Sold out"
              : availableStock <= 3
                ? `Only ${availableStock} left in stock`
                : "In stock"}
          </p>

          {!soldOut && (
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-full border border-input">
                <button
                  className="flex h-9 w-9 items-center justify-center text-olive disabled:opacity-40"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-medium text-olive">{qty}</span>
                <button
                  className="flex h-9 w-9 items-center justify-center text-olive disabled:opacity-40"
                  onClick={() => setQty((q) => Math.min(availableStock, q + 1))}
                  disabled={qty >= availableStock}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" disabled={soldOut} onClick={handleAddToCart}>
              {soldOut ? "Sold Out" : "Add to Cart"}
            </Button>
            {!soldOut && (
              <Button size="lg" variant="outline" onClick={handleBuyNow}>
                Buy Now
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
