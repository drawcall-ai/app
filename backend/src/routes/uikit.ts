import { z } from "zod";
import type { TRPC } from "./index.js";
import { db } from "./db/index.js";
import { onInsert } from "./update.js";
import { observable, Observer } from "@trpc/server/observable";
import { logger } from "logging";

export function buildUikitRouter(trpc: TRPC, client: DrawcallAIClient) {
  return trpc.router({
    createUikitJob: trpc.procedure
      .input(
        z.object({
          prompt: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const jobId = await createUikitJob(client, input);
          const job = await db.job.create({
            data: {
              id: jobId,
              input,
              type: "uikit",
              status: "loading",
            },
          });
          onInsert("job", job);
          return jobId;
        } catch (error) {
          logger.error(error, "Error creating uikit job");
          throw new Error("Failed to create uikit job");
        }
      }),
    cancelUikitJob: trpc.procedure
      .input(z.object({ jobId: z.string() }))
      .mutation(async ({ input: { jobId } }) => {
        await cancelUikitJob(client, jobId);
      }),
    streamUikitJob: trpc.procedure
      .input(z.object({ jobId: z.string() }))
      .subscription(async ({ input: { jobId } }) => {
        return observable<string, string>((emit) => {
          const abortController = new AbortController();
          const stream = streamUikitJob(client, jobId, {
            signal: abortController.signal,
          });
          emitStream(emit, stream).catch((error) => {
            emit.error("error while streaming output");
            logger.error(error, "error while streaming output");
          });
          return () => abortController.abort();
        });
      }),
  });
}

async function emitStream(
  emit: Observer<string, any>,
  stream: AsyncIterable<string>
) {
  for await (const chunk of stream) {
    emit.next(chunk);
  }
  emit.complete();
}
