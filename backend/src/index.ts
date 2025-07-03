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

const abortController = new AbortController();
const cleanup = () => abortController.abort();
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

const createContext = async ({ req, res }: CreateFastifyContextOptions) => {
  return { req, res };
};

// Initialize tRPC
const trpc = initTRPC
  .context<Awaited<ReturnType<typeof createContext>>>()
  .create({ });
export type TRPC = typeof trpc;

// Create the main app router
export const appRouter = trpc.router({
  uikit: buildUikitRouter(trpc, abortController.signal),
  jobs: buildJobsRouter(trpc, abortController.signal),
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

await server.register(cors);
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
server.log.info(`tRPC server running on http://localhost:8080`);
