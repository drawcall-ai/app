import { TRPCError } from "@trpc/server";
import { TRPC } from "../index.js";

export function createProtectedProcedure(trpc: TRPC) {
  return trpc.procedure.use(async ({ ctx, next }) => {
    if (!ctx.user || !ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        session: ctx.session,
      },
    });
  });
}
