import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useBundles } from "@/hooks/useBundles";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { computeCartPricing, discountedPrice, type CartPricing } from "@/lib/pricing";
import type { Bundle, BundleCartItem, CartItem, Product, ProductColor } from "@/types";

export type CartLineItem = {
  product: Product;
  /** The chosen color variant, or null for a product with no colors. */
  color: ProductColor | null;
  quantity: number;
  /** Convenience: color.image ?? product.image */
  image: string;
  /** Convenience: color.stock ?? product.stock */
  availableStock: number;
  /** product.price after product.discountPercent is applied — what the customer actually pays per unit. */
  unitPrice: number;
};

/** A bundle line in the cart — sold as a single unit at bundle.bundlePrice,
 * no color/stock concept (see Bundle type). */
export type BundleLineItem = {
  bundle: Bundle;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (product: Product, colorId: string | null, quantity?: number) => void;
  removeItem: (productId: string, colorId: string | null) => void;
  setQuantity: (productId: string, colorId: string | null, quantity: number) => void;
  bundleItems: BundleCartItem[];
  addBundle: (bundle: Bundle, quantity?: number) => void;
  removeBundle: (bundleId: string) => void;
  setBundleQuantity: (bundleId: string, quantity: number) => void;
  clearCart: () => void;
  lineItems: CartLineItem[];
  bundleLineItems: BundleLineItem[];
  /** Final amount the customer is charged — already reflects whichever of
   * product discounts / the storewide spend-threshold deal is better (see pricing.ts). */
  subtotal: number;
  /** Full pricing breakdown (both subtotals, which discount won, how much more
   * is needed to qualify) — for the cart/checkout promo banner. */
  pricing: CartPricing;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

/** Two cart lines are "the same" only if both product AND color match —
 * Red Duck and Blue Duck are separate lines, each with their own stock
 * ceiling and quantity. */
function sameLine(a: { productId: string; colorId: string | null }, b: { productId: string; colorId: string | null }) {
  return a.productId === b.productId && a.colorId === b.colorId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [bundleItems, setBundleItems] = useState<BundleCartItem[]>([]);
  const { products } = useProducts();
  const { bundles } = useBundles();
  const { settings } = useSiteSettings();

  const addItem = (product: Product, colorId: string | null, quantity = 1) => {
    const color = colorId ? (product.colors.find((c) => c.id === colorId) ?? null) : null;
    const maxQty = color ? color.stock : product.stock;

    setItems((prev) => {
      const existing = prev.find((i) => sameLine(i, { productId: product.id, colorId }));
      if (existing) {
        const nextQty = Math.min(existing.quantity + quantity, maxQty);
        return prev.map((i) => (sameLine(i, existing) ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { productId: product.id, colorId, quantity: Math.min(quantity, maxQty) }];
    });
  };

  const removeItem = (productId: string, colorId: string | null) => {
    setItems((prev) => prev.filter((i) => !sameLine(i, { productId, colorId })));
  };

  const setQuantity = (productId: string, colorId: string | null, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => !sameLine(i, { productId, colorId }));
      const product = products.find((p) => p.id === productId);
      const color = colorId ? product?.colors.find((c) => c.id === colorId) : undefined;
      const maxQty = (colorId ? color?.stock : product?.stock) ?? quantity;
      return prev.map((i) => (sameLine(i, { productId, colorId }) ? { ...i, quantity: Math.min(quantity, maxQty) } : i));
    });
  };

  const addBundle = (bundle: Bundle, quantity = 1) => {
    setBundleItems((prev) => {
      const existing = prev.find((b) => b.bundleId === bundle.id);
      if (existing) {
        return prev.map((b) => (b.bundleId === bundle.id ? { ...b, quantity: b.quantity + quantity } : b));
      }
      return [...prev, { bundleId: bundle.id, quantity }];
    });
  };

  const removeBundle = (bundleId: string) => {
    setBundleItems((prev) => prev.filter((b) => b.bundleId !== bundleId));
  };

  const setBundleQuantity = (bundleId: string, quantity: number) => {
    setBundleItems((prev) => {
      if (quantity <= 0) return prev.filter((b) => b.bundleId !== bundleId);
      return prev.map((b) => (b.bundleId === bundleId ? { ...b, quantity } : b));
    });
  };

  const clearCart = () => {
    setItems([]);
    setBundleItems([]);
  };

  const lineItems = useMemo(
    () =>
      items
        .map((i): CartLineItem | null => {
          const product = products.find((p) => p.id === i.productId);
          if (!product) return null;
          const color = i.colorId ? (product.colors.find((c) => c.id === i.colorId) ?? null) : null;
          // If a color was in the cart but has since been removed by the
          // admin, drop this line rather than show a broken reference.
          if (i.colorId && !color) return null;
          return {
            product,
            color,
            quantity: i.quantity,
            image: color?.image ?? product.image,
            availableStock: color?.stock ?? product.stock,
            unitPrice: discountedPrice(product.price, product.discountPercent),
          };
        })
        .filter((x): x is CartLineItem => x !== null),
    [items, products],
  );

  const bundleLineItems = useMemo(
    () =>
      bundleItems
        .map((b): BundleLineItem | null => {
          const bundle = bundles.find((bd) => bd.id === b.bundleId);
          // If a bundle was in the cart but has since been archived by the
          // admin, drop this line rather than show a broken reference.
          if (!bundle) return null;
          return { bundle, quantity: b.quantity };
        })
        .filter((x): x is BundleLineItem => x !== null),
    [bundleItems, bundles],
  );

  const pricing = useMemo(
    () => computeCartPricing(lineItems, bundleLineItems, settings),
    [lineItems, bundleLineItems, settings],
  );

  const subtotal = pricing.finalSubtotal;

  const itemCount = useMemo(
    () =>
      items.reduce((sum, i) => sum + i.quantity, 0) + bundleItems.reduce((sum, b) => sum + b.quantity, 0),
    [items, bundleItems],
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        setQuantity,
        bundleItems,
        addBundle,
        removeBundle,
        setBundleQuantity,
        clearCart,
        lineItems,
        bundleLineItems,
        subtotal,
        pricing,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
