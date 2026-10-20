import { useRef, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import type { Bundle } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { ProductImage } from "@/components/ProductImage";
import { ProductPicker } from "@/components/admin/ProductPicker";
import { compressImage } from "@/lib/compressImage";
import { uploadProductImage } from "@/lib/productAdminStore";
import { type BundleInput, type BundleItemInput } from "@/lib/bundleAdminStore";
import { toast } from "sonner";

/** Local editing shape for one product row in the bundle — carries a
 * stable client-side key so React can track rows across add/remove. */
type ItemRow = BundleItemInput & { key: string };

function makeItemRow(productId: string, overrides: Partial<ItemRow> = {}): ItemRow {
  return { key: crypto.randomUUID(), productId, quantity: 1, sortOrder: 0, ...overrides };
}

type BundleFormProps = {
  /** Pass an existing bundle to edit it; omit to create a new one. */
  bundle?: Bundle;
  onSubmit: (input: BundleInput) => Promise<void>;
  onCancel: () => void;
};

export function BundleForm({ bundle, onSubmit, onCancel }: BundleFormProps) {
  const isEditing = Boolean(bundle);
  const { products, loading: productsLoading } = useProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(bundle?.name ?? "");
  const [description, setDescription] = useState(bundle?.description ?? "");
  const [bundlePrice, setBundlePrice] = useState(bundle ? String(bundle.bundlePrice) : "");
  const [image, setImage] = useState(bundle?.image ?? "");
  const [items, setItems] = useState<ItemRow[]>(
    bundle?.items.map((i, idx) => makeItemRow(i.productId, { quantity: i.quantity, sortOrder: idx })) ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fullPrice = items.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId);
    return sum + (product?.price ?? 0) * i.quantity;
  }, 0);

  const addItemRow = () => {
    if (items.length >= products.length) {
      toast.error("Every product is already in this bundle.");
      return;
    }
    // Starts unselected — the admin picks which product via the search
    // picker below, rather than the form guessing one for them.
    setItems((prev) => [...prev, makeItemRow("", { sortOrder: prev.length })]);
  };

  const removeItemRow = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const updateItemRow = (key: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    setUploading(true);
    try {
      const { blob, extension } = await compressImage(file);
      const url = await uploadProductImage(`bundle-${bundle?.id ?? "new"}`, blob, extension);
      setImage(url);
      toast.success("Image uploaded");
    } catch (err) {
      console.error("Image upload failed", err);
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const priceNum = Number(bundlePrice);

    if (!trimmedName) return setError("Name is required.");
    if (!Number.isFinite(priceNum) || priceNum < 0) return setError("Enter a valid bundle price.");
    if (!image) return setError("Please upload an image for the bundle.");
    if (items.length === 0) return setError("Add at least one product to the bundle.");
    for (const i of items) {
      if (!i.productId) return setError("Choose a product for every row (or remove the empty one).");
      if (!Number.isInteger(i.quantity) || i.quantity < 1) return setError("Every product needs a quantity of at least 1.");
    }

    setSaving(true);
    try {
      await onSubmit({
        id: bundle?.id,
        name: trimmedName,
        description: description.trim(),
        image,
        bundlePrice: Math.round(priceNum),
        items: items.map((i, idx) => ({ productId: i.productId, quantity: Math.round(i.quantity), sortOrder: idx })),
      });
    } catch (err) {
      console.error("Failed to save bundle", err);
      setError(err instanceof Error ? err.message : "Failed to save bundle.");
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-card p-5 shadow-soft">
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div className="mx-auto w-32 sm:mx-0 sm:w-full">
          <Label>Image</Label>
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-cream-deep">
            {image ? (
              <ProductImage src={image} alt={name || "Bundle"} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-[10px] text-olive-soft/60">
                No image
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-cream-deep px-3 py-1.5 text-xs font-semibold text-olive disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Uploading…" : image ? "Replace" : "Upload"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="bf-name">Name</Label>
            <Input
              id="bf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cozy Starter Set"
            />
          </div>

          <div>
            <Label htmlFor="bf-price">Bundle price (₹)</Label>
            <Input
              id="bf-price"
              type="number"
              min="0"
              value={bundlePrice}
              onChange={(e) => setBundlePrice(e.target.value)}
              placeholder="1299"
            />
            {items.length > 0 && Number.isFinite(Number(bundlePrice)) && Number(bundlePrice) > 0 && (
              <p className="mt-1 text-[11px] text-olive-soft/70">
                Items add up to ₹{fullPrice}
                {Number(bundlePrice) < fullPrice
                  ? ` — customers save ₹${fullPrice - Number(bundlePrice)}`
                  : Number(bundlePrice) > fullPrice
                    ? " — priced above the individual total"
                    : ""}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="bf-description">Description</Label>
            <Textarea
              id="bf-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Two of our best-loved dolls plus a little bag charm..."
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div>
          <Label>Products in this bundle</Label>
          <p className="text-[11px] text-olive-soft/70">
            Pick the specific products that make up this bundle, and how many of each.
          </p>
        </div>

        {productsLoading ? (
          <p className="mt-3 text-xs text-olive-soft">Loading products…</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {items.map((item) => (
              <div key={item.key} className="flex items-center gap-2 rounded-xl bg-cream-deep/60 p-2.5">
                <ProductPicker
                  products={products}
                  value={item.productId}
                  onChange={(productId) => updateItemRow(item.key, { productId })}
                  disabledIds={items.filter((i) => i.key !== item.key).map((i) => i.productId)}
                />
                <div className="w-16 shrink-0">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItemRow(item.key, { quantity: Number(e.target.value) })}
                    aria-label="Quantity"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItemRow(item.key)}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-card px-2.5 py-1.5 text-[11px] font-semibold text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addItemRow}
          disabled={productsLoading || items.some((i) => !i.productId)}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-cream-deep px-3 py-1.5 text-xs font-semibold text-olive disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add product
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving || uploading}>
          {saving ? "Saving…" : isEditing ? "Save changes" : "Create bundle"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
