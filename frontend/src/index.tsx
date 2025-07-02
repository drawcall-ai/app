import { createRoot } from "react-dom/client";
import "./global.css";
import { App } from "./app.js";
import { QueryClient } from "@tanstack/react-query";
import { TRPCProvider } from "./TRPCProvider.js";
import { NuqsAdapter } from "nuqs/adapters/react";

export const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <div className="bg-black text-white antialiased min-h-[100svh] relative overflow-hidden">
    <NuqsAdapter>
      <TRPCProvider>
        <App />
      </TRPCProvider>
    </NuqsAdapter>
  </div>
);
