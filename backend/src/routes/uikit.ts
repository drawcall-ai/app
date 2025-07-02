import { z } from "zod/v4";
import { server, type TRPC } from "../index.js";
import { db } from "../db/index.js";
import {
  cancelStream,
  createStream,
  DurableStream,
  forwardStreamFromReader,
  streamToAsyncIterable,
} from "../stream.js";
import { rerouteToMachine } from "../fly.js";
import { FastifyReply } from "fastify";

const jobStreamMap = new Map<number, DurableStream>();

export async function* subscribeUikitJobStatus(
  jobId: number,
  reply: FastifyReply,
  abortSignal: AbortSignal
) {
  const jobStream = jobStreamMap.get(jobId);
  if (jobStream != null) {
    while (!abortSignal.aborted) {
      if (jobStream.abortController.signal.aborted) {
        yield "canceled";
        return;
      }
      if (jobStream.messagesFinalLength != null) {
        yield "finished";
        return;
      }
      yield "running";
      await new Promise<void>((resolve) => {
        jobStream.notifyChangeSet.add(resolve);
        abortSignal.addEventListener("abort", () => resolve());
      });
    }
    const error = new Error(`operation was aborted`);
    error.name = "AbortError";
    throw error;
  }
  const { canceled, error, machineId, output } =
    await db.uikitJob.findFirstOrThrow({
      where: { Job: { is: { id: { equals: jobId } } } },
      select: {
        machineId: true,
        canceled: true,
        output: true,
        error: true,
      },
    });
  if (canceled) {
    yield "canceled";
    return;
  }
  if (error != null) {
    yield "error";
    return;
  }
  if (output != null) {
    yield "finished";
    return;
  }
  rerouteToMachine(reply, machineId!);
}

export async function deleteUikitJob(
  jobId: number,
  reply: FastifyReply
): Promise<boolean> {
  const jobStream = jobStreamMap.get(jobId);
  if (jobStream != null) {
    cancelStream(jobStream);
    return true;
  }
  const { canceled, error, machineId, output } =
    await db.uikitJob.findFirstOrThrow({
      where: { Job: { is: { id: { equals: jobId } } } },
      select: {
        machineId: true,
        canceled: true,
        output: true,
        error: true,
      },
    });
  if (canceled != null || error != null || output != null) {
    return true;
  }
  if (machineId == process.env.FLY_MACHINE_ID) {
    throw new Error(`unknown job "${jobId}"`);
  }
  rerouteToMachine(reply, machineId!);
  return false;
}

export function buildUikitRouter(trpc: TRPC, abortSignal: AbortSignal) {
  return trpc.router({
    output: trpc.procedure
      .input(z.object({ id: z.int() }))
      .subscription(async function* ({ input, ctx }) {
        const jobStream = jobStreamMap.get(input.id);
        if (jobStream != null) {
          yield* streamToAsyncIterable(jobStream, abortSignal);
          return;
        }
        const { canceled, error, machineId, output } =
          await db.uikitJob.findFirstOrThrow({
            where: { Job: { is: { id: { equals: input.id } } } },
            select: {
              machineId: true,
              canceled: true,
              output: true,
              error: true,
            },
          });
        if (error != null) {
          throw new Error(error);
        }
        if (canceled) {
          throw new Error("canceled");
        }
        if (output != null) {
          yield* [output];
          return;
        }
        if (machineId == process.env.FLY_MACHINE_ID) {
          throw new Error(`unknown job "${input.id}"`);
        }
        rerouteToMachine(ctx.res, machineId!);
      }),
    create: trpc.procedure
      .input(
        z.object({
          prompt: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const job = await db.job.create({
          data: {
            uikitJob: {
              create: {
                machineId: process.env.FLY_MACHINE_ID,
                prompt: input.prompt,
              },
            },
          },
          include: {
            uikitJob: { select: { prompt: true, id: true } },
          },
        });
        requestUikit(job.id, job.uikitJob!.id, input.prompt, abortSignal);
        return job;
      }),
  });
}

async function requestUikit(
  jobId: number,
  uikitJobId: number,
  prompt: string,
  abortSignal: AbortSignal
) {
  const abortController = new AbortController();
  const stream = createStream(abortController, abortSignal);
  jobStreamMap.set(jobId, stream);
  try {
    // Make request to the drawcall.ai API
    const response = await fetch(
      `https://api.beta.drawcall.ai/uikit/v1?prompt=${encodeURIComponent(
        prompt
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.any([abortController.signal, abortSignal]),
      }
    );

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }
    if (response.body == null) {
      throw new Error("No response body reader available");
    }

    const reader = response.body.getReader();

    const output = await forwardStreamFromReader(reader, stream);
    await db.uikitJob.update({
      where: { id: uikitJobId },
      data: { output },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      await db.uikitJob.update({
        where: { id: uikitJobId },
        data: { canceled: true },
      });
      return;
    }
    server.log.error(error, "error while requesting uikit");
    await db.uikitJob.update({
      where: { id: uikitJobId },
      data: {
        error:
          error != null &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : JSON.stringify(error),
      },
    });
  } finally {
    jobStreamMap.delete(jobId);
  }
}
