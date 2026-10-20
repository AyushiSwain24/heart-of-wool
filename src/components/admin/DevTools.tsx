import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Dev-only admin tab — see Admin.tsx's DEV_TOOLS_ENABLED for the gate that
 * keeps this out of any real deployment (import.meta.env.DEV is stripped
 * entirely from `vite build` output, and it additionally requires Supabase
 * to be unconfigured, so there's no path by which a real database is ever
 * reachable from here).
 *
 * This intentionally does NOT duplicate the Products/Bundles/Settings tabs
 * — those already ARE the create/edit/archive UI, and the admin login gate
 * (see the isSupabaseConfigured check in Admin.tsx) now auto-authenticates
 * in mock mode instead of getting stuck on an unpassable login form, so
 * they're already reachable directly from the main tab bar. This tab is
 * just the one genuinely new thing: a loud reminder of what mode you're in,
 * and a way back to a clean slate.
 */
export function DevTools() {
  const handleReset = () => {
    // Mock data (src/data/products.ts, bundles.ts, siteSettings.ts) is a
    // set of plain module-level arrays/objects mutated in place by the
    // *AdminStore.ts files. There's no separate "seed vs. current" copy to
    // reset from — the array literal in the source file only reflects the
    // original values until the module is first mutated. A full reload
    // re-evaluates those modules from scratch, which is the only way back
    // to the seeded state without maintaining a second copy of the data.
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-destructive">Dev tools — local mock data only</p>
          <p className="mt-1 text-xs leading-relaxed text-destructive/80">
            This tab only exists in a local dev build with no Supabase project configured — it never ships to
            production and can never reach a real database. The Products, Bundles, and Settings tabs above are
            reading and writing the same in-memory mock data the storefront falls back to when Supabase isn't set
            up. Any changes you make there reset the moment you reload the page — use the button below to force
            that reset back to the seeded starting data on demand.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="mt-3 flex items-center gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset mock data to seed values
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 text-xs leading-relaxed text-olive-soft shadow-soft">
        <p className="font-semibold text-olive">Where to look</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong className="text-olive">Products / Bundles / Settings tabs</strong> — full create, edit, archive,
            and restore, same UI a real deployment uses, just pointed at mock data.
          </li>
          <li>
            <strong className="text-olive">Storefront</strong> — browse as a shopper in another tab; changes here
            show up there (the product/bundle caches are invalidated on every save).
          </li>
          <li>
            <strong className="text-olive">Orders tab</strong> — place a test order from checkout, then confirm
            payment / change status here, same as you would with real orders.
          </li>
        </ul>
      </div>
    </div>
  );
}
