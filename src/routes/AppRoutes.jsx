```jsx
import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import { ROLES } from "../utils/constants";
import { useAuth } from "../context/AuthContext";

import CustomerLayout from "../layouts/CustomerLayout";
import VendorLayout from "../layouts/VendorLayout";
import AdminLayout from "../layouts/AdminLayout";
import AuthLayout from "../layouts/AuthLayout";
import PublicLayout from "../layouts/PublicLayout";

import Spinner from "../components/ui/Spinner";

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
  NotFound
} from "./routeComponents";

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size={28} />
    </div>
  );
}

function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageFallback />;
  }

  if (!user) {
    return <Home />;
  }

  if (user.role === ROLES.VENDOR) {
    return <Navigate to="/vendor" replace />;
  }

  if (user.role === ROLES.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  return <Home />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<CustomerLayout />}>
          <Route path="/" element={<HomeRoute />} />

          <Route
            path="/home"
            element={<Navigate to="/" replace />}
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

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[ROLES.CUSTOMER, ROLES.VENDOR]}
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

        <Route
          path="/vendor"
          element={
            <ProtectedRoute allowedRoles={[ROLES.VENDOR]}>
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

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
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
