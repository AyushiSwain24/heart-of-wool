import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { bundles as mockBundles } from "@/data/bundles";
import type { Bundle } from "@/types";

type BundlesState = {
  bundles: Bundle[];
  loading: boolean;
  error: string | null;
};

/** Same module-level cache pattern as useProducts() — see that file for
 * why (avoids a refetch/loading-flash on every page navigation). */
let cachedBundles: Bundle[] | null = null;
let inFlightRequest: Promise<void> | null = null;

function mapSupabaseBundle(row: Record<string, unknown>): Bundle {
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
    // list_active_bundles_with_items() only ever returns active bundles,
    // so this is always true here — kept for type parity with the admin view.
    isActive: true,
  };
}

async function fetchBundles(): Promise<{ bundles: Bundle[]; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { bundles: mockBundles.filter((b) => b.isActive), error: null };
  }

  // Single RPC returns every active bundle with its contained products
  // already joined in — see list_active_bundles_with_items() in
  // supabase/migration_007_bundles.sql.
  const { data, error } = await supabase.rpc("list_active_bundles_with_items");

  if (error) {
    console.error("Failed to load bundles from Supabase", error);
    return { bundles: [], error: error.message };
  }

  return {
    bundles: ((data ?? []) as Array<Record<string, unknown>>).map(mapSupabaseBundle),
    error: null,
  };
}

/** Loads active bundles for the storefront's "Bundles & Deals" section.
 * Falls back to [] (not mock data) when Supabase errors, so a bundles
 * outage never breaks the rest of the shop — the section just doesn't
 * render (see BundleSection). */
export function useBundles(): BundlesState {
  const [state, setState] = useState<BundlesState>(() => {
    if (cachedBundles) return { bundles: cachedBundles, loading: false, error: null };
    if (!isSupabaseConfigured) {
      const active = mockBundles.filter((b) => b.isActive);
      cachedBundles = active;
      return { bundles: active, loading: false, error: null };
    }
    return { bundles: [], loading: true, error: null };
  });

  useEffect(() => {
    if (cachedBundles) return;

    let cancelled = false;

    if (!inFlightRequest) {
      inFlightRequest = fetchBundles().then((result) => {
        cachedBundles = result.bundles;
        inFlightRequest = null;
        if (!cancelled) {
          setState({ bundles: result.bundles, loading: false, error: result.error });
        }
      });
    } else {
      inFlightRequest.then(() => {
        if (!cancelled && cachedBundles) {
          setState({ bundles: cachedBundles, loading: false, error: null });
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Call after place_order succeeds, and after any admin bundle
 * create/update/archive — same reasoning as invalidateProductsCache(). */
export function invalidateBundlesCache() {
  cachedBundles = null;
}
