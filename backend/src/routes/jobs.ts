import { TRPC } from "../index.js";
import { db } from "../db/index.js";
import { deleteUikitJob, subscribeUikitJobStatus } from "./uikit.js";
import { int, object } from "zod/v4";

export function buildJobsRouter(trpc: TRPC, abortSignal: AbortSignal) {
  return trpc.router({
    all: trpc.procedure.query(async () => {
      return await db.job.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          uikitJob: {
            select: {
              prompt: true,
            },
          },
        },
      });
    }),
    delete: trpc.procedure
      .input(object({ id: int() }))
      .mutation(async ({ input, ctx }) => {
        const job = await db.job.findFirstOrThrow({ where: { id: input.id } });
        if (job.uikitJobId != null) {
          const success = await deleteUikitJob(input.id, ctx.res);
          if (!success) {
            return;
          }
          const { uikitJob } = await db.job.delete({
            where: { id: input.id },
            select: { uikitJob: { select: { prompt: true } } },
          });
          return uikitJob?.prompt;
        }
      }),
    status: trpc.procedure
      .input(object({ id: int() }))
      .subscription(async function* ({ input, ctx }) {
        const job = await db.job.findFirstOrThrow({ where: { id: input.id } });
        if (job.uikitJobId != null) {
          yield* subscribeUikitJobStatus(input.id, ctx.res, abortSignal);
          return;
        }
        throw new Error(`unknown job type`);
      }),
  });
}
