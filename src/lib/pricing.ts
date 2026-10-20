import type { BundleLineItem, CartLineItem } from "@/context/CartContext";
import type { SiteSettings } from "@/types";

/**
 * Shared discount math, mirroring exactly what place_order() computes
 * server-side (see supabase/migration_006_product_discounts.sql,
 * migration_007_bundles.sql, migration_008_spend_discount.sql) so the
 * UI always shows what the customer will actually be charged. The server
 * is still the source of truth — this is display-only.
 */

/** Applies a product's discountPercent (0-100) to its base price, rounded
 * the same way Postgres `round()` rounds (half away from zero — matches
 * for the positive integers we deal with here). */
export function discountedPrice(price: number, discountPercent: number): number {
  if (!discountPercent) return price;
  return Math.round((price * (100 - discountPercent)) / 100);
}

/** True when a product/color line should show a "before" price + badge. */
export function hasDiscount(discountPercent: number): boolean {
  return discountPercent > 0;
}

/**
 * Full cart pricing preview — mirrors place_order()'s two-subtotal
 * comparison (migration_008): each line at its own product discount, vs.
 * the full-price total minus the storewide spend-threshold discount,
 * charging whichever is lower. The two never stack.
 *
 * `scale` is null when per-product discounts win (today's behavior);
 * otherwise it's the same proportional-scale factor place_order() applies
 * to every line's full price, so per-line display prices below match what
 * the customer will actually be charged to the rupee.
 */
export type CartPricing = {
  fullPriceSubtotal: number;
  productDiscountedSubtotal: number;
  /** The storewide discount amount actually applied (0 if it didn't win, or didn't qualify). */
  spendDiscountApplied: number;
  /** Final amount the customer is charged. */
  finalSubtotal: number;
  /** True when the spend-threshold deal beat per-product discounts and is the one in effect. */
  spendDiscountWon: boolean;
  /** How much more (in the full-price subtotal) is needed to qualify — 0 if already qualifying or the deal is off. */
  amountToQualify: number;
  /** Proportional scale factor applied to every line's full price when spendDiscountWon is true. */
  scale: number | null;
};

export function computeCartPricing(
  lineItems: CartLineItem[],
  bundleLineItems: BundleLineItem[],
  settings: SiteSettings,
): CartPricing {
  const fullPriceSubtotal =
    lineItems.reduce((sum, li) => sum + li.product.price * li.quantity, 0) +
    bundleLineItems.reduce((sum, bl) => sum + bl.bundle.bundlePrice * bl.quantity, 0);

  const productDiscountedSubtotal =
    lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0) +
    bundleLineItems.reduce((sum, bl) => sum + bl.bundle.bundlePrice * bl.quantity, 0);

  const qualifies =
    settings.spendDiscountEnabled &&
    settings.spendDiscountAmount > 0 &&
    fullPriceSubtotal >= settings.spendDiscountThreshold;

  const candidateSpendDiscount = qualifies ? Math.min(settings.spendDiscountAmount, fullPriceSubtotal) : 0;

  const spendDiscountWon =
    candidateSpendDiscount > 0 && fullPriceSubtotal - candidateSpendDiscount < productDiscountedSubtotal;

  const amountToQualify =
    settings.spendDiscountEnabled && settings.spendDiscountAmount > 0
      ? Math.max(0, settings.spendDiscountThreshold - fullPriceSubtotal)
      : 0;

  if (spendDiscountWon) {
    const finalSubtotal = fullPriceSubtotal - candidateSpendDiscount;
    const scale = fullPriceSubtotal > 0 ? finalSubtotal / fullPriceSubtotal : 1;
    return {
      fullPriceSubtotal,
      productDiscountedSubtotal,
      spendDiscountApplied: candidateSpendDiscount,
      finalSubtotal,
      spendDiscountWon: true,
      amountToQualify,
      scale,
    };
  }

  return {
    fullPriceSubtotal,
    productDiscountedSubtotal,
    spendDiscountApplied: 0,
    finalSubtotal: productDiscountedSubtotal,
    spendDiscountWon: false,
    amountToQualify,
    scale: null,
  };
}

/** A single line's final per-unit price under the winning pricing mode —
 * use this (not li.unitPrice) once computeCartPricing has run, so the cart
 * still shows the right price per line when the spend discount has scaled
 * everything down. */
export function finalUnitPriceForProduct(fullPrice: number, productUnitPrice: number, pricing: CartPricing): number {
  return pricing.scale !== null ? Math.round(fullPrice * pricing.scale) : productUnitPrice;
}

export function finalUnitPriceForBundle(bundlePrice: number, pricing: CartPricing): number {
  return pricing.scale !== null ? Math.round(bundlePrice * pricing.scale) : bundlePrice;
}
