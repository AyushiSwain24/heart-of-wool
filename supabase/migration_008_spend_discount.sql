-- Heart of Wool — migration 008: site-wide spend-threshold discount
--
-- A single storewide deal: "spend ₹<threshold>+, get ₹<amount> off your
-- order." Configured in the admin panel (one setting, not per-product).
--
-- STACKING RULE (confirmed with the shop owner): this discount does NOT
-- stack with per-product discounts. Whichever gives the customer the
-- better price wins:
--   (a) each line at its own product-discounted price (today's behavior), vs
--   (b) the full-price (pre-product-discount) cart total minus the
--       spend-threshold amount, IF the full-price total meets the threshold.
-- The order is charged whichever of (a)/(b) is lower. This is computed
-- server-side in place_order() so it can't be bypassed from the client.
--
-- The ₹1000 threshold is checked against the FULL-PRICE subtotal (before
-- any product discounts), per the shop owner's explicit choice — simpler
-- to reason about and matches how (b) above is computed anyway.
--
-- Run this in Supabase Studio -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Requires migration_003 (is_admin()), migration_006
-- (product discounts), and migration_007 (bundles) to have already run.

-- ─────────────────────────────────────────────────────────────
-- 1. site_settings — single-row config table. Using one fixed-id row
-- (rather than a key/value table) keeps reads/writes trivial: there is
-- exactly one storewide deal, not a list of them.
-- ─────────────────────────────────────────────────────────────
create table if not exists site_settings (
  id boolean primary key default true check (id), -- always exactly one row (id = true)
  spend_discount_enabled boolean not null default false,
  spend_discount_threshold integer not null default 1000 check (spend_discount_threshold >= 0),
  spend_discount_amount integer not null default 0 check (spend_discount_amount >= 0),
  updated_at timestamptz not null default now()
);

insert into site_settings (id) values (true) on conflict (id) do nothing;

alter table site_settings enable row level security;

-- Public can read the setting (needed so the storefront can show "spend
-- ₹1000+ get ₹100 off" banners and compute the discount preview in the
-- cart) but never write it directly — only through the admin function below.
drop policy if exists "public can read site settings" on site_settings;
create policy "public can read site settings"
  on site_settings for select
  using (true);

grant select on site_settings to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. admin_update_site_settings — the only way to change the setting.
-- ─────────────────────────────────────────────────────────────
create or replace function admin_update_site_settings(
  p_spend_discount_enabled boolean,
  p_spend_discount_threshold integer,
  p_spend_discount_amount integer
)
returns site_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings site_settings;
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  update site_settings
  set spend_discount_enabled = p_spend_discount_enabled,
      spend_discount_threshold = p_spend_discount_threshold,
      spend_discount_amount = p_spend_discount_amount,
      updated_at = now()
  where id = true
  returning * into v_settings;

  return v_settings;
end;
$$;

grant execute on function admin_update_site_settings(boolean, integer, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. place_order — extended to apply the storewide spend discount when
-- it beats each line's own product discount, per the stacking rule above.
-- Everything else (per-item stock checks, bundle handling) is unchanged
-- from migration_007.
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
  v_full_price_subtotal integer := 0;   -- sum of base prices, ignoring product discounts
  v_product_discounted_subtotal integer := 0; -- today's behavior: each line at its own discount
  v_settings site_settings;
  v_spend_discount integer := 0;        -- the amount actually applied, for the response/insert
  v_final_subtotal integer;
  v_scale numeric;                      -- ratio applied to each line when the spend discount wins
  v_order_number text;
begin
  select * into v_settings from site_settings where id = true;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_bundle_id := nullif(v_item->>'bundle_id', '')::uuid;

    if v_bundle_id is not null then
      select bundle_price, name into v_bundle_price, v_bundle_name
      from bundles
      where id = v_bundle_id and is_active = true;

      if v_bundle_price is null then
        raise exception 'Bundle % does not exist or is no longer available', v_bundle_id;
      end if;

      -- Bundles are already a fixed deal price — they count at that price
      -- on BOTH sides of the comparison (no separate "product discount"
      -- concept applies to a bundle line).
      v_full_price_subtotal := v_full_price_subtotal + v_bundle_price * v_quantity;
      v_product_discounted_subtotal := v_product_discounted_subtotal + v_bundle_price * v_quantity;

      v_resolved_items := v_resolved_items || jsonb_build_object(
        'product_id', null,
        'name', v_bundle_name,
        'base_price', v_bundle_price,
        'quantity', v_quantity,
        'color_id', null,
        'color_name', null,
        'bundle_id', v_bundle_id,
        'bundle_name', v_bundle_name
      );
    else
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
      v_full_price_subtotal := v_full_price_subtotal + v_base_price * v_quantity;
      v_product_discounted_subtotal := v_product_discounted_subtotal + v_unit_price * v_quantity;

      v_resolved_items := v_resolved_items || jsonb_build_object(
        'product_id', v_product_id,
        'name', v_item_name,
        'base_price', v_base_price,
        'quantity', v_quantity,
        'color_id', v_color_id,
        'color_name', v_item->>'color_name',
        'bundle_id', null,
        'bundle_name', null
      );
    end if;
  end loop;

  -- Decide which pricing wins: each line's own product discount, or the
  -- storewide spend-threshold discount applied to the full-price total —
  -- whichever gives the LOWER total. The threshold is checked against
  -- the full-price subtotal (before product discounts), per the shop
  -- owner's choice.
  if v_settings.spend_discount_enabled
     and v_full_price_subtotal >= v_settings.spend_discount_threshold
     and v_settings.spend_discount_amount > 0
  then
    v_spend_discount := least(v_settings.spend_discount_amount, v_full_price_subtotal);
  end if;

  if v_spend_discount > 0 and (v_full_price_subtotal - v_spend_discount) < v_product_discounted_subtotal then
    -- Spend-threshold pricing wins — every line is scaled down proportionally
    -- from its full (non-product-discounted) price so line items still sum
    -- to the final total, and product-level discounts are NOT also applied.
    v_final_subtotal := v_full_price_subtotal - v_spend_discount;
    v_scale := case when v_full_price_subtotal > 0 then v_final_subtotal::numeric / v_full_price_subtotal else 1 end;
  else
    -- Product-discounted pricing wins (or there's no qualifying spend
    -- discount at all) — same behavior as before this migration.
    v_final_subtotal := v_product_discounted_subtotal;
    v_scale := null; -- signals "use each line's own product-discounted price" below
    v_spend_discount := 0;
  end if;

  v_order_number := next_order_number();

  insert into orders (
    order_number, customer_name, email, phone, address, city, pincode,
    payment_method, payment_confirmed, status, notes, subtotal
  ) values (
    v_order_number, p_customer_name, p_email, p_phone, p_address, p_city, p_pincode,
    p_payment_method, false, 'placed', p_notes, v_final_subtotal
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(v_resolved_items)
  loop
    v_product_id := v_item->>'product_id';
    v_quantity := (v_item->>'quantity')::integer;
    v_color_id := nullif(v_item->>'color_id', '')::uuid;
    v_bundle_id := nullif(v_item->>'bundle_id', '')::uuid;
    v_base_price := (v_item->>'base_price')::integer;

    if v_scale is null then
      -- Product-discounted pricing won — recompute this line's own
      -- discounted unit price (bundles: base_price already IS the deal price).
      if v_bundle_id is not null then
        v_unit_price := v_base_price;
      else
        select discount_percent into v_discount_percent from products where id = v_product_id;
        v_unit_price := round(v_base_price * (100 - v_discount_percent) / 100.0);
      end if;
    else
      -- Spend-threshold pricing won — every line (including bundles)
      -- scales down proportionally from its full price, and per-product
      -- discounts are ignored for this order.
      v_unit_price := round(v_base_price * v_scale);
    end if;

    insert into order_items (order_id, product_id, name, price, quantity, color_id, color_name, bundle_id, bundle_name)
    values (
      v_order.id,
      v_product_id,
      v_item->>'name',
      v_unit_price,
      v_quantity,
      v_color_id,
      v_item->>'color_name',
      v_bundle_id,
      v_item->>'bundle_name'
    );

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

notify pgrst, 'reload schema';

-- Verify: site_settings should now exist with exactly one row.
select spend_discount_enabled, spend_discount_threshold, spend_discount_amount from site_settings;
