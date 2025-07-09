import { TRPC } from "../index.js";
import { db } from "../db/index.js";
import { deleteUikitJob, subscribeUikitJobStatus } from "./uikit.js";
import { int, object, string } from "zod/v4";
import { createProtectedProcedure } from "../lib/protected-procedure.js";

export function buildJobsRouter(trpc: TRPC, abortSignal: AbortSignal) {
  const protectedProcedure = createProtectedProcedure(trpc);

  return trpc.router({
    all: protectedProcedure
      .input(
        object({
          page: int().min(1).default(1),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        const page = input?.page ?? 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const total = await db.job.count();

        // Get paginated jobs
        const jobs = await db.job.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          where: { userId: ctx.user.id },
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
    delete: protectedProcedure
      .input(object({ id: string() }))
      .mutation(async ({ input, ctx }) => {
        const job = await db.job.findFirstOrThrow({
          where: { id: input.id, userId: ctx.user.id },
        });
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
    status: protectedProcedure
      .input(object({ id: string() }))
      .subscription(async function* ({ input, ctx }) {
        const job = await db.job.findFirstOrThrow({
          where: { id: input.id, userId: ctx.user.id },
          select: { uikitJobId: true },
        });
        if (job.uikitJobId != null) {
          yield* subscribeUikitJobStatus(input.id, ctx.res, abortSignal);
          return;
        }
        throw new Error(`unknown job type`);
      }),
  });
}
