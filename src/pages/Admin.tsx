import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, LogOut, Loader2 } from "lucide-react";
import { getAllOrders, markPaymentConfirmed, updateOrderStatus } from "@/lib/orderStore";
import { getAdminSession, signInAdmin, signOutAdmin } from "@/lib/adminAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { Order, OrderStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ProductManager } from "@/components/admin/ProductManager";
import { BundleManager } from "@/components/admin/BundleManager";
import { SiteSettingsManager } from "@/components/admin/SiteSettingsManager";
import { DevTools } from "@/components/admin/DevTools";
import { cn } from "@/lib/utils";

// Dev Tools is only ever reachable when running a local dev build (not a
// production bundle — import.meta.env.DEV is compiled away entirely by
// Vite in `vite build`) AND Supabase isn't configured, so there is no path
// by which a real deployment with a real database could expose it. See
// DevTools.tsx for what it resets/shows.
const DEV_TOOLS_ENABLED = import.meta.env.DEV && !isSupabaseConfigured;

const statusOptions: OrderStatus[] = ["placed", "packed", "shipped", "delivered", "cancelled"];

const statusStyles: Record<OrderStatus, string> = {
  placed: "bg-cream-deep text-olive-soft",
  packed: "bg-amber-100 text-amber-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

export function Admin() {
  const [searchParams] = useSearchParams();
  // Deep-link support: /admin?order=HOW-1234 (used by the "View in Admin"
  // button in new-order notification emails) opens straight to Orders with
  // that order pre-searched and highlighted, instead of dropping the
  // owner on a generic list they then have to search themselves.
  const linkedOrderNumber = searchParams.get("order")?.trim() ?? "";

  const [checkingSession, setCheckingSession] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(linkedOrderNumber);
  const [tab, setTab] = useState<"orders" | "products" | "bundles" | "settings" | "dev">("orders");

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getAllOrders();
      setOrders(data);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  // Restore an existing login on page load/refresh, and stay in sync if
  // the session is signed out elsewhere (e.g. token expiry).
  //
  // In mock mode (no Supabase configured) there is no real backend to
  // protect and no way to ever sign in — getAdminSession() always returns
  // null there, which used to leave the admin panel permanently stuck on
  // an unpassable login form. Treat mock mode as auto-authed instead, so
  // Products/Bundles/Settings/Dev Tools are reachable while developing.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthed(true);
      setCheckingSession(false);
      return;
    }

    let cancelled = false;

    getAdminSession().then((session) => {
      if (!cancelled) {
        setAuthed(Boolean(session));
        setCheckingSession(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authed) loadOrders();
  }, [authed]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setError("");
    const { error: loginError } = await signInAdmin(email.trim(), password);
    if (loginError) {
      setError(loginError);
    } else {
      setPassword("");
    }
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    await signOutAdmin();
    setOrders([]);
    setEmail("");
    setPassword("");
  };

  if (checkingSession) {
    return (
      <div className="mx-auto max-w-sm px-5 py-16 text-center text-olive-soft">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm px-5 py-16">
        <h1 className="font-serif text-2xl text-olive">Admin Login</h1>
        <p className="mt-2 text-xs text-olive-soft">Sign in with your shop owner account.</p>
        <form onSubmit={handleLogin} className="mt-5 space-y-3">
          <div>
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loggingIn}>
            {loggingIn ? "Signing in…" : "Log in"}
          </Button>
        </form>
      </div>
    );
  }

  const handleStatusChange = async (order: Order, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      await updateOrderStatus(order.id, status);
    } catch (err) {
      console.error("Failed to update status", err);
      loadOrders(); // re-sync with server state on failure
    }
  };

  const handleTogglePayment = async (order: Order) => {
    const next = !order.paymentConfirmed;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, paymentConfirmed: next } : o)));
    try {
      await markPaymentConfirmed(order.id, next);
    } catch (err) {
      console.error("Failed to update payment status", err);
      loadOrders();
    }
  };

  const filteredOrders = search.trim()
    ? orders.filter((o) => {
        const q = search.trim().toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.phone.includes(q)
        );
      })
    : orders;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-olive">Admin</h1>
          <p className="mt-1 text-sm text-olive-soft">
            {tab === "orders"
              ? loading
                ? "Loading…"
                : `${orders.length} order(s) so far.`
              : tab === "settings"
                ? "Configure storewide deals."
                : tab === "dev"
                  ? "Local dev utilities."
                  : "Manage your catalog."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "orders" && (
            <button
              onClick={loadOrders}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full bg-cream-deep px-3 py-1.5 text-xs font-semibold text-olive disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
            </button>
          )}
          {isSupabaseConfigured && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-full bg-cream-deep px-3 py-1.5 text-xs font-semibold text-olive"
            >
              <LogOut className="h-3.5 w-3.5" /> Log out
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-2 border-b border-input">
        <button
          onClick={() => setTab("orders")}
          className={cn(
            "px-3 pb-2.5 text-xs font-semibold tracking-wide uppercase",
            tab === "orders" ? "border-b-2 border-pink text-olive" : "text-olive-soft/70",
          )}
        >
          Orders
        </button>
        <button
          onClick={() => setTab("products")}
          className={cn(
            "px-3 pb-2.5 text-xs font-semibold tracking-wide uppercase",
            tab === "products" ? "border-b-2 border-pink text-olive" : "text-olive-soft/70",
          )}
        >
          Products
        </button>
        <button
          onClick={() => setTab("bundles")}
          className={cn(
            "px-3 pb-2.5 text-xs font-semibold tracking-wide uppercase",
            tab === "bundles" ? "border-b-2 border-pink text-olive" : "text-olive-soft/70",
          )}
        >
          Bundles
        </button>
        <button
          onClick={() => setTab("settings")}
          className={cn(
            "px-3 pb-2.5 text-xs font-semibold tracking-wide uppercase",
            tab === "settings" ? "border-b-2 border-pink text-olive" : "text-olive-soft/70",
          )}
        >
          Settings
        </button>
        {DEV_TOOLS_ENABLED && (
          <button
            onClick={() => setTab("dev")}
            className={cn(
              "px-3 pb-2.5 text-xs font-semibold tracking-wide uppercase",
              tab === "dev" ? "border-b-2 border-destructive text-destructive" : "text-destructive/60",
            )}
          >
            Dev Tools
          </button>
        )}
      </div>

      {tab === "dev" && DEV_TOOLS_ENABLED ? (
        <div className="mt-6">
          <DevTools />
        </div>
      ) : tab === "products" ? (
        <div className="mt-6">
          <ProductManager />
        </div>
      ) : tab === "bundles" ? (
        <div className="mt-6">
          <BundleManager />
        </div>
      ) : tab === "settings" ? (
        <div className="mt-6">
          <SiteSettingsManager />
        </div>
      ) : (
        <>
          {orders.length > 0 && (
            <Input
              className="mt-4"
              placeholder="Search by order number, name, email or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}

          {!loading && orders.length === 0 ? (
            <p className="mt-8 text-sm text-olive-soft">No orders placed yet — try checking out from the shop.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {filteredOrders.map((order) => (
            <div
              key={order.id}
              className={cn(
                "rounded-2xl bg-card p-5 shadow-soft",
                linkedOrderNumber &&
                  order.orderNumber.toLowerCase() === linkedOrderNumber.toLowerCase() &&
                  "ring-2 ring-pink ring-offset-2 ring-offset-cream",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-olive">{order.orderNumber}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusStyles[order.status],
                      )}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-olive-soft">
                    {order.customerName} · {order.email} · {order.phone}
                  </p>
                  <p className="text-xs text-olive-soft">
                    {order.address}, {order.city} {order.pincode}
                  </p>
                </div>
                <p className="text-sm font-medium text-olive">₹{order.subtotal}</p>
              </div>

              <div className="mt-3 space-y-1 text-xs text-olive-soft">
                {order.items.map((item, i) => (
                  <div key={`${item.productId ?? item.bundleId ?? "item"}:${item.colorId ?? ""}:${i}`}>
                    {item.name}
                    {item.colorName ? ` (${item.colorName})` : ""}
                    {item.bundleId ? " (Bundle)" : ""} × {item.quantity} — ₹{item.price * item.quantity}
                  </div>
                ))}
              </div>

              {order.notes && <p className="mt-2 text-xs text-olive-soft italic">Note: {order.notes}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div>
                  <label className="mr-2 text-xs font-semibold text-olive uppercase">Status</label>
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order, e.target.value as OrderStatus)}
                    className="rounded-full border border-input bg-card px-3 py-1.5 text-xs text-olive"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handleTogglePayment(order)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold uppercase",
                    order.paymentConfirmed ? "bg-pink text-primary-foreground" : "bg-cream-deep text-olive-soft",
                  )}
                >
                  {order.paymentMethod === "upi" ? "UPI" : "COD"} —{" "}
                  {order.paymentConfirmed ? "Confirmed" : "Mark as confirmed"}
                </button>
              </div>
            </div>
          ))}

          {filteredOrders.length === 0 && (
            <p className="mt-8 text-sm text-olive-soft">No orders match "{search}".</p>
          )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
