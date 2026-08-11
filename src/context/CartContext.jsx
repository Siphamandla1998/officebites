import { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "ob_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Customers can order from multiple vendors — cart items just carry vendorId,
  // and orderRules.splitCartByVendor() handles the checkout-time split.
  const addItem = useCallback((meal, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.mealId === meal.id);
      if (existing) {
        return prev.map((i) => (i.mealId === meal.id ? { ...i, qty: i.qty + qty } : i));
      }
      return [
        ...prev,
        {
          mealId: meal.id,
          name: meal.name,
          price: meal.price,
          image: meal.image,
          vendorId: meal.vendorId,
          vendorName: meal.vendorName,
          qty,
        },
      ];
    });
    setCartOpen(true);
  }, []);

  const removeItem = useCallback((mealId) => {
    setItems((prev) => prev.filter((i) => i.mealId !== mealId));
  }, []);

  const updateQty = useCallback((mealId, qty) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.mealId !== mealId)
        : prev.map((i) => (i.mealId === mealId ? { ...i, qty } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const { subtotal, count, vendorCount } = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const vendorCount = new Set(items.map((i) => i.vendorId)).size;
    return { subtotal, count, vendorCount };
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        subtotal,
        count,
        vendorCount,
        isCartOpen,
        setCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
