-- Heart of Wool — migration 007: bundles
--
-- A bundle is a curated set of specific hand-picked products sold
-- together at one fixed price (e.g. "Cozy Starter Set — 3 dolls for
-- ₹1299" even though they'd normally add up to more). Bundles are
-- configured entirely in the admin panel and show up in their own
-- section on the storefront, separate from regular products.
--
-- IMPORTANT — checkout behavior (matches what was scoped with the
-- shop owner): a bundle checks out as a SINGLE line item at the fixed
-- bundle price. Individual product stock is NOT decremented when a
-- bundle sells — this is an accepted simplification, not a bug. Only
-- bundle.is_active controls whether a bundle can still be bought; there
-- is no separate bundle-level stock count.
--
-- Run this in Supabase Studio -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Requires migration_003 (is_admin()) and migration_006
-- (place_order with discount support) to have already run.

-- ─────────────────────────────────────────────────────────────
-- 1. bundles — the curated set itself.
-- ─────────────────────────────────────────────────────────────
create table if not exists bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image text not null,
  bundle_price integer not null check (bundle_price >= 0),
  is_active boolean not null default true, -- false = hidden from storefront, kept for order history
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. bundle_items — which specific products (and how many of each) make
-- up a bundle. Purely descriptive for display ("what's inside") — does
-- NOT drive stock decrement at checkout (see note above).
-- ─────────────────────────────────────────────────────────────
create table if not exists bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references bundles(id) on delete cascade,
  product_id text not null references products(id),
  quantity integer not null default 1 check (quantity > 0),
  sort_order integer not null default 0
);

create index if not exists bundle_items_bundle_id_idx on bundle_items(bundle_id);

alter table bundles enable row level security;
alter table bundle_items enable row level security;

drop policy if exists "public can read active bundles" on bundles;
create policy "public can read active bundles"
  on bundles for select
  using (is_active = true);

drop policy if exists "public can read bundle items" on bundle_items;
create policy "public can read bundle items"
  on bundle_items for select
  using (true);

grant select on bundles, bundle_items to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. order_items — a bundle line has no single product_id, so it must
-- become nullable; bundle_id/bundle_name snapshot which bundle was
-- bought (name snapshotted so a later bundle rename doesn't rewrite
-- historical orders, same pattern as color_name).
-- ─────────────────────────────────────────────────────────────
alter table order_items alter column product_id drop not null;
alter table order_items add column if not exists bundle_id uuid references bundles(id);
alter table order_items add column if not exists bundle_name text;

-- A line item is either a product (product_id set) or a bundle
-- (bundle_id set) — never neither, never both.
alter table order_items drop constraint if exists order_items_product_or_bundle_check;
alter table order_items add constraint order_items_product_or_bundle_check
  check ((product_id is not null) <> (bundle_id is not null));

-- ─────────────────────────────────────────────────────────────
-- 4. Admin functions for managing bundles — same SECURITY DEFINER +
-- is_admin() pattern as admin_set_product_colors.
-- ─────────────────────────────────────────────────────────────
create or replace function admin_list_bundles()
returns setof bundles
language sql
security definer
set search_path = public
as $$
  select * from bundles order by sort_order asc, created_at desc;
$$;

create or replace function admin_list_bundle_items(p_bundle_id uuid)
returns table (product_id text, quantity integer, sort_order integer)
language sql
security definer
set search_path = public
as $$
  select product_id, quantity, sort_order
  from bundle_items
  where bundle_id = p_bundle_id
  order by sort_order asc;
$$;

create or replace function admin_create_bundle(
  p_name text,
  p_description text,
  p_image text,
  p_bundle_price integer,
  p_items jsonb -- [{"product_id": "doll-01", "quantity": 1, "sort_order": 0}, ...]
)
returns bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle bundles;
  v_item jsonb;
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  if (select count(*) from jsonb_array_elements(p_items)) = 0 then
    raise exception 'A bundle needs at least one product';
  end if;

  insert into bundles (name, description, image, bundle_price, is_active)
  values (p_name, p_description, p_image, p_bundle_price, true)
  returning * into v_bundle;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into bundle_items (bundle_id, product_id, quantity, sort_order)
    values (
      v_bundle.id,
      v_item->>'product_id',
      coalesce((v_item->>'quantity')::integer, 1),
      coalesce((v_item->>'sort_order')::integer, 0)
    );
  end loop;

  return v_bundle;
end;
$$;

create or replace function admin_update_bundle(
  p_id uuid,
  p_name text,
  p_description text,
  p_image text,
  p_bundle_price integer,
  p_items jsonb
)
returns bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle bundles;
  v_item jsonb;
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  if (select count(*) from jsonb_array_elements(p_items)) = 0 then
    raise exception 'A bundle needs at least one product';
  end if;

  update bundles
  set name = p_name,
      description = p_description,
      image = p_image,
      bundle_price = p_bundle_price
  where id = p_id
  returning * into v_bundle;

  if v_bundle.id is null then
    raise exception 'Bundle % does not exist', p_id;
  end if;

  delete from bundle_items where bundle_id = p_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into bundle_items (bundle_id, product_id, quantity, sort_order)
    values (
      p_id,
      v_item->>'product_id',
      coalesce((v_item->>'quantity')::integer, 1),
      coalesce((v_item->>'sort_order')::integer, 0)
    );
  end loop;

  return v_bundle;
end;
$$;

