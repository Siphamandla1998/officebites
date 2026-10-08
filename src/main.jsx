import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/index.css";
import { clearLegacyPrivateCaches } from './utils/privateCache';

clearLegacyPrivateCaches().catch(error => console.error('Could not clear legacy caches', error));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
