import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useMemo } from "react";
import {
  createTRPCReact,
  httpBatchLink,
  httpBatchStreamLink,
  httpLink,
  httpSubscriptionLink,
  splitLink,
} from "@trpc/react-query";
import type { AppRouter } from "../../backend/src/index.js";

interface TRPCProviderProps {
  children: React.ReactNode;
}

export const trpcReact = createTRPCReact<AppRouter>();

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
            }),
            false: httpLink({
              url: (import.meta as any).env.VITE_APP_SERVER_URL,
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