create or replace function admin_set_bundle_active(p_id uuid, p_active boolean)
returns bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle bundles;
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  update bundles set is_active = p_active where id = p_id
  returning * into v_bundle;

  if v_bundle.id is null then
    raise exception 'Bundle % does not exist', p_id;
  end if;

  return v_bundle;
end;
$$;

grant execute on function admin_list_bundles() to authenticated;
grant execute on function admin_list_bundle_items(uuid) to authenticated;
grant execute on function admin_create_bundle(text, text, text, integer, jsonb) to authenticated;
grant execute on function admin_update_bundle(uuid, text, text, text, integer, jsonb) to authenticated;
grant execute on function admin_set_bundle_active(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. list_active_bundles_with_items — one call for the storefront to
-- get every active bundle plus its contained products (name/image) for
-- display, instead of N+1 queries from the client.
-- ─────────────────────────────────────────────────────────────
create or replace function list_active_bundles_with_items()
returns table (
  id uuid,
  name text,
  description text,
  image text,
  bundle_price integer,
  sort_order integer,
  items jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    b.id, b.name, b.description, b.image, b.bundle_price, b.sort_order,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'product_id', bi.product_id,
            'name', p.name,
            'image', p.image,
            'price', p.price,
            'quantity', bi.quantity
          ) order by bi.sort_order
        )
        from bundle_items bi
        join products p on p.id = bi.product_id
        where bi.bundle_id = b.id
      ),
      '[]'::jsonb
    ) as items
  from bundles b
  where b.is_active = true
  order by b.sort_order asc, b.created_at desc;
$$;

grant execute on function list_active_bundles_with_items() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. place_order — extended to accept bundle line items alongside
-- product line items. An item with "bundle_id" set is sold as a single
-- line at the bundle's current bundle_price (server-resolved, same
-- anti-tampering approach as product discounts) x quantity; no product
-- or color stock is touched for it (see note at top of file).
--
-- p_items entries are now one of:
--   {"product_id": "doll-01", "color_id": null, "quantity": 2, ...}
--   {"bundle_id": "<uuid>", "quantity": 1}
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
  v_bundle_id uuid;
  v_bundle_name text;
  v_bundle_price integer;
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
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_bundle_id := nullif(v_item->>'bundle_id', '')::uuid;

    if v_bundle_id is not null then
      -- Bundle line: resolve price server-side from the bundle's
      -- current bundle_price, ignore stock entirely (see file header).
      select bundle_price, name into v_bundle_price, v_bundle_name
      from bundles
      where id = v_bundle_id and is_active = true;

      if v_bundle_price is null then
        raise exception 'Bundle % does not exist or is no longer available', v_bundle_id;
      end if;

      v_subtotal := v_subtotal + v_bundle_price * v_quantity;

      v_resolved_items := v_resolved_items || jsonb_build_object(
        'product_id', null,
        'name', v_bundle_name,
        'price', v_bundle_price,
        'quantity', v_quantity,
        'color_id', null,
        'color_name', null,
        'bundle_id', v_bundle_id,
        'bundle_name', v_bundle_name
      );
    else
      -- Product (optionally color) line: same resolution as migration_006.
      v_product_id := v_item->>'product_id';
      v_color_id := nullif(v_item->>'color_id', '')::uuid;

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
        'color_name', v_item->>'color_name',
        'bundle_id', null,
        'bundle_name', null
      );
    end if;
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

  for v_item in select * from jsonb_array_elements(v_resolved_items)
  loop
    v_product_id := v_item->>'product_id';
    v_quantity := (v_item->>'quantity')::integer;
    v_color_id := nullif(v_item->>'color_id', '')::uuid;
    v_bundle_id := nullif(v_item->>'bundle_id', '')::uuid;

    insert into order_items (order_id, product_id, name, price, quantity, color_id, color_name, bundle_id, bundle_name)
    values (
      v_order.id,
      v_product_id,
      v_item->>'name',
      (v_item->>'price')::integer,
      v_quantity,
      v_color_id,
      v_item->>'color_name',
      v_bundle_id,
      v_item->>'bundle_name'
    );

    -- Bundles don't touch stock (accepted simplification — see file header).
    if v_bundle_id is null then
      if v_color_id is not null then
        update product_colors
        set stock = stock - v_quantity
        where id = v_color_id;
      else
        update products
        set stock = stock - v_quantity
        where id = v_product_id;
      end if;
    end if;
  end loop;

  return v_order;
end;
$$;

grant execute on function place_order(jsonb, text, text, text, text, text, text, text, text) to anon;

-- ─────────────────────────────────────────────────────────────
-- 7. find_order_items — extended to also return bundle_id/bundle_name
-- so track-order and admin can show which lines were bundles.
-- ─────────────────────────────────────────────────────────────
drop function if exists find_order_items(uuid);

create or replace function find_order_items(p_order_id uuid)
returns table (
  product_id text,
  name text,
  price integer,
  quantity integer,
  color_id uuid,
  color_name text,
  bundle_id uuid,
  bundle_name text
)
language sql
security definer
set search_path = public
as $$
  select oi.product_id, oi.name, oi.price, oi.quantity, oi.color_id, oi.color_name, oi.bundle_id, oi.bundle_name
  from order_items oi
  where oi.order_id = p_order_id;
$$;

grant execute on function find_order_items(uuid) to anon;

notify pgrst, 'reload schema';

-- Verify: should return 2 rows (bundles + bundle_items tables).
select table_name as name from information_schema.tables where table_name in ('bundles', 'bundle_items');
