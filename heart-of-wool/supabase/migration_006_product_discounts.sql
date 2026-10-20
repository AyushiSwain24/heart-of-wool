-- Heart of Wool — migration 006: per-product discounts
--
-- Adds an optional discount percentage to each product, configurable in
-- the admin panel. A product with discount_percent = 0 behaves exactly
-- as before (full price). Setting e.g. discount_percent = 20 means
-- customers pay 80% of `price`.
--
-- IMPORTANT SECURITY FIX bundled into this migration: place_order()
-- previously trusted the client-supplied `price` for every line item
-- with no server-side check against the real product price — a
-- malicious client could have placed an order at any price it liked.
-- This migration closes that gap by having place_order() look up the
-- real price (and apply the discount) itself, ignoring whatever price
-- the client sends. This is unrelated to colors/discounts specifically
-- but is essential once real money changes hands based on this table.
--
-- Run this in Supabase Studio -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Requires migration_003 (is_admin()) and migration_005
-- (product_colors, place_order with color support) to have already run.

-- ─────────────────────────────────────────────────────────────
-- 1. products.discount_percent — 0-100, defaults to 0 (no discount).
-- ─────────────────────────────────────────────────────────────
alter table products
  add column if not exists discount_percent integer not null default 0
  check (discount_percent >= 0 and discount_percent <= 100);

-- ─────────────────────────────────────────────────────────────
-- 2. admin_create_product / admin_update_product — extended with
-- p_discount_percent. Replaces the versions in migration_003.
-- ─────────────────────────────────────────────────────────────
drop function if exists admin_create_product(text, text, integer, text, text, text, integer);

create or replace function admin_create_product(
  p_id text,
  p_name text,
  p_price integer,
  p_image text,
  p_category text,
  p_description text,
  p_stock integer,
  p_discount_percent integer default 0
)
returns products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products;
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into products (id, name, price, image, category, description, stock, is_active, discount_percent)
  values (p_id, p_name, p_price, p_image, p_category, p_description, p_stock, true, coalesce(p_discount_percent, 0))
  returning * into v_product;

  return v_product;
end;
$$;

drop function if exists admin_update_product(text, text, integer, text, text, text, integer);

create or replace function admin_update_product(
  p_id text,
  p_name text,
  p_price integer,
  p_image text,
  p_category text,
  p_description text,
  p_stock integer,
  p_discount_percent integer default 0
)
returns products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products;
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  update products
  set name = p_name,
      price = p_price,
      image = p_image,
      category = p_category,
      description = p_description,
      stock = p_stock,
      discount_percent = coalesce(p_discount_percent, 0)
  where id = p_id
  returning * into v_product;

  if v_product.id is null then
    raise exception 'Product % does not exist', p_id;
  end if;

  return v_product;
end;
$$;

grant execute on function admin_create_product(text, text, integer, text, text, text, integer, integer) to authenticated;
grant execute on function admin_update_product(text, text, integer, text, text, text, integer, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. place_order — now computes each line's real unit price itself
-- (product price or color's product price, minus discount_percent)
-- instead of trusting the client-supplied price. This is the security
-- fix described above, bundled in because discounts make a trusted-
-- client price especially risky (a client could just claim 100% off).
-- ─────────────────────────────────────────────────────────────
create or replace function place_order(
  p_items jsonb,
  p_customer_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_city text,
  p_pincode text,
  p_payment_method text,
  p_notes text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_item jsonb;
  v_resolved_items jsonb := '[]'::jsonb;
  v_product_id text;
  v_color_id uuid;
  v_color_name text;
  v_quantity integer;
  v_current_stock integer;
  v_base_price integer;
  v_discount_percent integer;
  v_unit_price integer;
  v_item_name text;
  v_subtotal integer := 0;
  v_order_number text;
begin
  -- Pass 1: for every item, lock the affected rows, verify stock, and
  -- resolve the REAL unit price server-side (product price minus its
  -- discount_percent) — the client-supplied price is ignored entirely so
  -- it can never be manipulated. Resolved items (with server prices) are
  -- accumulated into v_resolved_items for pass 2 to consume, so each
  -- product/color row is only looked up once.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := v_item->>'product_id';
    v_quantity := (v_item->>'quantity')::integer;
    v_color_id := nullif(v_item->>'color_id', '')::uuid;
    v_color_name := v_item->>'color_name';

    select price, discount_percent, name
    into v_base_price, v_discount_percent, v_item_name
    from products
    where id = v_product_id
    for update;

    if v_base_price is null then
      raise exception 'Product % does not exist', v_product_id;
    end if;

    if v_color_id is not null then
      select stock into v_current_stock
      from product_colors
      where id = v_color_id and product_id = v_product_id
      for update;

      if v_current_stock is null then
        raise exception 'Color % for product % does not exist', v_color_id, v_product_id;
      end if;
    else
      v_current_stock := (select stock from products where id = v_product_id);
    end if;

    if v_current_stock < v_quantity then
      raise exception 'Not enough stock for %: % left, % requested', v_product_id, v_current_stock, v_quantity;
    end if;

    v_unit_price := round(v_base_price * (100 - v_discount_percent) / 100.0);
    v_subtotal := v_subtotal + v_unit_price * v_quantity;

    v_resolved_items := v_resolved_items || jsonb_build_object(
      'product_id', v_product_id,
      'name', v_item_name,
      'price', v_unit_price,
      'quantity', v_quantity,
      'color_id', v_color_id,
      'color_name', v_color_name
    );
  end loop;

  v_order_number := next_order_number();

  insert into orders (
    order_number, customer_name, email, phone, address, city, pincode,
    payment_method, payment_confirmed, status, notes, subtotal
  ) values (
    v_order_number, p_customer_name, p_email, p_phone, p_address, p_city, p_pincode,
    p_payment_method, false, 'placed', p_notes, v_subtotal
  )
  returning * into v_order;

  -- Pass 2: insert line items (at the server-computed unit price already
  -- resolved above) and decrement stock now that we know every item has
  -- enough.
  for v_item in select * from jsonb_array_elements(v_resolved_items)
  loop
    v_product_id := v_item->>'product_id';
    v_quantity := (v_item->>'quantity')::integer;
    v_color_id := nullif(v_item->>'color_id', '')::uuid;

    insert into order_items (order_id, product_id, name, price, quantity, color_id, color_name)
    values (
      v_order.id,
      v_product_id,
      v_item->>'name',
      (v_item->>'price')::integer,
      v_quantity,
      v_color_id,
      v_item->>'color_name'
    );

    if v_color_id is not null then
      update product_colors
      set stock = stock - v_quantity
      where id = v_color_id;
    else
      update products
      set stock = stock - v_quantity
      where id = v_product_id;
    end if;
  end loop;

  return v_order;
end;
$$;

grant execute on function place_order(jsonb, text, text, text, text, text, text, text, text) to anon;

-- ─────────────────────────────────────────────────────────────
-- 4. Public + admin product listing already use `select *` /
-- `mapSupabaseProduct`, so discount_percent flows through automatically
-- once the app code reads it — no policy changes needed here.
-- ─────────────────────────────────────────────────────────────

notify pgrst, 'reload schema';

-- Verify: discount_percent column should now exist on products.
select column_name from information_schema.columns
where table_name = 'products' and column_name = 'discount_percent';
