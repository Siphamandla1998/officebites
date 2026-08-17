# Connecting OfficeBites to Supabase

## 1. Create the project
1. Go to [supabase.com](https://supabase.com) → New Project.
2. Once it's ready, go to **Project Settings → API** and copy the **Project URL** and **anon public key**.
3. In this repo, copy `.env.example` to `.env.local` and paste those two values in:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_PUBLISHABLE_KEY=...
   ```

## 2. Run the schema
In the Supabase dashboard → **SQL Editor**, run these two files **in order**:
1. `supabase/migrations/0001_core_schema.sql` — tables, enums, RLS policies, the order-status trigger.
2. `supabase/migrations/0002_auth_trigger_and_storage.sql` — auto-creates a profile on signup, creates the 4 storage buckets and their access policies.

That's it — no manual bucket creation needed, the SQL does it.

## 3. Auth settings
Go to **Authentication → Providers → Email**. By default Supabase requires email confirmation before sign-in works. For faster testing, you can turn **"Confirm email"** off (Authentication → Settings) — just remember to turn it back on before real customers sign up, or add a proper email provider (Supabase's default email sending is rate-limited and not meant for production volume — set up a custom SMTP provider under Authentication → Settings → SMTP before launch).

## 4. Uploading your food photos
Your real photos are already organized in this repo at `supabase/seed-images/` (renamed to match each meal), and `supabase/seed_real_data.sql` now has your actual Office Bites menu and prices from the flyer — you just need to get the photos into Storage and paste their URLs in:

1. Supabase dashboard → **Storage** → `meal-images` bucket → **Upload files** → drag in everything from `supabase/seed-images/`.
2. Click each uploaded file → **Copy URL** → paste over the matching `image_url_here` in `seed_real_data.sql`.
3. Run that file in the SQL editor. Mock data gone, your real menu is live.

For anything new going forward (menu changes, a vendor logo, Sabe's Fast Bite's real photos once you have them): the "Add/Edit meal" form in the vendor menu page already uploads straight to this same bucket — no dashboard needed after this first seed.

## 5. What's actually live vs. still mock right now
Converted to Supabase this pass — these are real, persistent, and multi-device:
- **Accounts & login** (Supabase Auth + `profiles` table)
- **Vendors & menu** (`vendors`, `meals` tables + Storage for images)
- **Ordering & ticketing** (`orders`, `order_suborders`, `order_items` — full guest-or-logged-in checkout, payment upload, admin verification, vendor status pipeline, all enforced by a DB trigger too)
- **Admin**: vendor approval, payments review, customer list, live platform stats

Still running on the local mock/`localStorage` layer (by design, scoped out of this pass):
- **Messaging** (customer↔vendor chat, live support chat)
- **Notifications** (though they now fire on real order/payment events, not just a static list)
- **Support tickets, FAQs, guides**
- **Vendor dashboard's financial/payout view** (`VendorRevenue`'s payout history) and the weekly revenue chart on `VendorOverview`

None of the above will survive a refresh on a different device the way the converted pieces do — flagged clearly so nothing here is presented as more real than it is. Converting them follows the exact same pattern as `orderService`/`vendorService` (a `mappers.js`-style shape converter + swapping mock arrays for `supabase.from(...)` calls), so it's straightforward to pick up next.

## 6. Before you consider this "launched"
- **Turn on custom SMTP** for auth emails (see step 3).
- **Rotate/verify your RLS policies** — they're written and reasoned through in the migration file's comments, but should be checked against your actual data once real traffic hits it, especially the guest-order-by-id policy (anyone with an order's UUID can view it — that's intentional for guest order tracking, same trust model as most e-commerce order-lookup pages, but worth knowing).
- **`npm audit`** currently reports high-severity issues in the `vite-plugin-pwa` build toolchain and `react-router` — these are dev/build-time dependencies, not shipped runtime code, but worth patching when you have a moment to verify nothing breaks (react-router's fix is a major version bump).
- **Delete `src/mock/vendors.js` and `src/mock/meals.js`** once you've confirmed the real data seed is working — nothing in the app imports them anymore, they're just inert.
