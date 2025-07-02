export type DurableStream = {
  messages: Array<string>;
  messagesFinalLength?: number;
  notifyChangeSet: Set<() => void>;
  abortController: AbortController;
  signal: AbortSignal;
};

export function createStream(
  abortController: AbortController,
  abortSignal: AbortSignal
): DurableStream {
  return {
    signal: AbortSignal.any([abortController.signal, abortSignal]),
    abortController,
    messages: [],
    notifyChangeSet: new Set(),
  };
}

export function cancelStream(stream: DurableStream) {
  stream.abortController.abort();
}

const decoder = new TextDecoder();

export async function forwardStreamFromReader(
  reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>,
  target: DurableStream
) {
  let output = "";
  while (!target.signal.aborted) {
    const { done, value } = await reader.read();
    if (value) {
      const msg = decoder.decode(value);
      output += msg;
      target.messages.push(msg);
      for (const notify of target.notifyChangeSet) {
        notify();
      }
      target.notifyChangeSet.clear();
    }
    if (done) {
      break;
    }
  }
  if (!target.signal.aborted) {
    target.messagesFinalLength = target.messages.length;
  }
  for (const notify of target.notifyChangeSet) {
    notify();
  }
  if (target.signal.aborted) {
    const error = new Error("operation was aborted");
    error.name = "AbortError";
    throw error;
  }
  return output;
}

export async function* streamToAsyncIterable(
  stream: DurableStream,
  abortSignal: AbortSignal
) {
  let i = 0;
  while (true) {
    for (; i < stream.messages.length; i++) {
      yield stream.messages[i];
    }
    if (
      i === stream.messagesFinalLength ||
      stream.signal.aborted ||
      abortSignal.aborted
    ) {
      break;
    }
    //wait till something changes (stream.messages, stream.done, or abortSignal.aborted)
    await new Promise<void>((resolve) => {
      stream.notifyChangeSet.add(resolve);
      abortSignal.addEventListener("abort", () => resolve());
    });
  }

  if (abortSignal.aborted) {
    const error = new Error("operation was aborted");
    error.name = "AbortError";
    return error;
  }

  if (stream.signal.aborted) {
    throw new Error("canceled");
  }
}
