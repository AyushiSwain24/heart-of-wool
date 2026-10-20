# Heart of Wool 🧶

An online storefront for **Heart of Wool**, a small handmade business selling crochet dolls, resin charms, crochet charms and crochet keychains.

**Live site:** https://heart-of-wool.vercel.app

Customers can browse the catalogue, add items to a cart, check out with **UPI or Cash on Delivery**, and track their order using an order number. The shop owner gets a password-protected **Admin panel** to manage orders, products, colour variants, bundles and store-wide discounts, and receives an email whenever a new order is placed.

---

## Features

### Storefront
- **Home page** with a "How ordering works" guide and featured products
- **Shop** with category filters (Crochet Dolls, Resin Charms, Crochet Charms, Crochet Keychains), an *On Sale* filter and sorting
- **Product page** with colour variants (each colour has its own photo and stock), "Only N left" and "Sold out" badges
- **Bundles**: hand-picked product sets sold together at one price
- **Cart and checkout**: add products or bundles with quantities; checkout collects name, phone, email and address and supports UPI or COD
- **Discounts**: per-product percentage discounts, plus a store-wide "spend ₹X, save ₹Y" offer. The customer always gets whichever is cheaper; the two never stack.
- **Order confirmation** with a unique order number
- **Track order**: look up an order with its order number plus phone or email
- **Installable** on a phone home screen (web app manifest + service worker)

### Admin panel (`/admin`)
- Secure sign-in through Supabase Auth; only the registered admin can call admin functions
- **Orders**: view all orders, search, update status (placed → packed → shipped → delivered / cancelled), mark UPI payment as confirmed
- **Products**: add, edit and archive products, upload images (compressed in the browser before upload), manage colour variants and stock, set discounts
- **Bundles**: create and edit product bundles
- **Settings**: turn the store-wide spend discount on or off and set its threshold and amount

### Notifications
- Supabase **Edge Functions** + Database Webhooks email the owner (via Resend) whenever a new order or product is created

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router |
| Styling / UI | Tailwind CSS 4, Radix UI primitives, lucide-react icons, Sonner toasts |
| Backend / Database | Supabase (PostgreSQL, Row Level Security, SQL functions / RPC, Storage, Auth) |
| Serverless | Supabase Edge Functions (Deno) + Resend email API |
| Hosting | Vercel (with Vercel Web Analytics) |
| Tooling | Oxlint, TypeScript compiler |

---

## Project structure

```
heart-of-wool/
├── public/                 # Logo, icons, web app manifest, service worker
├── src/
│   ├── pages/              # Home, Products, ProductDetail, Cart, Checkout,
│   │                       # OrderConfirmation, TrackOrder, Contact, Admin
│   ├── components/
│   │   ├── layout/         # Header, Footer, Layout
│   │   ├── admin/          # ProductManager, BundleManager, SiteSettingsManager, forms
│   │   └── ui/             # Reusable Button, Input, Select, Badge, ...
│   ├── context/            # CartContext (shared cart state)
│   ├── hooks/              # useProducts, useBundles, useSiteSettings
│   ├── lib/                # Supabase client, order store, pricing logic, admin auth,
│   │                       # image compression
│   ├── data/               # Categories + fallback demo data
│   └── types/              # Shared TypeScript types
├── supabase/
│   ├── schema.sql          # Base tables: products, orders, order_items + RLS
│   ├── seed.sql            # 40 starter products
│   ├── migration_00X_*.sql # Admin auth, colours, discounts, bundles, spend discount
│   └── functions/          # notify-new-order, notify-new-product (Edge Functions)
├── SUPABASE_SETUP.md       # Step-by-step database setup guide
└── vercel.json             # SPA routing for Vercel
```

---

## How it works

1. The React app reads **active products, bundles and settings** from Supabase. Row Level Security means the public can only *read* active items.
2. At checkout, the app calls a single SQL function, `place_order()`. It re-checks stock, recalculates every price and discount **on the server** (so prices can't be tampered with in the browser), reduces stock and creates the order, all in one transaction.
3. Order tracking uses `find_order()`, which only returns an order when both the order number **and** the customer's phone or email match.
4. Admin actions go through SQL functions that first check `is_admin()`, so only the signed-in owner can change orders or products.
5. If Supabase isn't configured, the site falls back to built-in demo data so it still runs locally.

---

## Running locally

**Requirements:** Node.js 20+ and npm

```bash
git clone https://github.com/AyushiSwain24/heart-of-wool.git
cd heart-of-wool
npm install
npm run dev          # opens http://localhost:5173
```

Without Supabase keys the site runs on demo data.

### Connecting Supabase
1. Follow **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** to create a project, run `schema.sql`, the migrations and `seed.sql`.
2. Copy `.env.example` to `.env.local` and fill in:
   ```
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
   ```
3. Restart `npm run dev`.

### Production build
```bash
npm run build        # type-checks and builds into dist/
npm run preview      # serves the production build locally
```

### Deploying
Import the repository into **Vercel**, add the two `VITE_SUPABASE_*` environment variables, and deploy. `vercel.json` already handles page routing.

---

## Author

**Ayushi Swain** · [@AyushiSwain24](https://github.com/AyushiSwain24)
