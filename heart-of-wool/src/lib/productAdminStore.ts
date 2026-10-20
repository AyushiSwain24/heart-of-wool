import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { mapSupabaseProduct } from "@/hooks/useProducts";
import { products as mockProducts } from "@/data/products";
import type { CategoryId, Product, ProductColor } from "@/types";

/**
 * Admin-only product management layer. Talks to Supabase's SECURITY
 * DEFINER admin_* functions (see supabase/migration_002_admin_products.sql)
 * so the admin UI can see archived products and write to the catalog
 * without needing a public write policy on `products` directly.
 *
 * Falls back to mutating the in-memory mock array when Supabase isn't
 * configured, so the admin UI is still usable (per-tab, non-persistent)
 * before Supabase is wired up.
 */

export type ProductInput = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: CategoryId;
  description: string;
  stock: number;
  /** 0-100. 0 = no discount. */
  discountPercent: number;
};

/** One color row as edited in the admin form — `id` is null/undefined for
 * a color the admin just added that doesn't exist in the database yet. */
export type ProductColorInput = {
  id?: string | null;
  name: string;
  hex: string | null;
  image: string;
  stock: number;
  sortOrder: number;
};

/** Lists ALL products, including archived ones — for the admin list view. */
export async function fetchAdminProducts(): Promise<Product[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("admin_list_products");
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapSupabaseProduct);
  }

  return [...mockProducts].sort((a, b) => a.id.localeCompare(b.id));
}

export async function createProduct(input: ProductInput): Promise<Product> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("admin_create_product", {
      p_id: input.id,
      p_name: input.name,
      p_price: input.price,
      p_image: input.image,
      p_category: input.category,
      p_description: input.description,
      p_stock: input.stock,
      p_discount_percent: input.discountPercent,
    });
    if (error) throw error;
    return mapSupabaseProduct(data as Record<string, unknown>);
  }

  if (mockProducts.some((p) => p.id === input.id)) {
    throw new Error(`Product id "${input.id}" already exists.`);
  }
  const product: Product = { ...input, isActive: true, colors: [] };
  mockProducts.push(product);
  return product;
}

export async function updateProduct(input: ProductInput): Promise<Product> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("admin_update_product", {
      p_id: input.id,
      p_name: input.name,
      p_price: input.price,
      p_image: input.image,
      p_category: input.category,
      p_description: input.description,
      p_stock: input.stock,
      p_discount_percent: input.discountPercent,
    });
    if (error) throw error;
    return mapSupabaseProduct(data as Record<string, unknown>);
  }

  const existing = mockProducts.find((p) => p.id === input.id);
  if (!existing) throw new Error(`Product ${input.id} does not exist`);
  Object.assign(existing, input);
  return existing;
}

export async function setProductActive(id: string, active: boolean): Promise<Product> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("admin_set_product_active", {
      p_id: id,
      p_active: active,
    });
    if (error) throw error;
    return mapSupabaseProduct(data as Record<string, unknown>);
  }

  const existing = mockProducts.find((p) => p.id === id);
  if (!existing) throw new Error(`Product ${id} does not exist`);
  existing.isActive = active;
  return existing;
}

/**
 * Uploads an already-compressed image blob to the `product-images` Storage
 * bucket and returns its public URL. Path is namespaced by product id so
 * re-uploading for the same product is easy to reason about; a timestamp
 * suffix avoids stale-CDN-cache issues when an image is replaced.
 */
export async function uploadProductImage(productId: string, file: Blob, extension: string): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    // No backend configured — return a local object URL so the admin UI
    // still shows a preview in mock mode (won't persist across reloads).
    return URL.createObjectURL(file);
  }

  const path = `${productId}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "31536000",
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

/** Fetches the current color variants for a product — used to prefill the
 * admin edit form. Returns [] in mock mode / when the product has none. */
export async function fetchProductColors(productId: string): Promise<ProductColor[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("admin_list_product_colors", { p_product_id: productId });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
        hex: (row.hex as string | null) ?? null,
        image: row.image as string,
        stock: row.stock as number,
        sortOrder: (row.sort_order as number) ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const product = mockProducts.find((p) => p.id === productId);
  return product?.colors ?? [];
}

/** Replaces the full set of color variants for a product in one call —
 * upserts everything passed in and deletes any existing color not present
 * in the list (i.e. the admin removed it in the form). */
export async function saveProductColors(productId: string, colors: ProductColorInput[]): Promise<ProductColor[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("admin_set_product_colors", {
      p_product_id: productId,
      p_colors: colors.map((c) => ({
        id: c.id ?? null,
        name: c.name,
        hex: c.hex,
        image: c.image,
        stock: c.stock,
        sort_order: c.sortOrder,
      })),
    });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
        hex: (row.hex as string | null) ?? null,
        image: row.image as string,
        stock: row.stock as number,
        sortOrder: (row.sort_order as number) ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const product = mockProducts.find((p) => p.id === productId);
  if (!product) throw new Error(`Product ${productId} does not exist`);
  product.colors = colors.map((c, i) => ({
    id: c.id ?? `${productId}-color-${crypto.randomUUID()}`,
    name: c.name,
    hex: c.hex,
    image: c.image,
    stock: c.stock,
    sortOrder: c.sortOrder ?? i,
  }));
  return product.colors;
}

/** Generates a URL-safe slug id from a product name, e.g. "Mini Fox Doll" -> "mini-fox-doll". */
export function slugifyProductName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
