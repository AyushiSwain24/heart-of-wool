import type { Bundle } from "@/types";
import { products } from "@/data/products";

/**
 * Dummy bundle for local-dev / mock mode (no Supabase configured) —
 * mirrors what an admin-created bundle looks like once wired up for
 * real. Picks a few real mock products so the "what's inside" preview
 * has something to show.
 */
const dollA = products.find((p) => p.id === "doll-02")!;
const dollB = products.find((p) => p.id === "doll-03")!;
const charm = products.find((p) => p.id === "ccharm-01")!;

export const bundles: Bundle[] = [
  {
    id: "bundle-cozy-starter",
    name: "Cozy Starter Set",
    description: "Two of our best-loved dolls plus a little bag charm — a sweet way to try a few pieces at once.",
    image: dollA.image,
    bundlePrice: 1299,
    sortOrder: 0,
    items: [
      { productId: dollA.id, name: dollA.name, image: dollA.image, price: dollA.price, quantity: 1 },
      { productId: dollB.id, name: dollB.name, image: dollB.image, price: dollB.price, quantity: 1 },
      { productId: charm.id, name: charm.name, image: charm.image, price: charm.price, quantity: 1 },
    ],
    isActive: true,
  },
];
