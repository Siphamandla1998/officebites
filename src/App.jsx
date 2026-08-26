import { useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { UIProvider } from "./context/UIContext";
import AppRoutes from "./routes/AppRoutes";
import OfflineBanner from "./components/layout/OfflineBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import Splash from "./components/layout/Splash";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ErrorBoundary>
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}
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
