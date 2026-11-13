import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initLanguage } from "./i18n/i18n";
import "./styles.css";

// Load the saved (or the browser's) language first, so the first paint is already translated.
void initLanguage().finally(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
