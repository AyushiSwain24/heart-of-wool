-- Heart of Wool — Supabase schema
-- Run this in Supabase Studio → SQL Editor → New query → paste → Run.
-- Safe to re-run: uses "if not exists" / "or replace" where possible.

-- ─────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ─────────────────────────────────────────────────────────────
-- products
-- ─────────────────────────────────────────────────────────────
create table if not exists products (
  id text primary key,                -- e.g. "doll-01" (kept human-readable to match current data)
  name text not null,
  price integer not null check (price >= 0),          -- INR, whole rupees
  image text not null,
  category text not null check (category in ('crochet-dolls', 'resin-charms', 'crochet-charms', 'crochet-keychains')),
  description text not null default '',
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true, -- false = archived (hidden from shop, kept for order history)
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- orders
-- ─────────────────────────────────────────────────────────────
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,   -- e.g. "HOW-1001"
  customer_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  city text not null,
  pincode text not null,
  payment_method text not null check (payment_method in ('upi', 'cod')),
  payment_confirmed boolean not null default false,
  status text not null default 'placed'
    check (status in ('placed', 'packed', 'shipped', 'delivered', 'cancelled')),
  notes text,
  subtotal integer not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- order_items (line items — snapshot name/price at time of order,
-- so later product edits don't rewrite historical orders)
-- ─────────────────────────────────────────────────────────────
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id text not null references products(id),
  name text not null,
  price integer not null check (price >= 0),
  quantity integer not null check (quantity > 0)
);

create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists orders_order_number_idx on orders(order_number);

-- ─────────────────────────────────────────────────────────────
-- order number generator: HOW-1001, HOW-1002, ...
-- ─────────────────────────────────────────────────────────────
create sequence if not exists order_number_seq start 1001;

create or replace function next_order_number()
returns text
language sql
as $$
  select 'HOW-' || nextval('order_number_seq')::text;
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Design for a no-accounts storefront:
--  - Anyone (anon key, i.e. the public website) can READ products.
--  - Anyone can INSERT an order + its items (placing an order needs no login).
--  - Nobody using the public anon key can UPDATE or DELETE anything
--    (that includes flipping order status/payment — reserved for the
--    admin, which for v1 authenticates separately; see note below).
--  - Order/order_item SELECT is restricted — the public anon key should
--    look up a single order via the `find_order` function below rather
--    than querying the table directly, so browsing all orders isn't
--    possible from the client.
-- ─────────────────────────────────────────────────────────────
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "public can read products" on products;
create policy "public can read products"
  on products for select
  using (true);

drop policy if exists "public can insert orders" on orders;
create policy "public can insert orders"
  on orders for insert
  with check (true);

drop policy if exists "public can insert order_items" on order_items;
create policy "public can insert order_items"
  on order_items for insert
  with check (true);

-- IMPORTANT: RLS policies alone are not enough. Postgres also requires an
-- explicit table-level GRANT for a role before that role can touch a
-- table at all — RLS policies only narrow what an already-granted role
-- can do, they don't grant access by themselves. Tables created through
-- the Supabase dashboard UI get sensible default grants automatically;
-- tables created via raw SQL (like this file, run through the SQL
-- Editor) do NOT. Forgetting this produces the exact same
-- "new row violates row-level security policy" error as a missing/wrong
-- policy, which makes it easy to misdiagnose — so this block is required,
-- not optional.
grant usage on schema public to anon, authenticated;
grant select on products to anon, authenticated;
grant insert, select on orders to anon, authenticated;
grant insert, select on order_items to anon, authenticated;

-- A SELECT policy on orders/order_items IS required, not optional: the
-- app does `.insert(...).select().single()` so it can get back the new
-- order's generated id and order_number right after creating it — that
-- read-back step needs its own SELECT permission, separate from INSERT.
-- Without it, Postgres rejects the read-back with the exact same
-- "row-level security policy" error as a missing INSERT policy, which
-- makes this easy to misdiagnose (ask me how I know).
--
-- Trade-off this creates: anyone with the public anon key COULD list
-- every order by querying the table directly (bypassing the app UI).
-- Order ids are random UUIDs though, not sequential, so there's no
-- practical way to enumerate them, and the app itself never exposes a
-- "browse all orders" UI to the public — only /admin does, and that goes
-- through the SECURITY DEFINER functions below, not a direct table read.
-- This is judged an acceptable trade-off for v1, not an accident.
drop policy if exists "public can read own inserted orders" on orders;
create policy "public can read own inserted orders"
  on orders for select
  using (true);

drop policy if exists "public can read own inserted order_items" on order_items;
create policy "public can read own inserted order_items"
  on order_items for select
  using (true);

-- The admin page's status/payment updates go through the
-- update_order_status / update_payment_confirmed SECURITY DEFINER
-- functions below (not direct table UPDATEs — no public UPDATE policy
-- exists on purpose).
--
-- IMPORTANT — this is a stopgap, not real security: right now any
-- caller who knows these function names can call them (e.g. update any
-- order's status) because the functions themselves aren't checking who
-- the caller is. Before real launch, add Supabase Auth for the shop
-- owner and gate update_order_status / update_payment_confirmed behind
-- `auth.uid() is not null` (or a specific admin user id) inside the
-- function body, and remove the "grant execute ... to anon" line for
-- those two functions once the app calls them with an authenticated
-- session instead.

-- ─────────────────────────────────────────────────────────────
-- find_order: look up one order by order number + email/phone.
-- Runs as the function owner (bypassing RLS) so the public site can
-- fetch a single matching order without being able to list all orders.
-- ─────────────────────────────────────────────────────────────
create or replace function find_order(p_order_number text, p_contact text)
returns table (
  id uuid,
  order_number text,
  customer_name text,
  email text,
  phone text,
  address text,
  city text,
  pincode text,
  payment_method text,
  payment_confirmed boolean,
  status text,
  notes text,
  subtotal integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select o.id, o.order_number, o.customer_name, o.email, o.phone, o.address, o.city,
         o.pincode, o.payment_method, o.payment_confirmed, o.status, o.notes, o.subtotal, o.created_at
  from orders o
  where lower(o.order_number) = lower(trim(p_order_number))
    and (
      lower(o.email) = lower(trim(p_contact))
      or replace(o.phone, ' ', '') = replace(trim(p_contact), ' ', '')
    )
  limit 1;
$$;

create or replace function find_order_items(p_order_id uuid)
returns table (product_id text, name text, price integer, quantity integer)
language sql
security definer
set search_path = public
as $$
  select oi.product_id, oi.name, oi.price, oi.quantity
  from order_items oi
  where oi.order_id = p_order_id;
$$;

-- ─────────────────────────────────────────────────────────────
-- Admin functions (see security note above — add real auth before launch)
-- ─────────────────────────────────────────────────────────────
create or replace function list_all_orders()
returns setof orders
language sql
security definer
set search_path = public
as $$
  select * from orders order by created_at desc;
$$;

create or replace function update_order_status(p_order_id uuid, p_status text)
returns void
language sql
security definer
set search_path = public
as $$
  update orders set status = p_status where id = p_order_id;
$$;

create or replace function update_payment_confirmed(p_order_id uuid, p_confirmed boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update orders set payment_confirmed = p_confirmed where id = p_order_id;
$$;

grant execute on function find_order(text, text) to anon;
grant execute on function find_order_items(uuid) to anon;
grant execute on function list_all_orders() to anon;
grant execute on function update_order_status(uuid, text) to anon;
grant execute on function update_payment_confirmed(uuid, boolean) to anon;
grant execute on function next_order_number() to anon;

-- ─────────────────────────────────────────────────────────────
-- place_order: the ONE function checkout should call.
--
-- Bug this fixes: the original checkout flow called next_order_number(),
-- then a plain `.insert()` into orders, then another `.insert()` into
-- order_items, as three separate client-side steps — and never touched
-- `products.stock` at all. That meant stock never decreased when an
-- order was placed, so two customers could both "successfully" buy the
-- last item of something, and the admin had no way to know stock was
-- oversold without manually cross-checking every order against the
-- catalog.
--
-- This function does everything in ONE atomic database transaction:
-- 1. Locks and checks stock for every item in the order (`for update`
--    prevents a race where two simultaneous checkouts both read
--    "stock = 1" and both think they can proceed).
-- 2. If ANY item doesn't have enough stock, the whole function raises
--    an exception and NOTHING is written — no partial orders.
-- 3. Creates the order + order_items rows.
-- 4. Decrements stock on each product by the ordered quantity.
-- All four steps succeed together or fail together (standard Postgres
-- function transaction semantics) — there's no window where an order
-- exists but stock wasn't decremented, or vice versa.
--
-- p_items is a JSON array like:
--   [{"product_id": "doll-01", "name": "...", "price": 549, "quantity": 2}, ...]
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
  v_quantity integer;
  v_current_stock integer;
  v_subtotal integer := 0;
  v_order_number text;
begin
  -- Pass 1: lock every affected product row and verify stock up front,
  -- so we never insert partial data before discovering a shortage.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := v_item->>'product_id';
    v_quantity := (v_item->>'quantity')::integer;

    select stock into v_current_stock
    from products
    where id = v_product_id
    for update;

    if v_current_stock is null then
      raise exception 'Product % does not exist', v_product_id;
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
    insert into order_items (order_id, product_id, name, price, quantity)
    values (
      v_order.id,
      v_item->>'product_id',
      v_item->>'name',
      (v_item->>'price')::integer,
      (v_item->>'quantity')::integer
    );

    update products
    set stock = stock - (v_item->>'quantity')::integer
    where id = v_item->>'product_id';
  end loop;

  return v_order;
end;
$$;

grant execute on function place_order(jsonb, text, text, text, text, text, text, text, text) to anon;
