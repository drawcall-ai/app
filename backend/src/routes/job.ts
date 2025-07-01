import { z } from "zod";
import { TRPC } from "../index.js";
import { db, Job } from "./db/index.js";

export function buildJobsRouter(trpc: TRPC) {
  return trpc.router({
    getJobs: trpc.procedure.subscription(async ({ input }) => {
      const jobs = await db.job.findMany({
        take: 10,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
          status: true,
          id: true,
          type: true,
        },
      });
      return buildListOberservable<Job, (typeof jobs)[number]>(
        "job",
        jobs,
        (entry) => filterObjectKeys(entry, ["status"]),
        (update) =>
          update.type === "update" && update.entity.status != "loading"
      );
    }),

    cancelJob: trpc.procedure
      .input(object({}))
      .mutation(async ({ input }) => {
        const { jobId, status, error, output } = input;

        // Build update data
        const updateData: JobUpdateInput = { status };
        if (error) {
          updateData.error = error;
        }
        if (output) {
          updateData.output = output;
        }

        onUpdate("job", { ...updateData, id: jobId });
        await db.job.update({
          where: { id: jobId },
          data: updateData,
        });
      }),
  });
}
