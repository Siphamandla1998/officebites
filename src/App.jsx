import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { UIProvider } from "./context/UIContext";

import AppRoutes from "./routes/AppRoutes";
import OfflineBanner from "./components/layout/OfflineBanner";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <UIProvider>
            <ToastProvider>
              <CartProvider>
                <OfflineBanner />
                <AppRoutes />
              </CartProvider>
            </ToastProvider>
          </UIProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
