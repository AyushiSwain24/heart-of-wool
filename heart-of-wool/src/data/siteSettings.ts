import type { SiteSettings } from "@/types";

/**
 * Mock storewide settings for local-dev / mock mode (no Supabase configured).
 * Mutated in place by the admin mock path in siteSettingsStore.ts, mirroring
 * how data/products.ts and data/bundles.ts work.
 */
export const siteSettings: SiteSettings = {
  spendDiscountEnabled: false,
  spendDiscountThreshold: 1000,
  spendDiscountAmount: 0,
};
