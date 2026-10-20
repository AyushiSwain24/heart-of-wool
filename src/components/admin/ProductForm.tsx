import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { categories } from "@/data/categories";
import type { CategoryId, Product } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ProductImage } from "@/components/ProductImage";
import { compressImage } from "@/lib/compressImage";
import {
  fetchProductColors,
  saveProductColors,
  slugifyProductName,
  uploadProductImage,
  type ProductColorInput,
  type ProductInput,
} from "@/lib/productAdminStore";
import { toast } from "sonner";

/** Local editing shape for a color row — carries a stable client-side key
 * so React can track rows across add/remove even before they have a real
 * database id. */
type ColorRow = ProductColorInput & { key: string };

function makeColorRow(overrides: Partial<ColorRow> = {}): ColorRow {
  return {
    key: crypto.randomUUID(),
    id: null,
    name: "",
    hex: null,
    image: "",
    stock: 0,
    sortOrder: 0,
    ...overrides,
  };
}

type ProductFormProps = {
  /** Pass an existing product to edit it; omit to create a new one. */
  product?: Product;
  onSubmit: (input: ProductInput) => Promise<void>;
  onCancel: () => void;
};

export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const isEditing = Boolean(product);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [category, setCategory] = useState<CategoryId>(product?.category ?? categories[0].id);
  const [description, setDescription] = useState(product?.description ?? "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [discountPercent, setDiscountPercent] = useState(product ? String(product.discountPercent) : "0");
  const [image, setImage] = useState(product?.image ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [colors, setColors] = useState<ColorRow[]>([]);
  const [colorsLoading, setColorsLoading] = useState(isEditing);
  const [uploadingColorKey, setUploadingColorKey] = useState<string | null>(null);
  const colorFileInputRef = useRef<HTMLInputElement>(null);
  const pendingColorUploadKey = useRef<string | null>(null);

  const pendingId = product?.id ?? slugifyProductName(name || "new-product");

  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    setColorsLoading(true);
    fetchProductColors(product.id)
      .then((existing) => {
        if (cancelled) return;
        setColors(existing.map((c) => makeColorRow({ ...c })));
      })
      .catch((err) => {
        console.error("Failed to load colors", err);
        toast.error("Failed to load color variants");
      })
      .finally(() => {
        if (!cancelled) setColorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const addColorRow = () => setColors((prev) => [...prev, makeColorRow({ sortOrder: prev.length })]);

  const removeColorRow = (key: string) => setColors((prev) => prev.filter((c) => c.key !== key));

  const updateColorRow = (key: string, patch: Partial<ColorRow>) =>
    setColors((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const handleColorImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = pendingColorUploadKey.current;
    e.target.value = "";
    pendingColorUploadKey.current = null;
    if (!file || !key) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    setUploadingColorKey(key);
    try {
      const { blob, extension } = await compressImage(file);
      const url = await uploadProductImage(`${pendingId}-color`, blob, extension);
      updateColorRow(key, { image: url });
      toast.success("Color image uploaded");
    } catch (err) {
      console.error("Color image upload failed", err);
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploadingColorKey(null);
    }
  };

  const triggerColorImagePick = (key: string) => {
    pendingColorUploadKey.current = key;
    colorFileInputRef.current?.click();
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow picking the same file again later

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    setUploading(true);
    try {
      const { blob, extension } = await compressImage(file);
      const url = await uploadProductImage(pendingId, blob, extension);
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
    const priceNum = Number(price);
    const stockNum = Number(stock);
    const discountNum = discountPercent === "" ? 0 : Number(discountPercent);

    if (!trimmedName) return setError("Name is required.");
    if (!Number.isFinite(priceNum) || priceNum < 0) return setError("Enter a valid price.");
    if (!Number.isInteger(stockNum) || stockNum < 0) return setError("Enter a valid stock quantity.");
    if (!Number.isInteger(discountNum) || discountNum < 0 || discountNum > 100) {
      return setError("Discount must be a whole number between 0 and 100.");
    }
    if (!image) return setError("Please upload a product image.");

    for (const c of colors) {
      if (!c.name.trim()) return setError("Every color needs a name.");
      if (!c.image) return setError(`Please upload an image for "${c.name || "one of the colors"}".`);
      if (!Number.isInteger(c.stock) || c.stock < 0) return setError(`Enter a valid stock quantity for "${c.name}".`);
    }

    setSaving(true);
    const finalId = product?.id ?? pendingId;
    try {
      await onSubmit({
        id: finalId,
        name: trimmedName,
        price: Math.round(priceNum),
        image,
        category,
        description: description.trim(),
        stock: Math.round(stockNum),
        discountPercent: Math.round(discountNum),
      });
      await saveProductColors(
        finalId,
        colors.map((c, i) => ({
          id: c.id,
          name: c.name.trim(),
          hex: c.hex,
          image: c.image,
          stock: Math.round(c.stock),
          sortOrder: i,
        })),
      );
    } catch (err) {
      console.error("Failed to save product", err);
      setError(err instanceof Error ? err.message : "Failed to save product.");
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
              <ProductImage src={image} alt={name || "Product"} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-[10px] text-olive-soft/60">
                No image
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
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
            <Label htmlFor="pf-name">Name</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mini Fox Doll" />
            {!isEditing && (
              <p className="mt-1 text-[11px] text-olive-soft/70">Will be saved as id "{pendingId || "…"}"</p>
            )}
          </div>

          <div>
            <Label htmlFor="pf-price">Price (₹)</Label>
            <Input
              id="pf-price"
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="499"
            />
          </div>

          <div>
            <Label htmlFor="pf-stock">Stock</Label>
            <Input
              id="pf-stock"
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="10"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="pf-discount">Discount (%)</Label>
            <Input
              id="pf-discount"
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="0"
            />
            {Number(discountPercent) > 0 && Number.isFinite(Number(price)) && Number(price) > 0 && (
              <p className="mt-1 text-[11px] text-olive-soft/70">
                Customers pay ₹{Math.round((Number(price) * (100 - Number(discountPercent))) / 100)} instead of ₹
                {Number(price)}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="pf-category">Category</Label>
            <Select id="pf-category" value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="pf-description">Description</Label>
            <Textarea
              id="pf-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A soft amigurumi..."
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Color variants</Label>
            <p className="text-[11px] text-olive-soft/70">
              Optional. Add colors like Red / Blue / Green — each gets its own image and its own stock. Leave empty
              to sell this product as a single item using the image and stock above.
            </p>
          </div>
        </div>

        <input
          ref={colorFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleColorImagePick}
        />

        {colorsLoading ? (
          <p className="mt-3 text-xs text-olive-soft">Loading colors…</p>
        ) : (
          <div className="mt-3 space-y-3">
            {colors.map((c) => (
              <div key={c.key} className="flex gap-3 rounded-xl bg-cream-deep/60 p-3">
                <div className="shrink-0">
                  <div className="h-16 w-16 overflow-hidden rounded-lg bg-cream-deep">
                    {c.image ? (
                      <ProductImage src={c.image} alt={c.name || "Color"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-olive-soft/60">
                        No image
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerColorImagePick(c.key)}
                    disabled={uploadingColorKey === c.key}
                    className="mt-1.5 flex w-16 items-center justify-center gap-1 rounded-full bg-card px-1.5 py-1 text-[10px] font-semibold text-olive disabled:opacity-50"
                  >
                    {uploadingColorKey === c.key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                  </button>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-2">
                  <div className="col-span-2 flex items-center gap-2">
                    <Input
                      value={c.name}
                      onChange={(e) => updateColorRow(c.key, { name: e.target.value })}
                      placeholder="Color name, e.g. Sky Blue"
                      className="flex-1"
                    />
                    <input
                      type="color"
                      value={c.hex ?? "#e5ded0"}
                      onChange={(e) => updateColorRow(c.key, { hex: e.target.value })}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
                      aria-label="Swatch color"
                      title="Swatch color (visual only)"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      min="0"
                      value={c.stock}
                      onChange={(e) => updateColorRow(c.key, { stock: Number(e.target.value) })}
                      placeholder="Stock"
                    />
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => removeColorRow(c.key)}
                      className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1.5 text-[11px] font-semibold text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addColorRow}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-cream-deep px-3 py-1.5 text-xs font-semibold text-olive"
        >
          <Plus className="h-3.5 w-3.5" /> Add color
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving || uploading}>
          {saving ? "Saving…" : isEditing ? "Save changes" : "Add product"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
