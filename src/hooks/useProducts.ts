import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { products as mockProducts } from "@/data/products";
import type { Product, ProductColor } from "@/types";

type ProductsState = {
  products: Product[];
  loading: boolean;
  error: string | null;
  /** true when data came from the static mock file rather than Supabase */
  isMock: boolean;
};

/**
 * Module-level cache shared by every useProducts() call, so navigating
 * between pages (Home -> ProductDetail -> Cart, etc.) doesn't re-fetch
 * the whole catalog from Supabase on every single page and doesn't show
 * a "Loading products…" flash every time you open a product that was
 * already loaded elsewhere. Each component instance still gets its own
 * loading/error state for its OWN first load, but once any one of them
 * has successfully fetched, all others reuse that result immediately.
 */
let cachedProducts: Product[] | null = null;
let inFlightRequest: Promise<void> | null = null;

/** Maps a raw Supabase product_colors row (snake_case) to ProductColor. */
function mapSupabaseColor(row: Record<string, unknown>): ProductColor {
  return {
    id: row.id as string,
    name: row.name as string,
    hex: (row.hex as string | null) ?? null,
    image: row.image as string,
    stock: row.stock as number,
    sortOrder: (row.sort_order as number) ?? 0,
  };
}

/** Maps a raw Supabase products row (snake_case) to the app's Product type.
 * `colorsRow` is the embedded product_colors[] Supabase returns when the
 * select includes the relationship — omit it (or pass []) for a plain
 * colorless product. */
function mapSupabaseProduct(row: Record<string, unknown>): Product {
  const rawColors = (row.product_colors as Record<string, unknown>[] | undefined) ?? [];
  return {
    id: row.id as string,
    name: row.name as string,
    price: row.price as number,
    image: row.image as string,
    category: row.category as Product["category"],
    description: row.description as string,
    stock: row.stock as number,
    isActive: (row.is_active as boolean) ?? true,
    colors: rawColors.map(mapSupabaseColor).sort((a, b) => a.sortOrder - b.sortOrder),
    discountPercent: (row.discount_percent as number) ?? 0,
  };
}

async function fetchProducts(): Promise<{ products: Product[]; isMock: boolean; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { products: mockProducts, isMock: true, error: null };
  }

  // Public storefront only ever shows active products. The "public can read
  // active products" RLS policy (see supabase/migration_002_admin_products.sql)
  // also enforces this at the database level as defense in depth, but we
  // filter explicitly here too so behavior doesn't depend solely on RLS.
  // product_colors(*) pulls in each product's color variants (if any) in
  // the same request — see migration_005_product_colors.sql.
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, image, category, description, stock, is_active, discount_percent, product_colors(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load products from Supabase", error);
    // Fall back to mock data rather than showing an empty shop.
    return { products: mockProducts, isMock: true, error: error.message };
  }

  return {
    products: (data ?? []).map((row) => mapSupabaseProduct(row as Record<string, unknown>)),
    isMock: false,
    error: null,
  };
}

/**
 * Loads the product catalog from Supabase when configured, otherwise
 * falls back to the local dummy data in src/data/products.ts so the app
 * keeps working before Supabase is wired up. Shares a cache across all
 * callers (see module-level cache above) — only the very first call in
 * the whole app triggers a network request.
 */
export function useProducts(): ProductsState {
  const [state, setState] = useState<ProductsState>(() => {
    if (cachedProducts) {
      return { products: cachedProducts, loading: false, error: null, isMock: !isSupabaseConfigured };
    }
    if (!isSupabaseConfigured) {
      cachedProducts = mockProducts;
      return { products: mockProducts, loading: false, error: null, isMock: true };
    }
    return { products: [], loading: true, error: null, isMock: false };
  });

  useEffect(() => {
    if (cachedProducts) return; // already resolved (possibly by another instance)

    let cancelled = false;

    if (!inFlightRequest) {
      inFlightRequest = fetchProducts().then((result) => {
        cachedProducts = result.products;
        inFlightRequest = null;
        if (!cancelled) {
          setState({ products: result.products, loading: false, error: result.error, isMock: result.isMock });
        }
      });
    } else {
      // Another instance already kicked off the fetch — just wait on it.
      inFlightRequest.then(() => {
        if (!cancelled && cachedProducts) {
          setState({ products: cachedProducts, loading: false, error: null, isMock: !isSupabaseConfigured });
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Call after place_order succeeds so newly-decremented stock is reflected
 * without waiting for a full page reload (e.g. after checkout). Also call
 * this after any admin create/update/archive so the storefront picks up
 * the change on next navigation instead of showing stale cached data. */
export function invalidateProductsCache() {
  cachedProducts = null;
}

export { mapSupabaseProduct };
