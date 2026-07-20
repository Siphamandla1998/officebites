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
  Landing,
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
  AdminOverview,
  AdminVendors,
  AdminCustomers,
  AdminAnalytics,
  AdminReports,
  NotFound,
} from "./routeComponents";

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size={26} />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
        </Route>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Customer app */}
        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER]}>
              <CustomerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<Home />} />
          <Route path="/categories/:id" element={<CategoryDetail />} />
          <Route path="/vendors" element={<VendorListing />} />
          <Route path="/vendors/:id" element={<VendorProfile />} />
          <Route path="/food/:id" element={<FoodDetails />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/orders/:orderId" element={<OrderTracking />} />
          <Route path="/orders/:orderId/ticket" element={<TicketConfirmation />} />
          <Route path="/orders/:orderId/review" element={<Reviews />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/favourites" element={<Favourites />} />
          <Route path="/chat" element={<ChatList />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        {/* Routes without bottom nav but still customer-scoped */}
        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER]}>
              <PublicLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment/:orderId" element={<PaymentUpload />} />
        </Route>

        {/* Shared chat conversation (customer + vendor) */}
        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER, ROLES.VENDOR]}>
              <PublicLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/chat/:id" element={<ChatConversation />} />
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
          <Route path="orders" element={<VendorOrders />} />
          <Route path="menu" element={<VendorMenu />} />
          <Route path="revenue" element={<VendorRevenue />} />
          <Route path="insights" element={<VendorInsights />} />
          <Route path="chat" element={<VendorChat />} />
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
          <Route index element={<AdminOverview />} />
          <Route path="vendors" element={<AdminVendors />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="reports" element={<AdminReports />} />
        </Route>

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
