import { TRPC } from "../index.js";
import { createProtectedProcedure } from "../lib/protected-procedure.js";
import { getJobRequestQuota } from "../utils.js";

export function buildCustomerRouter(trpc: TRPC, abortSignal: AbortSignal) {
  const protectedProcedure = createProtectedProcedure(trpc);

  return trpc.router({
    quota: protectedProcedure.query(async ({ ctx }) => {
      return {
        jobRequestQuota: await getJobRequestQuota(
          ctx.user.id,
          ctx.user.isAnonymous!
        ),
      };
    }),
  });
}
