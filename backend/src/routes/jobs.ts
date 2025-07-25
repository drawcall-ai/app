import { server, TRPC } from "../index.js";
import { db } from "../db/index.js";
import { deleteUikitJob, subscribeUikitJobStatus } from "./uikit.js";
import { int, object, string, enum as enum_ } from "zod/v4";
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
        const total = await db.job.count({
          where: { userId: ctx.user.id },
        });

        // Get paginated jobs
        const jobs = await db.job.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          where: { userId: ctx.user.id, deletedAt: { equals: null } },
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
          const { uikitJob } = await db.job.update({
            where: { id: input.id },
            data: { deletedAt: new Date() },
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
    feedback: protectedProcedure
      .input(object({ id: string() }))
      .query(async ({ ctx, input }) => {
        const job = await db.job.findFirstOrThrow({
          where: { id: input.id, userId: ctx.user.id },
          select: {
            feedbackType: true,
            feedbackText: true,
          },
        });
        return {
          type: job.feedbackType,
          text: job.feedbackText,
        };
      }),
    setFeedback: protectedProcedure
      .input(
        object({
          id: string(),
          type: enum_(["Positive", "Negative"]),
          text: string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.job.update({
          where: { id: input.id, userId: ctx.user.id },
          data: { feedbackText: input.text, feedbackType: input.type },
        });
      }),
  });
}
