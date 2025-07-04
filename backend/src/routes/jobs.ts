import { TRPC } from "../index.js";
import { db } from "../db/index.js";
import { deleteUikitJob, subscribeUikitJobStatus } from "./uikit.js";
import { int, object } from "zod/v4";

export function buildJobsRouter(trpc: TRPC, abortSignal: AbortSignal) {
  return trpc.router({
    all: trpc.procedure
      .input(
        object({
          page: int().min(1).default(1),
        }).optional()
      )
      .query(async ({ input }) => {
        const page = input?.page ?? 1;
        const limit = 10
        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const total = await db.job.count();

        // Get paginated jobs
        const jobs = await db.job.findMany({
          skip,
          take: limit,
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

        const totalPages = Math.ceil(total / limit);

        return {
          jobs,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };
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
