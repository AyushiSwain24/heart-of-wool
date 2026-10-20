import { useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { categories } from "@/data/categories";
import type { CategoryId } from "@/types";
import { ProductCard } from "@/components/ProductCard";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { discountedPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type FilterId = CategoryId | "all" | "discounted";

type SortId = "newest" | "price-asc" | "price-desc" | "discount-desc";

const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "discount-desc", label: "Biggest Discount" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
];

export function ProductBrowser({
  heading = "Shop",
  subheading,
}: {
  heading?: string;
  subheading?: string;
}) {
  const [active, setActive] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("newest");
  const { products, loading } = useProducts();

  const discountedCount = useMemo(() => products.filter((p) => p.discountPercent > 0).length, [products]);

  const filtered = useMemo(() => {
    const base =
      active === "all"
        ? products
        : active === "discounted"
          ? products.filter((p) => p.discountPercent > 0)
          : products.filter((p) => p.category === active);

    // useProducts() already returns products ordered oldest -> newest
    // (see fetchProducts), so "Newest" is just "reverse the given order"
    // rather than needing its own timestamp field on Product.
    if (sort === "newest") return [...base].reverse();
    if (sort === "price-asc") {
      return [...base].sort(
        (a, b) => discountedPrice(a.price, a.discountPercent) - discountedPrice(b.price, b.discountPercent),
      );
    }
    if (sort === "price-desc") {
      return [...base].sort(
        (a, b) => discountedPrice(b.price, b.discountPercent) - discountedPrice(a.price, a.discountPercent),
      );
    }
    // discount-desc
    return [...base].sort((a, b) => b.discountPercent - a.discountPercent);
  }, [active, sort, products]);

  return (
    <section id="shop" className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-center">
        <h2 className="font-serif text-2xl text-olive sm:text-3xl">{heading}</h2>
        {subheading && <p className="mt-1 text-sm text-olive-soft">{subheading}</p>}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setActive("all")}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold tracking-wide uppercase transition-colors",
            active === "all" ? "bg-pink text-primary-foreground" : "bg-cream-deep text-olive-soft hover:text-olive",
          )}
        >
          All
        </button>
        {discountedCount > 0 && (
          <button
            onClick={() => setActive("discounted")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold tracking-wide uppercase transition-colors",
              active === "discounted"
                ? "bg-pink text-primary-foreground"
                : "bg-olive/10 text-pink-deep hover:bg-olive/15",
            )}
          >
            <Tag className="h-3 w-3" /> On Sale
          </button>
        )}
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActive(cat.id)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold tracking-wide uppercase transition-colors",
              active === cat.id
                ? "bg-pink text-primary-foreground"
                : "bg-cream-deep text-olive-soft hover:text-olive",
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-4 flex max-w-[220px] items-center gap-2">
        <Label htmlFor="pb-sort" className="sr-only">
          Sort by
        </Label>
        <Select id="pb-sort" value={sort} onChange={(e) => setSort(e.target.value as SortId)}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              Sort: {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl bg-card shadow-soft">
              <div className="aspect-square animate-pulse bg-cream-deep" />
              <div className="space-y-2 p-4">
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-cream-deep" />
                <div className="h-3.5 w-1/3 animate-pulse rounded bg-cream-deep" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="mt-10 text-center text-sm text-olive-soft">No products in this category yet.</p>
          )}
        </>
      )}
    </section>
  );
}
