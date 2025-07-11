import { createRoot } from "react-dom/client";
import "./global.css";
import { App } from "./app.js";
import { QueryClient } from "@tanstack/react-query";
import { TRPCProvider } from "./TRPCProvider.js";
import { NuqsAdapter } from "nuqs/adapters/react";
import { PostHogProvider } from "posthog-js/react";

export const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <PostHogProvider
    apiKey={(import.meta as any).env.VITE_PUBLIC_POSTHOG_KEY}
    options={{
      api_host: (import.meta as any).env.VITE_PUBLIC_POSTHOG_HOST,
      defaults: "2025-05-24",
      capture_exceptions: true,
      debug: (import.meta as any).env.MODE === "development",
    }}
  >
    <div className="bg-black text-white antialiased min-h-[100svh] relative overflow-hidden">
      <NuqsAdapter>
        <TRPCProvider>
          <App />
        </TRPCProvider>
      </NuqsAdapter>
    </div>
  </PostHogProvider>
);
