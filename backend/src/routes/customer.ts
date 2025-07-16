import { TRPC } from "../index.js";
import { createProtectedProcedure } from "../lib/protected-procedure.js";
import { getJobRequestQuota, hasPolarAppBenefit } from "../utils.js";

export function buildCustomerRouter(trpc: TRPC, abortSignal: AbortSignal) {
  const protectedProcedure = createProtectedProcedure(trpc);

  return trpc.router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const hasAppBenefit = await hasPolarAppBenefit(
        ctx.user.id,
        ctx.user.isAnonymous!
      );
      return {
        hasAppBenefit,
        requestQuota: (await getJobRequestQuota(ctx.user.id, hasAppBenefit))
          .remaining,
      };
    }),
  });
}
