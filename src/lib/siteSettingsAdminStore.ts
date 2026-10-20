import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { siteSettings as mockSiteSettings } from "@/data/siteSettings";
import type { SiteSettings } from "@/types";

/** Admin-only settings write — same shape as productAdminStore.ts /
 * bundleAdminStore.ts: calls the SECURITY DEFINER admin_update_site_settings()
 * function (see supabase/migration_008_spend_discount.sql) when configured,
 * otherwise mutates the in-memory mock object so the admin UI stays usable
 * before Supabase is wired up. */
export async function updateSiteSettings(input: SiteSettings): Promise<SiteSettings> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("admin_update_site_settings", {
      p_spend_discount_enabled: input.spendDiscountEnabled,
      p_spend_discount_threshold: input.spendDiscountThreshold,
      p_spend_discount_amount: input.spendDiscountAmount,
    });
    if (error) throw error;
    const row = data as Record<string, unknown>;
    return {
      spendDiscountEnabled: row.spend_discount_enabled as boolean,
      spendDiscountThreshold: row.spend_discount_threshold as number,
      spendDiscountAmount: row.spend_discount_amount as number,
    };
  }

  mockSiteSettings.spendDiscountEnabled = input.spendDiscountEnabled;
  mockSiteSettings.spendDiscountThreshold = input.spendDiscountThreshold;
  mockSiteSettings.spendDiscountAmount = input.spendDiscountAmount;
  return { ...mockSiteSettings };
}
