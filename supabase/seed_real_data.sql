-- ============================================================================
-- OfficeBites — real data seed (Office Bites + Sabe's Fast Bite)
--
-- HOW TO USE THIS FILE:
-- 1. Supabase dashboard → Storage → `meal-images` bucket → Upload files.
--    Drag in the 3 files from supabase/seed-images/ in this repo:
--      - ujeqe-chicken-stew.jpg
--      - rice-stew-a.jpg   (confirm: chicken or beef?)
--      - rice-stew-b.jpg   (confirm: chicken or beef?)
-- 2. Click each uploaded file → "Copy URL", paste it over the matching
--    image_url_here below. rice-stew-a/b are placed provisionally as
--    chicken/beef — swap them if that turns out backwards.
-- 3. Run this whole file in the SQL editor.
--
-- Sabe's Fast Bite section below is unchanged from the placeholder version —
-- swap in real data the same way once you have it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Vendors
-- ---------------------------------------------------------------------------
insert into vendors (id, name, tagline, category, prep_time_mins, cover_image, logo, building, status, featured, subscription_tier, contact_number)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Office Bites',
    'Made the way home tastes — brought to your desk.',
    'Meals',
    25,
    'image_url_here', -- suggest: rice-stew-a.jpg or ujeqe-chicken-stew.jpg, whichever photographs best as a cover
    'image_url_here', -- no clean standalone logo yet — the flyer (seed-images/office-bites-flyer.png) has text baked in, better to crop a proper logo separately
    'Alice Lane Office Tower', -- placeholder — update to their real building/location
    'approved',
    true,
    'basic',
    '062 958 3991' -- WhatsApp ordering number from the flyer
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Sabe''s Fast Bite',
    'Fast food, kotas, shawarmas and platters made fresh.',
    'Kotas',
    20,
    'image_url_here',
    'image_url_here',
    'Alice Lane Office Tower',
    'approved',
    true,
    'basic',
    null
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Office Bites — real menu & prices from the flyer
-- ---------------------------------------------------------------------------
insert into meals (vendor_id, name, description, price, category, image, preparation_time, featured) values
  ('11111111-1111-1111-1111-111111111111', 'Chicken Stew & Rice/Phuthu', 'Home-style chicken stew served with rice or phuthu.', 58, 'Meals', 'image_url_here', 25, true), -- rice-stew-a.jpg or rice-stew-b.jpg, whichever is confirmed chicken
  ('11111111-1111-1111-1111-111111111111', 'Beef Stew & Rice/Phuthu', 'Tender beef stew served with rice or phuthu.', 70, 'Meals', 'image_url_here', 25, false), -- the other rice-stew photo
  ('11111111-1111-1111-1111-111111111111', 'uJeqe & Chicken Stew', 'Home-style chicken stew served with steamed uJeqe bread.', 65, 'Meals', 'image_url_here', 25, true), -- seed-images/ujeqe-chicken-stew.jpg — confirmed
  ('11111111-1111-1111-1111-111111111111', 'uJeqe & Beef Stew', 'Rich beef stew served with steamed uJeqe bread.', 75, 'Meals', 'image_url_here', 25, false), -- no photo yet
  ('11111111-1111-1111-1111-111111111111', 'Braai Meat & uJeqe/Pap', 'Fire-grilled braai meat served with uJeqe or pap.', 80, 'Meals', 'image_url_here', 30, true), -- no photo yet
  ('11111111-1111-1111-1111-111111111111', 'Coke', 'Ice-cold Coca-Cola.', 13, 'Drinks', 'image_url_here', 1, false),
  ('11111111-1111-1111-1111-111111111111', 'Fanta', 'Ice-cold Fanta.', 13, 'Drinks', 'image_url_here', 1, false),
  ('11111111-1111-1111-1111-111111111111', 'Sprite', 'Ice-cold Sprite.', 13, 'Drinks', 'image_url_here', 1, false);

-- ---------------------------------------------------------------------------
-- Sabe's Fast Bite — Kotas, Shawarmas, Platters (still placeholder — no real
-- photos or confirmed prices from you yet, unchanged from before)
-- ---------------------------------------------------------------------------
insert into meals (vendor_id, name, description, price, category, image, preparation_time, featured) values
  ('22222222-2222-2222-2222-222222222222', 'Regular Kota', 'Toast bread, lettuce, cheese, fried polony, chips and beef russian.', 36, 'Kotas', 'image_url_here', 15, true),
  ('22222222-2222-2222-2222-222222222222', 'Norman Kota', 'Everything in the Regular Kota, plus a chicken patty.', 46, 'Kotas', 'image_url_here', 15, false),
  ('22222222-2222-2222-2222-222222222222', 'Special Kota', 'Everything in the Norman Kota, plus extra cheese.', 60, 'Kotas', 'image_url_here', 15, true),
  ('22222222-2222-2222-2222-222222222222', 'Regular Chicken Shawarma', 'Grilled chicken shawarma wrap with fresh salad and sauces.', 37, 'Shawarmas', 'image_url_here', 12, false),
  ('22222222-2222-2222-2222-222222222222', 'Extra Large Chicken Shawarma', 'Extra large chicken shawarma wrap loaded with extra cheese.', 45, 'Shawarmas', 'image_url_here', 12, false),
  ('22222222-2222-2222-2222-222222222222', 'Is''thebe Platter', 'Full chicken, wors, beef slices and sauces — built for sharing.', 230, 'Platters', 'image_url_here', 35, true),
  ('22222222-2222-2222-2222-222222222222', 'Regular Platter', '2 kotas, a shawarma wrap, chopped yababa, 6 wings and sauces.', 210, 'Platters', 'image_url_here', 30, false),
  ('22222222-2222-2222-2222-222222222222', 'Platter for Two', 'Half chicken, chips, 2 hotdogs and sauces.', 150, 'Platters', 'image_url_here', 25, true),
  ('22222222-2222-2222-2222-222222222222', 'Platter 1', 'Chopped wors, 2 beef slices and sauces.', 120, 'Platters', 'image_url_here', 20, false);
