import { useEffect, useMemo, useState } from "react";
import { Archive, Pencil, Plus, RefreshCw, RotateCcw } from "lucide-react";
import type { Bundle } from "@/types";
import {
  createBundle,
  fetchAdminBundles,
  setBundleActive,
  updateBundle,
  type BundleInput,
} from "@/lib/bundleAdminStore";
import { invalidateBundlesCache } from "@/hooks/useBundles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProductImage } from "@/components/ProductImage";
import { BundleForm } from "@/components/admin/BundleForm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; bundle: Bundle };

export function BundleManager() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminBundles();
      setBundles(data);
    } catch (err) {
      console.error("Failed to load bundles", err);
      toast.error("Failed to load bundles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = showArchived ? bundles : bundles.filter((b) => b.isActive);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((b) => b.name.toLowerCase().includes(q));
    return list;
  }, [bundles, showArchived, search]);

  const handleCreate = async (input: BundleInput) => {
    const created = await createBundle(input);
    setBundles((prev) => [created, ...prev]);
    invalidateBundlesCache();
    toast.success(`${created.name} added`);
    setMode({ kind: "list" });
  };

  const handleUpdate = async (input: BundleInput) => {
    const updated = await updateBundle(input);
    setBundles((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    invalidateBundlesCache();
    toast.success(`${updated.name} updated`);
    setMode({ kind: "list" });
  };

  const handleToggleActive = async (bundle: Bundle) => {
    const nextActive = !bundle.isActive;
    setBusyId(bundle.id);
    try {
      await setBundleActive(bundle.id, nextActive);
      setBundles((prev) => prev.map((b) => (b.id === bundle.id ? { ...b, isActive: nextActive } : b)));
      invalidateBundlesCache();
      toast.success(nextActive ? `${bundle.name} restored` : `${bundle.name} archived`);
    } catch (err) {
      console.error("Failed to update bundle", err);
      toast.error("Failed to update bundle");
    } finally {
      setBusyId(null);
    }
  };

  if (mode.kind === "create") {
    return <BundleForm onSubmit={handleCreate} onCancel={() => setMode({ kind: "list" })} />;
  }

  if (mode.kind === "edit") {
    return <BundleForm bundle={mode.bundle} onSubmit={handleUpdate} onCancel={() => setMode({ kind: "list" })} />;
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
          <Plus className="h-3.5 w-3.5" /> Add bundle
        </Button>
      </div>

      {bundles.length > 0 && (
        <Input
          className="mt-4"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {loading ? (
        <p className="mt-8 text-sm text-olive-soft">Loading bundles…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-olive-soft">
          {bundles.length === 0
            ? "No bundles yet — create one to feature a curated set on the storefront."
            : "No bundles match."}
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {filtered.map((bundle) => (
            <div
              key={bundle.id}
              className={cn("flex gap-3 rounded-2xl bg-card p-3 shadow-soft", !bundle.isActive && "opacity-60")}
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
                <ProductImage src={bundle.image} alt={bundle.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-olive">{bundle.name}</p>
                  {!bundle.isActive && (
                    <span className="shrink-0 rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-semibold text-olive-soft uppercase">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-xs text-olive-soft">
                  ₹{bundle.bundlePrice} · {bundle.items.length} product{bundle.items.length === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-olive-soft/70">
                  {bundle.items.map((i) => i.name).join(", ")}
                </p>

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setMode({ kind: "edit", bundle })}
                    className="flex items-center gap-1 rounded-full bg-cream-deep px-2.5 py-1 text-[11px] font-semibold text-olive"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(bundle)}
                    disabled={busyId === bundle.id}
                    className="flex items-center gap-1 rounded-full bg-cream-deep px-2.5 py-1 text-[11px] font-semibold text-olive disabled:opacity-50"
                  >
                    {bundle.isActive ? (
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
          ))}
        </div>
      )}
    </div>
  );
}
