import { lazy } from "react";

// Lazy-loaded route components keep the initial PWA bundle small — important
// since this app targets mobile networks first.
export const Landing = lazy(() => import("../pages/shared/Landing"));
export const Login = lazy(() => import("../pages/auth/Login"));
export const Register = lazy(() => import("../pages/auth/Register"));

export const Home = lazy(() => import("../pages/customer/Home"));
export const CategoryDetail = lazy(() => import("../pages/customer/CategoryDetail"));
export const VendorListing = lazy(() => import("../pages/customer/VendorListing"));
export const VendorProfile = lazy(() => import("../pages/customer/VendorProfile"));
export const FoodDetails = lazy(() => import("../pages/customer/FoodDetails"));
export const Checkout = lazy(() => import("../pages/customer/Checkout"));
export const PaymentUpload = lazy(() => import("../pages/customer/PaymentUpload"));
export const TicketConfirmation = lazy(() => import("../pages/customer/TicketConfirmation"));
export const OrderTracking = lazy(() => import("../pages/customer/OrderTracking"));
export const OrderHistory = lazy(() => import("../pages/customer/OrderHistory"));
export const Profile = lazy(() => import("../pages/customer/Profile"));
export const Favourites = lazy(() => import("../pages/customer/Favourites"));
export const ChatList = lazy(() => import("../pages/customer/ChatList"));
export const Reviews = lazy(() => import("../pages/customer/Reviews"));

export const Notifications = lazy(() => import("../pages/shared/Notifications"));
export const ChatConversation = lazy(() => import("../pages/shared/ChatConversation"));

export const VendorOverview = lazy(() => import("../pages/vendor/VendorOverview"));
export const VendorOrders = lazy(() => import("../pages/vendor/VendorOrders"));
export const VendorMenu = lazy(() => import("../pages/vendor/VendorMenu"));
export const VendorRevenue = lazy(() => import("../pages/vendor/VendorRevenue"));
export const VendorInsights = lazy(() => import("../pages/vendor/VendorInsights"));
export const VendorChat = lazy(() => import("../pages/vendor/VendorChat"));
export const VendorNotifications = lazy(() => import("../pages/vendor/VendorNotifications"));
export const VendorSettings = lazy(() => import("../pages/vendor/VendorSettings"));

export const AdminOverview = lazy(() => import("../pages/admin/AdminOverview"));
export const AdminVendors = lazy(() => import("../pages/admin/AdminVendors"));
export const AdminCustomers = lazy(() => import("../pages/admin/AdminCustomers"));
export const AdminAnalytics = lazy(() => import("../pages/admin/AdminAnalytics"));
export const AdminReports = lazy(() => import("../pages/admin/AdminReports"));

export const HelpHome = lazy(() => import("../pages/help/HelpHome"));
export const FAQPage = lazy(() => import("../pages/help/FAQPage"));
export const ContactSupport = lazy(() => import("../pages/help/ContactSupport"));
export const ReportProblem = lazy(() => import("../pages/help/ReportProblem"));
export const SupportTickets = lazy(() => import("../pages/help/SupportTickets"));
export const LiveChatSupport = lazy(() => import("../pages/help/LiveChatSupport"));
export const Guides = lazy(() => import("../pages/help/Guides"));
export const GuideDetail = lazy(() => import("../pages/help/GuideDetail"));
export const Feedback = lazy(() => import("../pages/help/Feedback"));
export const Terms = lazy(() => import("../pages/help/Terms"));
export const Privacy = lazy(() => import("../pages/help/Privacy"));
export const RefundPolicy = lazy(() => import("../pages/help/RefundPolicy"));
export const BusinessHours = lazy(() => import("../pages/help/BusinessHours"));

export const NotFound = lazy(() => import("../pages/shared/NotFound"));
