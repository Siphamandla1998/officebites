# OfficeBites — Frontend Foundation

A mobile-first Progressive Web App for the office food marketplace and vendor
operating system. This is the **foundation build**: full architecture,
routing, design system, auth flow, and all three role-based applications
(Customer / Vendor / Admin), wired to a mock service layer that mirrors the
shape of a real API.

## Stack

React 19 · Vite · JavaScript (no TypeScript) · Tailwind CSS · React Router ·
Axios · Context API · React Icons · `vite-plugin-pwa`

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build      # production build + service worker
npm run preview    # serve the production build locally
```

Demo accounts (any password works — the auth layer is mocked):

| Role     | Email                        |
|----------|-------------------------------|
| Customer | customer@officebites.co.za    |
| Vendor   | vendor@officebites.co.za      |
| Admin    | admin@officebites.co.za       |

## Architecture

```
src/
  components/
    layout/       Navbar, BottomNav, Sidebar, OfflineBanner
    features/     FoodCard, VendorCard, CategoryCard, OrderCard,
                   TicketCard, CartDrawer
    ui/           Modal, Toast, StatusBadge, SearchBar, Filters,
                   Table, StatCard, Rating, Avatar, Spinner, EmptyState
    forms/        TextField, TextAreaField, SelectField, FileUpload
    charts/       BarChart, LineChart (dependency-free SVG charts)
  pages/
    auth/         Login, Register
    customer/      Home, VendorListing, VendorProfile, FoodDetails,
                   Checkout, PaymentUpload, TicketConfirmation,
                   OrderTracking, OrderHistory, Profile, Favourites,
                   ChatList, Reviews, CategoryDetail
    vendor/        Overview, Orders, Menu, Revenue, Insights, Chat
    admin/         Overview, Vendors, Customers, Analytics, Reports
    shared/        Landing, Notifications, ChatConversation, NotFound
  layouts/          CustomerLayout, VendorLayout, AdminLayout,
                    AuthLayout, PublicLayout
  routes/           AppRoutes (all route wiring), ProtectedRoute (role guard)
  context/          AuthContext, CartContext, ToastContext, UIContext
  services/         authService, foodService, vendorService, orderService,
                    paymentService, notificationService, chatService,
                    adminService, api/axiosClient, api/mockAdapter
  mock/             categories, vendors, meals, users, orders, reviews,
                    chats, analytics — the mock "database"
  hooks/            useAsync, useDebounce, useOnlineStatus
  utils/            constants, formatters, orderRules (business rules)
  styles/           index.css — design tokens + component classes
```

### Why it's built this way

- **Service layer first.** Every page talks to a `services/*Service.js`
  file, never to `mock/*` directly. Swapping a mock function body for a real
  `axiosClient` call is the only change needed to go live — no component
  changes required.
- **Business rules live in `utils/orderRules.js`.** The 19:00-previous-day
  cutoff, the multi-vendor cart split, commission calculation, and ticket
  number generation are all centralised there, not scattered across
  components.
- **One checkout, split internally.** `CartContext` stores a flat list of
  items tagged with `vendorId`. `splitCartByVendor()` is the single place
  that turns that into vendor-scoped sub-orders — used identically at
  checkout time and inside the cart drawer preview.
- **Role-based routing.** `ProtectedRoute` gates every branch by
  `allowedRoles`, and each role gets its own layout (`CustomerLayout` with
  bottom-tab navigation for mobile, `VendorLayout`/`AdminLayout` with a
  collapsible sidebar for dashboard work).
- **Mobile-first shell.** The customer app renders inside a
  `max-w-app` (480px) centered frame with a shadow, so it reads as an
  installable mobile app even on a desktop browser.

## PWA

- `vite-plugin-pwa` generates the manifest and service worker at build time
  (`npm run build` → `dist/sw.js`, `dist/manifest.webmanifest`).
- Runtime caching: images use cache-first (14 days), API-shaped requests use
  network-first with a 1-day fallback cache, so menus remain browsable
  offline once visited.
- `OfflineBanner` (in `App.jsx`) shows a persistent banner when
  `navigator.onLine` goes false.
- Icons are placeholder monograms in `public/icons/` — swap
  `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` for final brand
  assets before shipping.

## Design system

Colours, radii, shadows and animation are all defined in
`tailwind.config.js` (`ink`, `paper`, `nude` scale) — white / black / nude
per the brand brief, with Poppins as the sole typeface. Shared component
classes (`.btn-primary`, `.card`, `.input`, `.badge`, `.skeleton`, …) live in
`src/styles/index.css` so every page composes from the same primitives
instead of repeating Tailwind utility strings.

## What's mocked vs. real

Everything under `src/mock/` and `src/services/` is mock data — realistic
enough to exercise every screen and business rule, but in-memory only
(resets on reload, beyond what's persisted to `localStorage` for cart/auth
session). `services/api/axiosClient.js` is a ready-to-use Axios instance
(auth header interceptor included) for when a real backend exists.

## Next steps (iterate feature-by-feature from here)

- Wire real endpoints into each `*Service.js` (signatures won't need to change)
- Replace placeholder PWA icons/screenshots with final brand assets
- Add form validation library if forms grow more complex
- Add pagination/infinite scroll to vendor & menu listings
- Real-time order status (WebSocket/poll) for `OrderTracking`
- Push notifications for order status changes (Phase 2 per product doc)
