import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "@/src/App";
import "@/src/styles/theme.css";
import "@/src/styles/screens.css";

// 走查用 ?run=test：存档独立，终章会多一个「重新走一遍」。
const runNamespace = new URLSearchParams(window.location.search).get("run");
const namespace = runNamespace ? `walk-${runNamespace}` : "formal";

registerSW({ immediate: true });

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App namespace={namespace} />
    </StrictMode>,
  );
}
