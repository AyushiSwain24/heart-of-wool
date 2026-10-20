import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { bundles as mockBundles } from "@/data/bundles";
import { products as mockProducts } from "@/data/products";
import type { Bundle } from "@/types";

/**
 * Admin-only bundle management layer — same shape as productAdminStore.ts:
 * talks to Supabase's SECURITY DEFINER admin_* functions (see
 * supabase/migration_007_bundles.sql) when configured, otherwise mutates
 * an in-memory mock array so the admin UI stays usable before Supabase
 * is wired up.
 */

export type BundleItemInput = {
  productId: string;
  quantity: number;
  sortOrder: number;
};

export type BundleInput = {
  id?: string;
  name: string;
  description: string;
  image: string;
  bundlePrice: number;
  items: BundleItemInput[];
};

function mapRow(row: Record<string, unknown>): Bundle {
  const rawItems = (row.items as Record<string, unknown>[] | null) ?? [];
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    image: row.image as string,
    bundlePrice: row.bundle_price as number,
    sortOrder: (row.sort_order as number) ?? 0,
    items: rawItems.map((i) => ({
      productId: i.product_id as string,
      name: i.name as string,
      image: i.image as string,
      price: i.price as number,
      quantity: i.quantity as number,
    })),
    isActive: (row.is_active as boolean) ?? true,
  };
}

/** Fills in name/image/price for each bundle item from the current mock
 * product catalog — used only on the mock (no-Supabase) path, mirroring
 * what list_active_bundles_with_items() does server-side. */
function hydrateMockItems(items: BundleItemInput[]) {
  return items.map((i) => {
    const product = mockProducts.find((p) => p.id === i.productId);
    return {
      productId: i.productId,
      name: product?.name ?? i.productId,
      image: product?.image ?? "",
      price: product?.price ?? 0,
      quantity: i.quantity,
    };
  });
}

/** Lists ALL bundles, including archived ones — for the admin list view.
 * (Unlike the storefront's list_active_bundles_with_items(), this needs
 * its own admin RPC since it must see inactive bundles too.) admin_list_
 * bundle_items() only returns product_id/quantity/sort_order (see
 * migration_007), so this looks up name/image/price from the admin
 * product list (which sees archived products too, unlike the public
 * catalog) rather than assuming every bundled product is still active. */
export async function fetchAdminBundles(): Promise<Bundle[]> {
  if (isSupabaseConfigured && supabase) {
    const [{ data: bundleRows, error }, { data: productRows, error: productsError }] = await Promise.all([
      supabase.rpc("admin_list_bundles"),
      supabase.rpc("admin_list_products"),
    ]);
    if (error) throw error;
    if (productsError) throw productsError;

    const productById = new Map(
      ((productRows ?? []) as Array<Record<string, unknown>>).map((p) => [p.id as string, p]),
    );

    const rows = (bundleRows ?? []) as Array<Record<string, unknown>>;
    const withItems = await Promise.all(
      rows.map(async (b) => {
        const { data: items, error: itemsError } = await supabase!.rpc("admin_list_bundle_items", {
          p_bundle_id: b.id,
        });
        if (itemsError) throw itemsError;

        const itemRows = (items ?? []) as Array<Record<string, unknown>>;
        return mapRow({
          ...b,
          items: itemRows.map((i) => {
            const product = productById.get(i.product_id as string);
            return {
              product_id: i.product_id,
              name: (product?.name as string | undefined) ?? (i.product_id as string),
              image: (product?.image as string | undefined) ?? "",
              price: (product?.price as number | undefined) ?? 0,
              quantity: i.quantity,
            };
          }),
        });
      }),
    );
    return withItems;
  }

  return [...mockBundles];
}

export async function createBundle(input: BundleInput): Promise<Bundle> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("admin_create_bundle", {
      p_name: input.name,
      p_description: input.description,
      p_image: input.image,
      p_bundle_price: input.bundlePrice,
      p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity, sort_order: i.sortOrder })),
    });
    if (error) throw error;
    return mapRow(data as Record<string, unknown>);
  }

  const bundle: Bundle = {
    id: `bundle-${crypto.randomUUID()}`,
    name: input.name,
    description: input.description,
    image: input.image,
    bundlePrice: input.bundlePrice,
    sortOrder: mockBundles.length,
    items: hydrateMockItems(input.items),
    isActive: true,
  };
  mockBundles.push(bundle);
  return bundle;
}

export async function updateBundle(input: BundleInput): Promise<Bundle> {
  if (!input.id) throw new Error("Cannot update a bundle without an id");

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("admin_update_bundle", {
      p_id: input.id,
      p_name: input.name,
      p_description: input.description,
      p_image: input.image,
      p_bundle_price: input.bundlePrice,
      p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity, sort_order: i.sortOrder })),
    });
    if (error) throw error;
    return mapRow(data as Record<string, unknown>);
  }

  const existing = mockBundles.find((b) => b.id === input.id);
  if (!existing) throw new Error(`Bundle ${input.id} does not exist`);
  existing.name = input.name;
  existing.description = input.description;
  existing.image = input.image;
  existing.bundlePrice = input.bundlePrice;
  existing.items = hydrateMockItems(input.items);
  return existing;
}

export async function setBundleActive(id: string, active: boolean): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc("admin_set_bundle_active", { p_id: id, p_active: active });
    if (error) throw error;
    return;
  }

  const existing = mockBundles.find((b) => b.id === id);
  if (!existing) throw new Error(`Bundle ${id} does not exist`);
  existing.isActive = active;
}
