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

import {
  Login,
  Register,
  ForgotPassword,
  ResetPassword,
  Home,
  CategoryDetail,
  FoodSearch,
  VendorListing,
  VendorProfile,
  FoodDetails,
  Checkout,
  PaymentUpload,
  TicketConfirmation,
  OrderTracking,
  TrackOrder,
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
  AdminChats,
  AdminSupport,
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

function PageFallback() {
  return (
    <div className="min-h-[60vh] ob-container py-6">
      <div className="animate-pulse">
        <div className="h-5 w-28 rounded-lg bg-nude-100 mb-6" />
        <div className="h-11 w-full rounded-xl bg-nude-100 mb-5" />

        <div className="flex gap-3 mb-7 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 w-16 rounded-2xl bg-nude-100 shrink-0"
            />
          ))}
        </div>

        <div className="h-5 w-36 rounded-lg bg-nude-100 mb-3" />

        <div className="grid grid-cols-2 gap-3.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <div className="h-36 rounded-2xl bg-nude-100" />
              <div className="h-3 w-3/4 rounded bg-nude-100 mt-3" />
              <div className="h-3 w-1/2 rounded bg-nude-100 mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Authentication */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Customer app */}
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<Home />} />

          <Route
            path="/home"
            element={<Navigate to="/" replace />}
          />

          <Route
            path="/categories/:id"
            element={<CategoryDetail />}
          />

          <Route
            path="/food/search"
            element={<FoodSearch />}
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
            path="/track"
            element={<TrackOrder />}
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

        {/* Checkout and payment */}
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

        {/* Individual chat conversation */}
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

        {/* Vendor dashboard */}
        <Route
          path="/vendor"
          element={
            <ProtectedRoute allowedRoles={[ROLES.VENDOR]}>
              <VendorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<VendorOverview />} />

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

        {/* Admin dashboard */}
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
            path="chats"
            element={<AdminChats />}
          />
          
          <Route
            path="support"
            element={<AdminSupport />}
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

        {/* Help and support */}
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

        {/* 404 */}
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
