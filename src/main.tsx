import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExplorationApp } from "./components/ExplorationApp";
import "../app/globals.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => undefined);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registration.update().catch(() => undefined);
        });
      })
      .catch((error) => {
        console.error("Exploration Atlas offline cache failed to register", error);
      });
  });
}

// 成都版是唯一版本，杭州版内容已删。
// ?run=xxx 给每次走查一个独立存档命名空间：存档按 checkpoint id 分键，不隔离的话
// 上一次走查的进度和照片会被下一次读出来。命名空间以 chengdu-test 开头时，终章会
// 出现「重新彩排」按钮（见 ExplorationApp）。
const params = new URLSearchParams(window.location.search);
const runNamespace = params.get("run")?.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 32);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ExplorationApp
      storageNamespace={runNamespace ? `chengdu-${runNamespace}` : "chengdu-formal-v1"}
    />
  </StrictMode>,
);
