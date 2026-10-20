export type CategoryId = "crochet-dolls" | "resin-charms" | "crochet-charms" | "crochet-keychains";

export type Category = {
  id: CategoryId;
  label: string;
  description: string;
};

/**
 * One color variant of a product — its own image and its own stock, so
 * e.g. "Yellow" selling out doesn't block "Blue". Optional: a product
 * with an empty `colors` array is sold as a single plain item, using the
 * product's own image/stock, exactly as before colors existed.
 */
export type ProductColor = {
  id: string;
  name: string;
  /** Optional swatch color for the color picker UI, e.g. "#f5c542". */
  hex: string | null;
  image: string;
  stock: number;
  sortOrder: number;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: CategoryId;
  description: string;
  stock: number;
  /** false = archived (hidden from the public shop, kept for order history). */
  isActive: boolean;
  /** Empty when this product has no color variants. */
  colors: ProductColor[];
  /** 0-100. 0 = no discount. The discounted price is `price * (100 - discountPercent) / 100`, rounded. */
  discountPercent: number;
};

export type CartItem = {
  productId: string;
  /** null for a product with no color variants. */
  colorId: string | null;
  quantity: number;
};

/** One product inside a bundle, as returned by list_active_bundles_with_items()
 * — just enough to show "what's inside" on the bundle card. */
export type BundleItemPreview = {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
};

/**
 * A curated set of specific hand-picked products sold together at one
 * fixed price. Checks out as a SINGLE line item at bundlePrice — the
 * individual products' own stock is not touched when a bundle sells
 * (accepted simplification, confirmed with the shop owner).
 */
export type Bundle = {
  id: string;
  name: string;
  description: string;
  image: string;
  bundlePrice: number;
  sortOrder: number;
  items: BundleItemPreview[];
  /** false = archived (hidden from the storefront, kept for order history). Only
   * present/meaningful in the admin view — the storefront only ever fetches active bundles. */
  isActive: boolean;
};

/** A bundle in the cart — no color/variant concept, just how many of
 * this exact bundle the customer wants. */
export type BundleCartItem = {
  bundleId: string;
  quantity: number;
};

/** The single storewide "spend ₹X, get ₹Y off" deal (see migration_008_spend_discount.sql).
 * Does NOT stack with per-product discounts — place_order() (and the mirrored
 * client-side preview in pricing.ts) always picks whichever is better for the customer. */
export type SiteSettings = {
  spendDiscountEnabled: boolean;
  spendDiscountThreshold: number;
  spendDiscountAmount: number;
};

export type PaymentMethod = "upi" | "cod";

export type OrderStatus = "placed" | "packed" | "shipped" | "delivered" | "cancelled";

export type OrderItem = {
  /** null for a bundle line item (see bundleId/bundleName below). */
  productId: string | null;
  name: string;
  price: number;
  quantity: number;
  /** Snapshot of the color chosen at checkout — null if the product has no colors, or this is a bundle line. */
  colorId: string | null;
  colorName: string | null;
  /** Set only for a bundle line item — which bundle, snapshotted by name so a later rename doesn't rewrite history. */
  bundleId: string | null;
  bundleName: string | null;
};

export type Order = {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  paymentConfirmed: boolean;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
};
