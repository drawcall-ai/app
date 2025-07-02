import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { createTRPCReact, createWSClient, wsLink } from "@trpc/react-query";
import type { AppRouter } from "../../backend/src/index.js";

interface TRPCProviderProps {
  children: React.ReactNode;
}

export const trpcReact = createTRPCReact<AppRouter>();

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [wsClient, setWSClient] = useState<
    ReturnType<typeof createWSClient> | undefined
  >(undefined);

  useEffect(() => {
    const ws = createWSClient({
      url: (import.meta as any).env.VITE_APP_SERVER_URL,
    });
    setWSClient(ws);
    return () => void ws.close();
  }, []);

  const trpcClient = useMemo(
    () =>
      wsClient != null
        ? trpcReact.createClient({
            links: [wsLink<AppRouter>({ client: wsClient })],
          })
        : undefined,
    [trpcReact, wsClient]
  );

  const queryClient = useMemo(() => new QueryClient(), []);
  if (trpcClient == null) {
    return;
  }

  return (
    <trpcReact.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpcReact.Provider>
  );
}
