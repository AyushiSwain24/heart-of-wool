# Connecting Heart of Wool to Supabase

This turns on real, persistent orders and products (instead of the in-memory
mock data that resets on every page reload). Takes about 10 minutes.

## 1. Create a free Supabase account and project

1. Go to https://supabase.com and click **Start your project**.
2. Sign up (GitHub login is fastest, or use email).
3. Click **New project**.
4. Fill in:
   - **Name**: `heart-of-wool` (or anything you like)
   - **Database password**: generate/save a strong one — you likely won't
     need it day-to-day, but store it somewhere safe just in case.
   - **Region**: pick whichever is closest to you (e.g. Mumbai/Singapore for India).
5. Click **Create new project** and wait ~1–2 minutes while it provisions.

## 2. Run the schema

1. In your new project, open the left sidebar → **SQL Editor**.
2. Click **New query**.
3. Open `supabase/schema.sql` from this project, copy its entire contents,
   paste into the SQL editor, and click **Run**.
4. You should see "Success. No rows returned." This created the `products`,
   `orders`, and `order_items` tables, plus the security rules and helper
   functions the app uses.

## 3. Load the starter products

1. Still in **SQL Editor**, click **New query** again.
2. Open `supabase/seed.sql` from this project, copy its contents, paste, and **Run**.
3. This inserts the 40 dummy products (10 each: crochet dolls, resin charms,
   crochet charms, crochet keychains). You can re-run this file safely later —
   it updates existing rows instead of duplicating them.
4. To verify: sidebar → **Table Editor** → `products` — you should see 40 rows.

## 4. Get your API credentials

1. Sidebar → **Project Settings** (gear icon) → **API**.
2. You need two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string under "Project API keys"
   (Do NOT use the `service_role` key for this — that one is secret and
   must never go in frontend code.)

## 5. Plug the credentials into the app

1. In the project folder, copy `.env.example` to a new file named `.env.local`.
2. Fill in the two values:
   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=your-long-anon-key-here
   ```
3. Save the file. `.env.local` is already gitignored, so these stay out of
   version control.
4. Restart the dev server if it's running (`npm run dev`).

That's it — the app auto-detects the credentials and switches from mock data
to your live Supabase database. Products now come from the `products` table,
and placing an order / tracking it / updating status in `/admin` all persist
for real, surviving page reloads and restarts.

## What to double check afterward

- Browse `/products` — items should load (a brief "Loading products…" flash,
  then the same 40 items, now served from Supabase).
- Place a test order at `/checkout`, then reload the page and look it up
  again at `/track-order` with the same order number + email — it should
  still be there.
- Log into `/admin` (password `heartofwool-admin` for now) and change that
  test order's status — then check `/track-order` again to confirm the
  status updated.

## 6. Admin product management (add/edit/archive products + images)

If your project was set up before this feature existed, you need one more
migration:

1. Sidebar → **SQL Editor** → **New query**.
2. Open `supabase/migration_002_admin_products.sql` from this project, copy
   its entire contents, paste, and **Run**.
3. This adds: the `is_active` column on `products` (used to archive a
   product instead of deleting it), a public `product-images` Storage
   bucket, and the `admin_*` functions the `/admin` → Products tab uses to
   create/edit/archive products and upload images.
4. If you're starting a brand-new project instead, running `schema.sql`
   (step 2 above) already includes `is_active` — you only need to run
   `migration_002_admin_products.sql` for the Storage bucket + admin
   functions either way.

Once that's run, open `/admin`, go to the **Products** tab, and you can add
new products, edit existing ones, upload a photo (it's automatically
resized/compressed in your browser before upload, so a phone photo of a few
MB becomes a small file), and archive products you no longer sell. Archived
products disappear from the shop but stay linked to any past orders that
included them — they're never deleted.

## 7. Real admin login (do this before sharing your live URL)

The `/admin` page used to be protected by a plain password typed into the
browser — that was fine for local testing, but once your site is live at a
public URL, that password (and the ability to call every admin database
function directly, bypassing the password screen entirely) is visible to
anyone who opens the page source. `migration_003_admin_auth.sql` replaces
that with real Supabase Auth.

1. Sidebar → **Authentication** → **Users** → **Add user** → **Create new
   user**. Enter your own email and a strong password, and toggle **Auto
   Confirm User** on.
2. Open `supabase/migration_003_admin_auth.sql` from this project. Near the
   top, find the `is_admin()` function and replace `'YOUR_EMAIL_HERE'` with
   the exact email you just used in step 1.
3. Sidebar → **SQL Editor** → **New query** → paste the (edited) file →
   **Run**.
4. This locks `list_all_orders`, `update_order_status`,
   `update_payment_confirmed`, `admin_list_products`, `admin_create_product`,
   `admin_update_product`, `admin_set_product_active`, and the
   `product-images` upload/replace policy so only your logged-in account can
   call them — an anonymous visitor (or anyone with just your public API
   key) can no longer touch orders or products at all.
5. `/admin` now shows a real email + password login instead of the old
   password box. Log in with the account from step 1.

The public-facing functions (`find_order`, `find_order_items`,
`next_order_number`, `place_order`) are untouched and stay open — those
power checkout and order tracking, which intentionally have no login.

If you ever need a second person to manage the shop, add another user in
Authentication → Users and add their email to the `is_admin()` function
(change the `email = 'YOUR_EMAIL_HERE'` check to an `in (...)` list).

## 8. Email yourself when a new product is added (optional)

`supabase/migration_004_product_notify.sql` sets up an email notification
(via Resend, a free-tier transactional email service) that fires whenever
a product is inserted — a quick confirmation/audit trail, useful if
someone else ever adds products too. It's mostly dashboard steps rather
than SQL — open that file and follow steps 1–4 in order. You'll need:

- A free Resend account (resend.com) and an API key.
- The Supabase CLI installed (`npm install -g supabase`) to deploy the
  Edge Function in `supabase/functions/notify-new-product/`.

This is optional — skip it if you don't need the notification.
