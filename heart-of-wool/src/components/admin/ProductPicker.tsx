import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { Product } from "@/types";
import { ProductImage } from "@/components/ProductImage";
import { cn } from "@/lib/utils";

/**
 * Searchable product picker for admin forms — replaces a plain <select>
 * (which, with 30-40+ products, becomes a long unlabelled scroll with no
 * thumbnails and no way to search) with a button that opens a small
 * pop-over: type to filter by name, see a thumbnail + price for every
 * option, click to pick.
 */
export function ProductPicker({
  products,
  value,
  onChange,
  disabledIds = [],
}: {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  /** Product ids to show but not allow selecting (e.g. already used elsewhere in this bundle). */
  disabledIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = products.find((p) => p.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [products, query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
        className="flex w-full items-center gap-2 rounded-2xl border border-input bg-card px-3 py-2 text-left text-sm text-olive focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/30"
      >
        {selected ? (
          <>
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-cream-deep">
              <ProductImage src={selected.image} alt={selected.name} className="h-full w-full object-cover" />
            </div>
            <span className="min-w-0 flex-1 truncate">
              {selected.name} <span className="text-olive-soft">(₹{selected.price})</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-olive-soft/70">Choose a product…</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-olive-soft" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-input bg-card shadow-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-olive-soft" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full bg-transparent text-sm text-olive placeholder:text-olive-soft/60 focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-olive-soft">No products match "{query}".</p>
            ) : (
              filtered.map((p) => {
                const isDisabled = disabledIds.includes(p.id) && p.id !== value;
                const isSelected = p.id === value;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                      isDisabled ? "cursor-not-allowed opacity-40" : "hover:bg-cream-deep",
                    )}
                  >
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-cream-deep">
                      <ProductImage src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-olive">
                      {p.name} <span className="text-olive-soft">(₹{p.price})</span>
                      {isDisabled && <span className="text-olive-soft/70"> — already in this bundle</span>}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-pink-deep" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
