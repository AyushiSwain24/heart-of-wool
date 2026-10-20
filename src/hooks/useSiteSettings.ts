import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { siteSettings as mockSiteSettings } from "@/data/siteSettings";
import type { SiteSettings } from "@/types";

type SiteSettingsState = {
  settings: SiteSettings;
  loading: boolean;
};

const FALLBACK: SiteSettings = {
  spendDiscountEnabled: false,
  spendDiscountThreshold: 1000,
  spendDiscountAmount: 0,
};

/** Same module-level cache pattern as useProducts()/useBundles() — see
 * useProducts.ts for why (avoids a refetch/loading-flash on every page nav). */
let cachedSettings: SiteSettings | null = null;
let inFlightRequest: Promise<void> | null = null;

function mapSupabaseSettings(row: Record<string, unknown>): SiteSettings {
  return {
    spendDiscountEnabled: (row.spend_discount_enabled as boolean) ?? false,
    spendDiscountThreshold: (row.spend_discount_threshold as number) ?? 1000,
    spendDiscountAmount: (row.spend_discount_amount as number) ?? 0,
  };
}

async function fetchSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured || !supabase) {
    return mockSiteSettings;
  }

  const { data, error } = await supabase
    .from("site_settings")
    .select("spend_discount_enabled, spend_discount_threshold, spend_discount_amount")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to load site settings from Supabase", error);
    // Fail safe: no storewide discount rather than breaking checkout.
    return FALLBACK;
  }

  return mapSupabaseSettings(data as Record<string, unknown>);
}

/** Loads the single storewide settings row (currently just the spend-threshold
 * discount config) so the cart/checkout can preview which discount applies
 * before the order is placed. The server (place_order) remains the source of
 * truth/enforcement — this is display-only, same spirit as pricing.ts. */
export function useSiteSettings(): SiteSettingsState {
  const [state, setState] = useState<SiteSettingsState>(() => {
    if (cachedSettings) return { settings: cachedSettings, loading: false };
    if (!isSupabaseConfigured) {
      cachedSettings = mockSiteSettings;
      return { settings: mockSiteSettings, loading: false };
    }
    return { settings: FALLBACK, loading: true };
  });

  useEffect(() => {
    if (cachedSettings) return;

    let cancelled = false;

    if (!inFlightRequest) {
      inFlightRequest = fetchSettings().then((settings) => {
        cachedSettings = settings;
        inFlightRequest = null;
        if (!cancelled) setState({ settings, loading: false });
      });
    } else {
      inFlightRequest.then(() => {
        if (!cancelled && cachedSettings) setState({ settings: cachedSettings, loading: false });
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Call after an admin updates the settings so other tabs/pages pick up the
 * change on next navigation instead of showing stale cached data. */
export function invalidateSiteSettingsCache() {
  cachedSettings = null;
}
