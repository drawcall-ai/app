import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";
import { polarClient } from "@polar-sh/better-auth";

export const authClient = createAuthClient({
  baseURL: (import.meta as any).env.VITE_APP_SERVER_URL,
  emailAndPassword: {
    enabled: false, // Disable email/password authentication
  },
  plugins: [anonymousClient(), polarClient()],
  socialProviders: {
    github: {
      enabled: true,
    },
    // Removed Google for now as it's commented out in backend
  },
});

export const { signIn, signOut, signUp, useSession } = authClient;
