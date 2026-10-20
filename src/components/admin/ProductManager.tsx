import { useEffect, useMemo, useState } from "react";
import { Archive, Pencil, Plus, RefreshCw, RotateCcw } from "lucide-react";
import type { Product } from "@/types";
import { categories } from "@/data/categories";
import {
  createProduct,
  fetchAdminProducts,
  setProductActive,
  updateProduct,
  type ProductInput,
} from "@/lib/productAdminStore";
import { invalidateProductsCache } from "@/hooks/useProducts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProductImage } from "@/components/ProductImage";
import { ProductForm } from "@/components/admin/ProductForm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; product: Product };

export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminProducts();
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = showArchived ? products : products.filter((p) => p.isActive);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    return list;
  }, [products, showArchived, search]);

  const handleCreate = async (input: ProductInput) => {
    const created = await createProduct(input);
    setProducts((prev) => [created, ...prev]);
    invalidateProductsCache();
    toast.success(`${created.name} added`);
    setMode({ kind: "list" });
  };

  const handleUpdate = async (input: ProductInput) => {
    const updated = await updateProduct(input);
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    invalidateProductsCache();
    toast.success(`${updated.name} updated`);
    setMode({ kind: "list" });
  };

  const handleToggleActive = async (product: Product) => {
    const nextActive = !product.isActive;
    setBusyId(product.id);
    try {
      const updated = await setProductActive(product.id, nextActive);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      invalidateProductsCache();
      toast.success(nextActive ? `${updated.name} restored` : `${updated.name} archived`);
    } catch (err) {
      console.error("Failed to update product", err);
      toast.error("Failed to update product");
    } finally {
      setBusyId(null);
    }
  };

  if (mode.kind === "create") {
    return <ProductForm onSubmit={handleCreate} onCancel={() => setMode({ kind: "list" })} />;
  }

  if (mode.kind === "edit") {
    return <ProductForm product={mode.product} onSubmit={handleUpdate} onCancel={() => setMode({ kind: "list" })} />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-cream-deep px-3 py-1.5 text-xs font-semibold text-olive disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </button>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              showArchived ? "bg-pink text-primary-foreground" : "bg-cream-deep text-olive",
            )}
          >
            {showArchived ? "Showing archived" : "Show archived"}
          </button>
        </div>
        <Button size="sm" onClick={() => setMode({ kind: "create" })} className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add product
        </Button>
      </div>

      {products.length > 0 && (
        <Input
          className="mt-4"
          placeholder="Search by name or id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {loading ? (
        <p className="mt-8 text-sm text-olive-soft">Loading products…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-olive-soft">No products match.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {filtered.map((product) => {
            const category = categories.find((c) => c.id === product.category);
            return (
              <div
                key={product.id}
                className={cn(
                  "flex gap-3 rounded-2xl bg-card p-3 shadow-soft",
                  !product.isActive && "opacity-60",
                )}
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
                  <ProductImage src={product.image} alt={product.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-olive">{product.name}</p>
                    <div className="flex shrink-0 gap-1.5">
                      {product.discountPercent > 0 && (
                        <span className="rounded-full bg-olive px-2 py-0.5 text-[10px] font-semibold text-cream uppercase">
                          {product.discountPercent}% off
                        </span>
                      )}
                      {!product.isActive && (
                        <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-semibold text-olive-soft uppercase">
                          Archived
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-olive-soft">
                    {category?.label} · ₹{product.price} ·{" "}
                    {product.colors.length > 0
                      ? `${product.colors.length} color${product.colors.length === 1 ? "" : "s"}`
                      : `stock ${product.stock}`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-olive-soft/70">id: {product.id}</p>

                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setMode({ kind: "edit", product })}
                      className="flex items-center gap-1 rounded-full bg-cream-deep px-2.5 py-1 text-[11px] font-semibold text-olive"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(product)}
                      disabled={busyId === product.id}
                      className="flex items-center gap-1 rounded-full bg-cream-deep px-2.5 py-1 text-[11px] font-semibold text-olive disabled:opacity-50"
                    >
                      {product.isActive ? (
                        <>
                          <Archive className="h-3 w-3" /> Archive
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3" /> Restore
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
