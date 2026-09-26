import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "ob_cart";

function sanitiseStoredCart(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item) =>
        item &&
        item.mealId &&
        item.vendorId &&
        Number.isFinite(Number(item.price))
    )
    .map((item) => ({
      ...item,
      price: Number(item.price),
      qty: Math.max(1, Number(item.qty) || 1),
    }));
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) return [];

      return sanitiseStoredCart(JSON.parse(raw));
    } catch {
      return [];
    }
  });

  const [isCartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items)
      );
    } catch (error) {
      console.error(
        "Couldn't persist OfficeBites cart:",
        error
      );
    }
  }, [items]);

  const addItem = useCallback((meal, qty = 1) => {
    if (!meal?.id || !meal?.vendorId) {
      console.error(
        "Cannot add an invalid meal to cart:",
        meal
      );
      return;
    }

    const amount = Math.max(1, Number(qty) || 1);

    setItems((current) => {
      const existing = current.find(
        (item) => item.mealId === meal.id
      );

      if (existing) {
        return current.map((item) =>
          item.mealId === meal.id
            ? {
                ...item,
                qty: item.qty + amount,
              }
            : item
        );
      }

      return [
        ...current,
        {
          mealId: meal.id,
          name: meal.name,
          price: Number(meal.price),
          image: meal.image,
          vendorId: meal.vendorId,
          vendorName:
            meal.vendorName || "OfficeBites vendor",
          qty: amount,
        },
      ];
    });

    setCartOpen(true);
  }, []);

  const removeItem = useCallback((mealId) => {
    setItems((current) =>
      current.filter(
        (item) => item.mealId !== mealId
      )
    );
  }, []);

  const updateQty = useCallback((mealId, qty) => {
    const amount = Number(qty);

    setItems((current) => {
      if (!Number.isFinite(amount) || amount <= 0) {
        return current.filter(
          (item) => item.mealId !== mealId
        );
      }

      return current.map((item) =>
        item.mealId === mealId
          ? {
              ...item,
              qty: Math.max(1, Math.floor(amount)),
            }
          : item
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCartOpen(false);
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.price) * Number(item.qty),
      0
    );

    const count = items.reduce(
      (sum, item) => sum + Number(item.qty),
      0
    );

    const vendorCount = new Set(
      items.map((item) => item.vendorId)
    ).size;

    return {
      subtotal,
      count,
      vendorCount,
    };
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,

        addItem,
        removeItem,
        updateQty,
        clearCart,

        subtotal: totals.subtotal,

        // Keep both names while components are being migrated.
        count: totals.count,
        itemCount: totals.count,

        vendorCount: totals.vendorCount,

        isCartOpen,
        setCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used within CartProvider"
    );
  }

  return context;
}