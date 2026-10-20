import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { products as mockProducts } from "@/data/products";
import type { Order, OrderItem, OrderStatus, PaymentMethod } from "@/types";

/**
 * Order persistence layer. Talks to Supabase when configured (see
 * src/lib/supabaseClient.ts); otherwise falls back to an in-memory mock
 * so the app still works before Supabase is wired up. Every function is
 * async so callers work unchanged regardless of which backend is live.
 *
 * NOTE on the mock path: data lives only in memory for this browser tab
 * and resets on reload. That limitation goes away once Supabase is
 * configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local).
 */

/** Thrown when an order can't be placed because an item is out of stock. */
export class OutOfStockError extends Error {}

let mockOrders: Order[] = [];
let mockCounter = 1000;

function generateMockOrderNumber(): string {
  mockCounter += 1;
  return `HOW-${mockCounter}`;
}

export async function createOrder(input: {
  items: OrderItem[];
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}): Promise<Order> {
  const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();

  if (isSupabaseConfigured && supabase) {
    // place_order does everything (stock check, order insert, item insert,
    // stock decrement) in one atomic database transaction — see
    // supabase/schema.sql for why this replaced three separate client-side
    // calls that never touched stock at all.
    const { data: insertedOrder, error } = await supabase.rpc("place_order", {
      p_items: input.items.map((item) => ({
        product_id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        color_id: item.colorId,
        color_name: item.colorName,
        bundle_id: item.bundleId,
        bundle_name: item.bundleName,
      })),
      p_customer_name: input.customerName,
      p_email: email,
      p_phone: phone,
      p_address: input.address,
      p_city: input.city,
      p_pincode: input.pincode,
      p_payment_method: input.paymentMethod,
      p_notes: input.notes ?? null,
    });

    if (error) {
      // Surface out-of-stock errors distinctly so the UI can show a
      // helpful message instead of the generic "something went wrong".
      if (error.message?.includes("Not enough stock")) {
        throw new OutOfStockError(error.message);
      }
      throw error;
    }

    return {
      id: insertedOrder.id,
      orderNumber: insertedOrder.order_number,
      items: input.items,
      subtotal: insertedOrder.subtotal,
      customerName: insertedOrder.customer_name,
      email: insertedOrder.email,
      phone: insertedOrder.phone,
      address: insertedOrder.address,
      city: insertedOrder.city,
      pincode: insertedOrder.pincode,
      paymentMethod: insertedOrder.payment_method,
      paymentConfirmed: insertedOrder.payment_confirmed,
      status: insertedOrder.status,
      notes: insertedOrder.notes ?? undefined,
      createdAt: insertedOrder.created_at,
    };
  }

  // Mock fallback — check + decrement stock the same way place_order does
  // server-side (per-color stock when a color was chosen, otherwise the
  // product's own stock), so behavior matches once Supabase is connected.
  // Bundle lines are skipped entirely here — bundles never touch product
  // stock, by design (see migration_007_bundles.sql).
  for (const item of input.items) {
    if (item.bundleId) continue;
    const product = mockProducts.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Product ${item.productId} does not exist`);
    const color = item.colorId ? product.colors.find((c) => c.id === item.colorId) : undefined;
    const currentStock = color ? color.stock : product.stock;
    if (currentStock < item.quantity) {
      throw new OutOfStockError(
        `Not enough stock for ${product.name}: ${currentStock} left, ${item.quantity} requested`,
      );
    }
  }
  for (const item of input.items) {
    if (item.bundleId) continue;
    const product = mockProducts.find((p) => p.id === item.productId)!;
    const color = item.colorId ? product.colors.find((c) => c.id === item.colorId) : undefined;
    if (color) {
      color.stock -= item.quantity;
    } else {
      product.stock -= item.quantity;
    }
  }

  const order: Order = {
    id: crypto.randomUUID(),
    orderNumber: generateMockOrderNumber(),
    items: input.items,
    subtotal,
    customerName: input.customerName,
    email,
    phone,
    address: input.address,
    city: input.city,
    pincode: input.pincode,
    paymentMethod: input.paymentMethod,
    paymentConfirmed: false,
    status: "placed",
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };

  mockOrders = [order, ...mockOrders];
  return order;
}

export async function getAllOrders(): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("list_all_orders");
    if (error) throw error;

    const orders = (data ?? []) as Array<Record<string, unknown>>;
    const withItems = await Promise.all(
      orders.map(async (o) => {
        const { data: items, error: itemsError } = await supabase!.rpc("find_order_items", {
          p_order_id: o.id,
        });
        if (itemsError) throw itemsError;
        return mapSupabaseOrder(o, (items ?? []) as Array<Record<string, unknown>>);
      }),
    );
    return withItems;
  }

  return mockOrders;
}

export async function findOrder(orderNumber: string, contact: string): Promise<Order | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("find_order", {
      p_order_number: orderNumber,
      p_contact: contact,
    });
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) return undefined;

    const { data: items, error: itemsError } = await supabase.rpc("find_order_items", {
      p_order_id: row.id,
    });
    if (itemsError) throw itemsError;

    return mapSupabaseOrder(row, (items ?? []) as Array<Record<string, unknown>>);
  }

  const normalizedContact = contact.trim().toLowerCase();
  return mockOrders.find(
    (o) =>
      o.orderNumber.toLowerCase() === orderNumber.trim().toLowerCase() &&
      (o.email === normalizedContact || o.phone.replace(/\s+/g, "") === contact.trim().replace(/\s+/g, "")),
  );
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc("update_order_status", { p_order_id: orderId, p_status: status });
    if (error) throw error;
    return;
  }

  const order = mockOrders.find((o) => o.id === orderId);
  if (order) order.status = status;
}

export async function markPaymentConfirmed(orderId: string, confirmed: boolean): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc("update_payment_confirmed", {
      p_order_id: orderId,
      p_confirmed: confirmed,
    });
    if (error) throw error;
    return;
  }

  const order = mockOrders.find((o) => o.id === orderId);
  if (order) order.paymentConfirmed = confirmed;
}

function mapSupabaseOrder(row: Record<string, unknown>, items: Array<Record<string, unknown>>): Order {
  return {
    id: row.id as string,
    orderNumber: row.order_number as string,
    items: items.map((i) => ({
      productId: (i.product_id as string | null) ?? null,
      name: i.name as string,
      price: i.price as number,
      quantity: i.quantity as number,
      colorId: (i.color_id as string | null) ?? null,
      colorName: (i.color_name as string | null) ?? null,
      bundleId: (i.bundle_id as string | null) ?? null,
      bundleName: (i.bundle_name as string | null) ?? null,
    })),
    subtotal: row.subtotal as number,
    customerName: row.customer_name as string,
    email: row.email as string,
    phone: row.phone as string,
    address: row.address as string,
    city: row.city as string,
    pincode: row.pincode as string,
    paymentMethod: row.payment_method as PaymentMethod,
    paymentConfirmed: row.payment_confirmed as boolean,
    status: row.status as OrderStatus,
    notes: (row.notes as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}
