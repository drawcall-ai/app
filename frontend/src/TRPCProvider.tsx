import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useMemo } from "react";
import {
  createTRPCReact,
  httpLink,
  httpSubscriptionLink,
  splitLink,
  CreateTRPCReact,
} from "@trpc/react-query";
import type { AppRouter } from "../../backend/src/index.js";

interface TRPCProviderProps {
  children: React.ReactNode;
}

export const trpcReact: CreateTRPCReact<AppRouter, unknown> =
  createTRPCReact<AppRouter>();

export function TRPCProvider({ children }: TRPCProviderProps) {
  const trpcClient = useMemo(
    () =>
      trpcReact.createClient({
        links: [
          splitLink({
            // uses the httpSubscriptionLink for subscriptions
            condition: (op) => op.type === "subscription",
            true: httpSubscriptionLink({
              url: (import.meta as any).env.VITE_APP_SERVER_URL,
              eventSourceOptions() {
                return {
                  withCredentials: true,
                };
              },
            }),
            false: httpLink({
              url: (import.meta as any).env.VITE_APP_SERVER_URL,
              fetch: (url, options) => {
                return fetch(url, {
                  ...options,
                  credentials: "include", // Include cookies in requests
                });
              },
            }),
          }),
        ],
      }),
    []
  );

  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <trpcReact.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpcReact.Provider>
  );
}
