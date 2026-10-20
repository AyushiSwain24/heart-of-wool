import { Link } from "react-router-dom";
import type { Product } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { ProductImage } from "@/components/ProductImage";
import { discountedPrice, hasDiscount } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  // For colored products, stock lives on each color rather than the
  // product row itself — sold out only when every color is sold out.
  const totalStock =
    product.colors.length > 0 ? product.colors.reduce((sum, c) => sum + c.stock, 0) : product.stock;
  const soldOut = totalStock <= 0;
  const lowStock = totalStock > 0 && totalStock <= 3;
  const onSale = hasDiscount(product.discountPercent);
  const finalPrice = discountedPrice(product.price, product.discountPercent);

  return (
    <Link
      to={`/products/${product.id}`}
      className="group block overflow-hidden rounded-3xl bg-card shadow-soft transition-transform hover:-translate-y-1"
    >
      <div className="relative aspect-square overflow-hidden bg-cream-deep">
        <ProductImage
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-olive/50">
            <Badge className="bg-card text-olive">Sold Out</Badge>
          </div>
        )}
        {!soldOut && lowStock && (
          <Badge className="absolute top-3 left-3 bg-pink text-primary-foreground">Only {totalStock} left</Badge>
        )}
        {!soldOut && onSale && (
          <Badge className="absolute top-3 right-3 bg-pink text-primary-foreground shadow-soft">
            {product.discountPercent}% OFF
          </Badge>
        )}
      </div>
      <div className="p-4">
        <p className="text-sm font-medium text-olive">{product.name}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <p className={cn("text-sm", onSale ? "font-semibold text-pink-deep" : "text-olive-soft")}>₹{finalPrice}</p>
          {onSale && <p className="text-xs text-olive-soft/60 line-through">₹{product.price}</p>}
        </div>
      </div>
    </Link>
  );
}
