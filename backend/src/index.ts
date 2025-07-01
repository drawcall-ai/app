import { initTRPC } from "@trpc/server";
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import fastify from "fastify";
import cors from "@fastify/cors";
import ws from "@fastify/websocket";

const abortController = new AbortController();
const cleanup = () => abortController.abort();
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
export const abortSignal = abortController.signal;

// Initialize tRPC
const trpc = initTRPC.create();
export type TRPC = typeof trpc;

// Create the main app router
export const appRouter = trpc.router({
  uikit: buildUikitRouter(trpc, client),
  jobs: buildJobsRouter(trpc, client),
});

// Export type definition of API
export type AppRouter = typeof appRouter;
export type { Job } from "./db/index.js";
export { type DefaultDataTransformer } from "@trpc/server";

const server = fastify({
  maxParamLength: 5000,
});
abortSignal.addEventListener("abort", () =>
  server.close().catch((error) => logger.error(error, "Error closing server"))
);

await server.register(cors);
await server.register(ws);
await server.register(fastifyTRPCPlugin, {
  prefix: "/",
  useWSS: true,
  trpcOptions: {
    router: appRouter,
    onError({ path, error }) {
      // report to error monitoring
      logger.error(error, `Error in tRPC handler on path '${path}'`);
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

await server.listen({ port: 3000, host: "0.0.0.0" });
logger.info(`tRPC server running on http://localhost:3000`);
