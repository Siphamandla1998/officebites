import { createContext, useContext, useState, useCallback } from "react";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // { id, props }

  const openModal = useCallback((id, props = {}) => setActiveModal({ id, props }), []);
  const closeModal = useCallback(() => setActiveModal(null), []);

  return (
    <UIContext.Provider value={{ sidebarOpen, setSidebarOpen, activeModal, openModal, closeModal }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
