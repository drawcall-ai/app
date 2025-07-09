import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { anonymous } from "better-auth/plugins";
import { db } from "./db/index.js";
import { Polar } from "@polar-sh/sdk";
import { polar, portal } from "@polar-sh/better-auth";

const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: "sandbox",
});

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql", // or "mysql", "sqlite"
  }),
  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await db.job.updateMany({
          where: { userId: anonymousUser.user.id },
          data: {
            userId: newUser.user.id,
          },
        });
      },
    }),
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [portal()],
    }),
  ],
  emailAndPassword: {
    enabled: false, // Disable email/password authentication
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    //google: {
    //  clientId: process.env.GOOGLE_CLIENT_ID!,
    //  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    //},
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  // Environment variables
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    "http://localhost:5173", // frontend dev server
    "https://app.drawcall.ai",
    "https://app.beta.drawcall.ai",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
