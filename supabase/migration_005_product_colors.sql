-- Heart of Wool — migration 005: product color variants
--
-- Adds optional color variants to products (e.g. a "Duck Doll" available
-- in Yellow / Blue / Pink), each with its own image and its own stock
-- count, so one color selling out doesn't block the others.
--
-- A product with NO rows in product_colors behaves exactly as before
-- (single image, single stock count on the products table) — colors are
-- opt-in per product, not required.
--
-- Run this in Supabase Studio -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. product_colors — one row per color variant of a product.
-- ─────────────────────────────────────────────────────────────
create table if not exists product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  name text not null,                  -- e.g. "Yellow", "Sky Blue"
  hex text,                            -- optional swatch color, e.g. "#f5c542" — purely visual
  image text not null,
  stock integer not null default 0 check (stock >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_colors_product_id_idx on product_colors(product_id);

alter table product_colors enable row level security;

-- Same pattern as `products`: public can read colors of active products
-- (join implied — the app always fetches colors alongside an already
-- is_active-filtered product, but this policy stands on its own too).
drop policy if exists "public can read product colors" on product_colors;
create policy "public can read product colors"
  on product_colors for select
  using (true);

grant select on product_colors to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. order_items — snapshot which color was ordered (nullable: plain
-- products with no colors leave this null, exactly like before).
-- ─────────────────────────────────────────────────────────────
alter table order_items add column if not exists color_id uuid;
alter table order_items add column if not exists color_name text;

-- ─────────────────────────────────────────────────────────────
-- 3. Admin functions for managing colors — same SECURITY DEFINER +
-- is_admin() pattern as the rest of the admin_* functions
-- (see migration_003_admin_auth.sql). Requires is_admin() to already
-- exist — run migration_003 first if you haven't.
-- ─────────────────────────────────────────────────────────────
create or replace function admin_list_product_colors(p_product_id text)
returns setof product_colors
language sql
security definer
set search_path = public
as $$
  select * from product_colors
  where product_id = p_product_id
  order by sort_order asc, created_at asc;
$$;

create or replace function admin_set_product_colors(
  p_product_id text,
  p_colors jsonb -- [{"id": null-or-uuid, "name": "...", "hex": "...", "image": "...", "stock": 5, "sort_order": 0}, ...]
)
returns setof product_colors
language plpgsql
security definer
set search_path = public
as $$
declare
  v_color jsonb;
  v_keep_ids uuid[] := '{}';
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  -- Upsert every color passed in.
  for v_color in select * from jsonb_array_elements(p_colors)
  loop
    if (v_color->>'id') is null or (v_color->>'id') = '' then
      insert into product_colors (product_id, name, hex, image, stock, sort_order)
      values (
        p_product_id,
        v_color->>'name',
        nullif(v_color->>'hex', ''),
        v_color->>'image',
        coalesce((v_color->>'stock')::integer, 0),
        coalesce((v_color->>'sort_order')::integer, 0)
      )
      returning id into v_id;
    else
      v_id := (v_color->>'id')::uuid;
      update product_colors
      set name = v_color->>'name',
          hex = nullif(v_color->>'hex', ''),
          image = v_color->>'image',
          stock = coalesce((v_color->>'stock')::integer, 0),
          sort_order = coalesce((v_color->>'sort_order')::integer, 0)
      where id = v_id and product_id = p_product_id;
    end if;

    v_keep_ids := array_append(v_keep_ids, v_id);
  end loop;

  -- Remove any existing colors for this product that weren't in the
  -- payload (i.e. the admin deleted them in the form).
  delete from product_colors
  where product_id = p_product_id
    and not (id = any(v_keep_ids));

  return query select * from product_colors where product_id = p_product_id order by sort_order asc, created_at asc;
end;
$$;

grant execute on function admin_list_product_colors(text) to authenticated;
grant execute on function admin_set_product_colors(text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. place_order — updated to check/decrement per-color stock when an
-- item specifies a color, and per-product stock otherwise (unchanged
-- behavior for colorless products). Replaces the version in schema.sql /
-- earlier migrations.
--
-- p_items entries now optionally carry "color_id":
--   [{"product_id": "doll-01", "color_id": "<uuid>-or-null", "name": "...",
--     "price": 549, "quantity": 2}, ...]
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
  v_product_id text;
  v_color_id uuid;
  v_color_name text;
  v_quantity integer;
  v_current_stock integer;
  v_subtotal integer := 0;
  v_order_number text;
begin
  -- Pass 1: lock every affected row (product or color) and verify stock
  -- up front, so we never insert partial data before discovering a
  -- shortage.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := v_item->>'product_id';
    v_quantity := (v_item->>'quantity')::integer;
    v_color_id := nullif(v_item->>'color_id', '')::uuid;

    if v_color_id is not null then
      select stock, name into v_current_stock, v_color_name
      from product_colors
      where id = v_color_id and product_id = v_product_id
      for update;

      if v_current_stock is null then
        raise exception 'Color % for product % does not exist', v_color_id, v_product_id;
      end if;
    else
      select stock into v_current_stock
      from products
      where id = v_product_id
      for update;

      if v_current_stock is null then
        raise exception 'Product % does not exist', v_product_id;
      end if;
    end if;

    if v_current_stock < v_quantity then
      raise exception 'Not enough stock for %: % left, % requested', v_product_id, v_current_stock, v_quantity;
    end if;

    v_subtotal := v_subtotal + (v_item->>'price')::integer * v_quantity;
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

  -- Pass 2: insert line items and decrement stock now that we know
  -- every item has enough.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_color_id := nullif(v_item->>'color_id', '')::uuid;
    v_color_name := v_item->>'color_name';

    insert into order_items (order_id, product_id, name, price, quantity, color_id, color_name)
    values (
      v_order.id,
      v_item->>'product_id',
      v_item->>'name',
      (v_item->>'price')::integer,
      (v_item->>'quantity')::integer,
      v_color_id,
      v_color_name
    );

    if v_color_id is not null then
      update product_colors
      set stock = stock - (v_item->>'quantity')::integer
      where id = v_color_id;
    else
      update products
      set stock = stock - (v_item->>'quantity')::integer
      where id = v_item->>'product_id';
    end if;
  end loop;

  return v_order;
end;
$$;

grant execute on function place_order(jsonb, text, text, text, text, text, text, text, text) to anon;

-- ─────────────────────────────────────────────────────────────
-- 5. find_order_items — updated to also return color_id/color_name so
-- the track-order page and admin can show which color was ordered.
-- Replaces the version in schema.sql (drop first: return type changed).
-- ─────────────────────────────────────────────────────────────
drop function if exists find_order_items(uuid);

create or replace function find_order_items(p_order_id uuid)
returns table (
  product_id text,
  name text,
  price integer,
  quantity integer,
  color_id uuid,
  color_name text
)
language sql
security definer
set search_path = public
as $$
  select oi.product_id, oi.name, oi.price, oi.quantity, oi.color_id, oi.color_name
  from order_items oi
  where oi.order_id = p_order_id;
$$;

grant execute on function find_order_items(uuid) to anon;

notify pgrst, 'reload schema';

-- Verify: should return 3 rows (product_colors table + the 2 new admin
-- functions — place_order is a replace so it won't show as "new").
select table_name as name from information_schema.tables where table_name = 'product_colors'
union all
select routine_name from information_schema.routines
where routine_name in ('admin_list_product_colors', 'admin_set_product_colors');
