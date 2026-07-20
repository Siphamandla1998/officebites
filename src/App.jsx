import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { UIProvider } from "./context/UIContext";
import AppRoutes from "./routes/AppRoutes";
import OfflineBanner from "./components/layout/OfflineBanner";

export default function App() {
  return (
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
  );
}
