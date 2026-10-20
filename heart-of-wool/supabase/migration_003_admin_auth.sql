-- Heart of Wool — migration 003: real admin authentication
-- Run this in Supabase Studio -> SQL Editor -> New query -> paste -> Run.
--
-- Replaces the "anyone with the public API key can call admin functions"
-- trade-off (documented in schema.sql / migration_002) with real access
-- control: admin-only functions now require a logged-in Supabase Auth
-- session AND that session must belong to the shop owner specifically
-- (checked by email), not just any authenticated user.
--
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. Create yourself an admin login.
--
-- Do this FIRST, before running the rest of this file, so step 2 below
-- can find your account:
--   Supabase Studio -> Authentication -> Users -> Add user -> Create new user
--   Enter your own email + a strong password, and toggle
--   "Auto Confirm User" on (so you don't need to click an email link).
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 2. is_admin(): true only for a specific allow-listed owner email,
-- checked against the currently logged-in Supabase Auth session
-- (auth.uid() / auth.jwt()). Being "logged in" alone is not enough —
-- this app has no public sign-up flow, but being defensive here costs
-- nothing and means a stray extra auth user can never become an admin
-- by accident.
--
-- IMPORTANT: replace 'YOUR_EMAIL_HERE' below with your actual login
-- email (the same one you used in step 1) before running this file.
-- ─────────────────────────────────────────────────────────────
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = 'YOUR_EMAIL_HERE'
  );
$$;

grant execute on function is_admin() to authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- 3. Lock down admin-only order functions.
--
-- find_order / find_order_items / next_order_number / place_order stay
-- open to anon — they power the public checkout and track-order pages,
-- which have no login. Only the true admin actions change.
-- ─────────────────────────────────────────────────────────────
create or replace function list_all_orders()
returns setof orders
language sql
security definer
set search_path = public
as $$
  select * from orders
  where is_admin()
  order by created_at desc;
$$;

create or replace function update_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;
  update orders set status = p_status where id = p_order_id;
end;
$$;

create or replace function update_payment_confirmed(p_order_id uuid, p_confirmed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;
  update orders set payment_confirmed = p_confirmed where id = p_order_id;
end;
$$;

-- Revoke the old public grants and re-grant to authenticated only — an
-- anonymous visitor (not logged in at all) can no longer even attempt
-- to call these.
revoke execute on function list_all_orders() from anon;
revoke execute on function update_order_status(uuid, text) from anon;
revoke execute on function update_payment_confirmed(uuid, boolean) from anon;

grant execute on function list_all_orders() to authenticated;
grant execute on function update_order_status(uuid, text) to authenticated;
grant execute on function update_payment_confirmed(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Lock down admin product functions the same way.
-- ─────────────────────────────────────────────────────────────
create or replace function admin_list_products()
returns setof products
language sql
security definer
set search_path = public
as $$
  select * from products
  where is_admin()
  order by created_at desc;
$$;

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
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into products (id, name, price, image, category, description, stock, is_active)
  values (p_id, p_name, p_price, p_image, p_category, p_description, p_stock, true)
  returning * into v_product;

  return v_product;
end;
$$;

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
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

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

create or replace function admin_set_product_active(p_id text, p_active boolean)
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
  set is_active = p_active
  where id = p_id
  returning * into v_product;

  if v_product is null then
    raise exception 'Product % does not exist', p_id;
  end if;

  return v_product;
end;
$$;

revoke execute on function admin_list_products() from anon;
revoke execute on function admin_create_product(text, text, integer, text, text, text, integer) from anon;
revoke execute on function admin_update_product(text, text, integer, text, text, text, integer) from anon;
revoke execute on function admin_set_product_active(text, boolean) from anon;

grant execute on function admin_list_products() to authenticated;
grant execute on function admin_create_product(text, text, integer, text, text, text, integer) to authenticated;
grant execute on function admin_update_product(text, text, integer, text, text, text, integer) to authenticated;
grant execute on function admin_set_product_active(text, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Lock down product image uploads the same way — only a logged-in
-- admin can upload/replace images now, not anyone with the public key.
-- Public read access stays open (the storefront needs to display images
-- without anyone being logged in).
-- ─────────────────────────────────────────────────────────────
drop policy if exists "public can upload product images" on storage.objects;
drop policy if exists "public can update product images" on storage.objects;

create policy "admin can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and is_admin());

create policy "admin can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and is_admin());

notify pgrst, 'reload schema';

-- Verify: should return 'is_admin' plus the 7 functions above (8 rows).
select routine_name from information_schema.routines
where routine_name in (
  'is_admin', 'list_all_orders', 'update_order_status', 'update_payment_confirmed',
  'admin_list_products', 'admin_create_product', 'admin_update_product', 'admin_set_product_active'
);
