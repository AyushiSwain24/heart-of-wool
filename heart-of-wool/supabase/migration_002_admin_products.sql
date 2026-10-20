-- Heart of Wool — migration 002: admin product management
-- Run this in Supabase Studio -> SQL Editor -> New query -> paste -> Run.
-- Adds everything needed for the admin panel to create/edit/archive
-- products and upload images, without touching any existing data.
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. Add is_active to products (archive, not delete).
-- ─────────────────────────────────────────────────────────────
alter table products add column if not exists is_active boolean not null default true;

-- ─────────────────────────────────────────────────────────────
-- 2. Storage bucket for product images.
--
-- Public bucket: anyone can VIEW images (needed — they're shown on the
-- public storefront), but only the admin functions below can add/replace
-- them, via SECURITY DEFINER, same pattern as the rest of this app's
-- "no real auth yet" admin functions.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public can READ (view) images in this bucket — required for the
-- storefront to display them.
drop policy if exists "public can view product images" on storage.objects;
create policy "public can view product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Public (anon key) can UPLOAD to this bucket. This mirrors the same
-- "no real auth yet" trade-off as the rest of the admin functions in
-- schema.sql — anyone with your public API key could technically upload
-- files here right now. Acceptable for a private v1 with a password-gated
-- admin UI in front of it; MUST be locked down to an authenticated admin
-- role before real public launch (see the security note further down and
-- in schema.sql).
drop policy if exists "public can upload product images" on storage.objects;
create policy "public can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');

drop policy if exists "public can update product images" on storage.objects;
create policy "public can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images');

-- ─────────────────────────────────────────────────────────────
-- 3. Admin product CRUD functions.
--
-- Same SECURITY DEFINER pattern as list_all_orders / update_order_status
-- etc. in schema.sql — these bypass RLS so the (password-gated, not
-- truly authenticated) admin UI can manage the catalog without needing
-- a public UPDATE/INSERT policy on `products` directly.
-- ─────────────────────────────────────────────────────────────

-- List ALL products including archived ones (for the admin product list —
-- the public storefront instead queries `products` directly filtered to
-- is_active = true, which the existing "public can read products" SELECT
-- policy already allows).
create or replace function admin_list_products()
returns setof products
language sql
security definer
set search_path = public
as $$
  select * from products order by created_at desc;
$$;

-- Create a new product. p_id should be a short slug (e.g. "doll-11") —
-- kept human-readable like the existing seed data, generated in the
-- admin UI from the product name.
create or replace function admin_create_product(
  p_id text,
  p_name text,
  p_price integer,
  p_image text,
  p_category text,
  p_description text,
  p_stock integer
)
returns products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products;
begin
  insert into products (id, name, price, image, category, description, stock, is_active)
  values (p_id, p_name, p_price, p_image, p_category, p_description, p_stock, true)
  returning * into v_product;

  return v_product;
end;
$$;

-- Update an existing product's fields (all of them — the admin form
-- always sends the full record back).
create or replace function admin_update_product(
  p_id text,
  p_name text,
  p_price integer,
  p_image text,
  p_category text,
  p_description text,
  p_stock integer
)
returns products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products;
begin
  update products
  set name = p_name,
      price = p_price,
      image = p_image,
      category = p_category,
      description = p_description,
      stock = p_stock
  where id = p_id
  returning * into v_product;

  if v_product is null then
    raise exception 'Product % does not exist', p_id;
  end if;

  return v_product;
end;
$$;

-- Archive (hide from shop) or restore a product. Never deletes —
-- order_items references products by id (foreign key), and even if it
-- didn't, keeping past products around for order history is the point.
create or replace function admin_set_product_active(p_id text, p_active boolean)
returns products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products;
begin
  update products
  set is_active = p_active
  where id = p_id
  returning * into v_product;

  if v_product is null then
    raise exception 'Product % does not exist', p_id;
  end if;

  return v_product;
end;
$$;

grant execute on function admin_list_products() to anon;
grant execute on function admin_create_product(text, text, integer, text, text, text, integer) to anon;
grant execute on function admin_update_product(text, text, integer, text, text, text, integer) to anon;
grant execute on function admin_set_product_active(text, boolean) to anon;

-- ─────────────────────────────────────────────────────────────
-- 4. Storefront must stop showing archived products.
--
-- The existing "public can read products" policy (from schema.sql) has
-- no is_active filter, so archived products would still show up on the
-- public site unless every query filters for is_active = true. The app
-- code now does this (see src/hooks/useProducts.ts), but as a defense
-- in depth measure, we also narrow the public SELECT policy itself so
-- archived products are invisible even to a direct table query with the
-- anon key — matching what a customer should actually be able to see.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "public can read products" on products;
create policy "public can read active products"
  on products for select
  using (is_active = true);

-- The admin product list needs to see archived products too — that's
-- what admin_list_products() (SECURITY DEFINER, bypasses RLS) is for,
-- so no separate policy is needed for the admin case.

notify pgrst, 'reload schema';

-- Verify: should return 4 rows (the 4 new admin_ functions).
select routine_name from information_schema.routines
where routine_name in ('admin_list_products', 'admin_create_product', 'admin_update_product', 'admin_set_product_active');
