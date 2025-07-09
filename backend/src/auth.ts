import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { anonymous } from "better-auth/plugins";
import { db } from "./db/index.js";
import { Polar } from "@polar-sh/sdk";
import { polar, portal, webhooks } from "@polar-sh/better-auth";
import { createClient, RedisClientType } from "redis";
import { FastifyRequest } from "fastify";
import { invalidateHasPolarAppBenefit } from "./utils.js";

export const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
});
await redisClient.connect();

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});

export function getSession(req: FastifyRequest) {
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    }
  });

  return auth.api.getSession({ headers });
}

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
      use: [
        portal(),
        webhooks({
          async onCustomerStateChanged(payload) {
            await invalidateHasPolarAppBenefit(payload.data.externalId!);
          },
          secret: process.env.POLAR_WEBHOOK_SECRET!,
        }),
      ],
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
