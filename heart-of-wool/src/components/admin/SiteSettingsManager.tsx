import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useSiteSettings, invalidateSiteSettingsCache } from "@/hooks/useSiteSettings";
import { updateSiteSettings } from "@/lib/siteSettingsAdminStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { toast } from "sonner";

/**
 * Admin UI for the single storewide "spend ₹X, get ₹Y off" deal (see
 * migration_008_spend_discount.sql). This never stacks with per-product
 * discounts — place_order() always charges whichever is better for the
 * customer, so the copy here is upfront about that instead of implying
 * they combine.
 */
export function SiteSettingsManager() {
  const { settings, loading } = useSiteSettings();
  const [enabled, setEnabled] = useState(settings.spendDiscountEnabled);
  const [threshold, setThreshold] = useState(String(settings.spendDiscountThreshold));
  const [amount, setAmount] = useState(String(settings.spendDiscountAmount));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sync local form state once the real settings load in (loading starts
  // true when Supabase is configured, so the form is empty/default until then).
  useEffect(() => {
    setEnabled(settings.spendDiscountEnabled);
    setThreshold(String(settings.spendDiscountThreshold));
    setAmount(String(settings.spendDiscountAmount));
  }, [settings]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const thresholdNum = Number(threshold);
    const amountNum = Number(amount);

    if (!Number.isFinite(thresholdNum) || thresholdNum < 0) return setError("Enter a valid spend threshold.");
    if (!Number.isFinite(amountNum) || amountNum < 0) return setError("Enter a valid discount amount.");

    setSaving(true);
    try {
      await updateSiteSettings({
        spendDiscountEnabled: enabled,
        spendDiscountThreshold: Math.round(thresholdNum),
        spendDiscountAmount: Math.round(amountNum),
      });
      invalidateSiteSettingsCache();
      toast.success("Settings saved");
    } catch (err) {
      console.error("Failed to save site settings", err);
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-olive-soft">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-2xl bg-card p-5 shadow-soft">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-olive">
          <Sparkles className="h-4 w-4 text-pink-deep" /> Storewide Spend Discount
        </p>
        <p className="mt-1 text-xs text-olive-soft">
          A single deal for the whole shop: "spend ₹X or more, get ₹Y off." This does not stack with per-product
          discounts — every order automatically gets whichever gives the customer the better price.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-olive"
      >
        <span
          className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
            enabled ? "justify-end bg-pink" : "justify-start bg-cream-deep"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-card shadow" />
        </span>
        {enabled ? "Enabled" : "Disabled"}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ss-threshold">Spend at least (₹)</Label>
          <Input
            id="ss-threshold"
            type="number"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="1000"
          />
        </div>
        <div>
          <Label htmlFor="ss-amount">Discount (₹)</Label>
          <Input
            id="ss-amount"
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100"
          />
        </div>
      </div>

      {Number.isFinite(Number(threshold)) && Number.isFinite(Number(amount)) && Number(amount) > 0 && (
        <p className="text-[11px] text-olive-soft/70">
          Preview: "Spend ₹{Math.round(Number(threshold))}+, get ₹{Math.round(Number(amount))} off your order."
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
