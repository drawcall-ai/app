import { initTRPC } from "@trpc/server";
import {
  CreateFastifyContextOptions,
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import fastify from "fastify";
import cors from "@fastify/cors";
import { buildUikitRouter } from "./routes/uikit.js";
import { buildJobsRouter } from "./routes/jobs.js";
import { getSession, auth } from "./auth.js";
import { buildCustomerRouter } from "./routes/customer.js";
import { buildCheckoutRoutes } from "./checkout.js";

const abortController = new AbortController();
const cleanup = () => abortController.abort();
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Initialize tRPC
const trpc = initTRPC
  .context<Awaited<ReturnType<typeof createContext>>>()
  .create({});
export type TRPC = typeof trpc;

// Create the main app router
export const appRouter = trpc.router({
  uikit: buildUikitRouter(trpc, abortController.signal),
  jobs: buildJobsRouter(trpc, abortController.signal),
  customer: buildCustomerRouter(trpc, abortController.signal),
});

// Export type definition of API
export type AppRouter = typeof appRouter;

export const server = fastify({
  logger: {
    level: "error",
  },
});
abortController.signal.addEventListener("abort", () =>
  server
    .close()
    .catch((error) => server.log.error(error, "Error closing server"))
);

await server.register(cors, {
  origin: [
    "http://localhost:5173", // frontend dev server
    "https://app.drawcall.ai",
    "https://app.beta.drawcall.ai",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
});

buildCheckoutRoutes(server);

// Register Better Auth routes
server.all("/api/auth/*", async (request, reply) => {
  // Convert Fastify request to standard Request object
  const url = new URL(request.url, `http://${request.headers.host}`);
  const headers = new Headers();

  Object.entries(request.headers).forEach(([key, value]) => {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    }
  });

  const webRequest = new Request(url.toString(), {
    method: request.method,
    headers,
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? JSON.stringify(request.body)
        : undefined,
  });

  const response = await auth.handler(webRequest);

  // Copy response headers
  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });

  reply.status(response.status);
  return response.body;
});

const createContext = async ({ req, res }: CreateFastifyContextOptions) => {
  const session = await getSession(req);
  return {
    req,
    res,
    user: session?.user || null,
    session: session?.session || null,
  };
};

await server.register(fastifyTRPCPlugin, {
  prefix: "/",
  trpcOptions: {
    allowBatching: false,
    router: appRouter,
    createContext,
    onError({ path, error }) {
      // report to error monitoring
      server.log.error(error, `Error in tRPC handler on path '${path}'`);
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

await server.listen({ port: 8080, host: "0.0.0.0" });
server.log.info(`tRPC server running on http://127.0.0.1:8080`);
