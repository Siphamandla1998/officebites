```jsx
import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import { ROLES } from "../utils/constants";

import CustomerLayout from "../layouts/CustomerLayout";
import VendorLayout from "../layouts/VendorLayout";
import AdminLayout from "../layouts/AdminLayout";
import AuthLayout from "../layouts/AuthLayout";
import PublicLayout from "../layouts/PublicLayout";

import Spinner from "../components/ui/Spinner";
import { useAuth } from "../context/AuthContext";

import {
  Login,
  Register,

  Home,
  CategoryDetail,
  VendorListing,
  VendorProfile,
  FoodDetails,
  Checkout,
  PaymentUpload,
  TicketConfirmation,
  OrderTracking,
  OrderHistory,
  Profile,
  Favourites,
  ChatList,
  Reviews,
  Notifications,
  ChatConversation,

  VendorOverview,
  VendorOrders,
  VendorMenu,
  VendorRevenue,
  VendorInsights,
  VendorChat,
  VendorNotifications,
  VendorSettings,

  AdminOverview,
  AdminPayments,
  AdminVendors,
  AdminCustomers,
  AdminAnalytics,
  AdminReports,

  HelpHome,
  FAQPage,
  ContactSupport,
  ReportProblem,
  SupportTickets,
  LiveChatSupport,
  Guides,
  GuideDetail,
  Feedback,
  Terms,
  Privacy,
  RefundPolicy,
  BusinessHours,

  NotFound,
} from "./routeComponents";


/*
 * ---------------------------------------------------------
 * ROLE HOME
 * ---------------------------------------------------------
 *
 * Decides where an authenticated user should land.
 */
const ROLE_HOME = {
  [ROLES.CUSTOMER]: "/",
  [ROLES.VENDOR]: "/vendor",
  [ROLES.ADMIN]: "/admin",
};


/*
 * ---------------------------------------------------------
 * PAGE FALLBACK
 * ---------------------------------------------------------
 */
function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size={28} />
    </div>
  );
}


/*
 * ---------------------------------------------------------
 * ROLE-AWARE HOME
 * ---------------------------------------------------------
 *
 * This is the important fix.
 *
 * When a vendor closes the browser and later opens
 * OfficeBites again, Supabase restores the session.
 *
 * AuthContext loads the profile and gives us:
 *
 * user.role === "vendor"
 *
 * Instead of blindly rendering the customer Home page,
 * this component sends the user to /vendor.
 *
 * Guests still see the normal customer Home page.
 */
function RoleAwareHome() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageFallback />;
  }

  if (!user) {
    return <Home />;
  }

  const destination = ROLE_HOME[user.role];

  if (destination && destination !== "/") {
    return <Navigate to={destination} replace />;
  }

  return <Home />;
}


/*
 * ---------------------------------------------------------
 * ROLE-AWARE HOME REDIRECT
 * ---------------------------------------------------------
 *
 * Handles /home as well.
 */
function RoleAwareHomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageFallback />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Navigate
      to={ROLE_HOME[user.role] || "/"}
      replace
    />
  );
}


/*
 * ---------------------------------------------------------
 * APPLICATION ROUTES
 * ---------------------------------------------------------
 */
export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>

        {/* =================================================
            AUTH
            ================================================= */}

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>


        {/* =================================================
            CUSTOMER / PUBLIC APP
            ================================================= */}

        <Route element={<CustomerLayout />}>

          {/* IMPORTANT:
              / is now role-aware.
          */}
          <Route path="/" element={<RoleAwareHome />} />

          <Route
            path="/home"
            element={<RoleAwareHomeRedirect />}
          />

          <Route
            path="/categories/:id"
            element={<CategoryDetail />}
          />

          <Route
            path="/vendors"
            element={<VendorListing />}
          />

          <Route
            path="/vendors/:id"
            element={<VendorProfile />}
          />

          <Route
            path="/food/:id"
            element={<FoodDetails />}
          />

          <Route
            path="/orders"
            element={<OrderHistory />}
          />

          <Route
            path="/orders/:orderId"
            element={<OrderTracking />}
          />

          <Route
            path="/orders/:orderId/ticket"
            element={<TicketConfirmation />}
          />

          <Route
            path="/orders/:orderId/review"
            element={<Reviews />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/favourites"
            element={<Favourites />}
          />

          <Route
            path="/chat"
            element={<ChatList />}
          />

          <Route
            path="/notifications"
            element={<Notifications />}
          />

        </Route>


        {/* =================================================
            CHECKOUT / PAYMENT
            ================================================= */}

        <Route element={<PublicLayout />}>

          <Route
            path="/checkout"
            element={<Checkout />}
          />

          <Route
            path="/payment/:orderId"
            element={<PaymentUpload />}
          />

        </Route>


        {/* =================================================
            CUSTOMER / VENDOR CHAT THREAD
            ================================================= */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                ROLES.CUSTOMER,
                ROLES.VENDOR,
              ]}
            >
              <PublicLayout />
            </ProtectedRoute>
          }
        >

          <Route
            path="/chat/:id"
            element={<ChatConversation />}
          />

        </Route>


        {/* =================================================
            VENDOR DASHBOARD
            ================================================= */}

        <Route
          path="/vendor"
          element={
            <ProtectedRoute
              allowedRoles={[ROLES.VENDOR]}
            >
              <VendorLayout />
            </ProtectedRoute>
          }
        >

          <Route
            index
            element={<VendorOverview />}
          />

          <Route
            path="orders"
            element={<VendorOrders />}
          />

          <Route
            path="menu"
            element={<VendorMenu />}
          />

          <Route
            path="revenue"
            element={<VendorRevenue />}
          />

          <Route
            path="insights"
            element={<VendorInsights />}
          />

          <Route
            path="chat"
            element={<VendorChat />}
          />

          <Route
            path="notifications"
            element={<VendorNotifications />}
          />

          <Route
            path="settings"
            element={<VendorSettings />}
          />

        </Route>


        {/* =================================================
            ADMIN DASHBOARD
            ================================================= */}

        <Route
          path="/admin"
          element={
            <ProtectedRoute
              allowedRoles={[ROLES.ADMIN]}
            >
              <AdminLayout />
            </ProtectedRoute>
          }
        >

          <Route
            index
            element={<AdminOverview />}
          />

          <Route
            path="payments"
            element={<AdminPayments />}
          />

          <Route
            path="vendors"
            element={<AdminVendors />}
          />

          <Route
            path="customers"
            element={<AdminCustomers />}
          />

          <Route
            path="analytics"
            element={<AdminAnalytics />}
          />

          <Route
            path="reports"
            element={<AdminReports />}
          />

        </Route>


        {/* =================================================
            HELP & SUPPORT
            ================================================= */}

        <Route element={<PublicLayout />}>

          <Route
            path="/help"
            element={<HelpHome />}
          />

          <Route
            path="/help/faq"
            element={<FAQPage />}
          />

          <Route
            path="/help/contact"
            element={<ContactSupport />}
          />

          <Route
            path="/help/report"
            element={<ReportProblem />}
          />

          <Route
            path="/help/tickets"
            element={<SupportTickets />}
          />

          <Route
            path="/help/chat"
            element={<LiveChatSupport />}
          />

          <Route
            path="/help/guides"
            element={<Guides />}
          />

          <Route
            path="/help/guides/:id"
            element={<GuideDetail />}
          />

          <Route
            path="/help/feedback"
            element={<Feedback />}
          />

          <Route
            path="/help/terms"
            element={<Terms />}
          />

          <Route
            path="/help/privacy"
            element={<Privacy />}
          />

          <Route
            path="/help/refunds"
            element={<RefundPolicy />}
          />

          <Route
            path="/help/hours"
            element={<BusinessHours />}
          />

        </Route>


        {/* =================================================
            404
            ================================================= */}

        <Route
          path="/404"
          element={<NotFound />}
        />

        <Route
          path="*"
          element={<Navigate to="/404" replace />}
        />

      </Routes>
    </Suspense>
  );
}
```
