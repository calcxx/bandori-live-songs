export class FetchTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  const { timeoutMs = 8000, signal: upstreamSignal, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new FetchTimeoutError(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  function abortFromUpstream() {
    controller.abort(upstreamSignal?.reason);
  }

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...rest,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && (controller.signal.reason instanceof FetchTimeoutError || error instanceof DOMException)) {
      throw controller.signal.reason instanceof FetchTimeoutError
        ? controller.signal.reason
        : new FetchTimeoutError(`Request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    if (upstreamSignal) {
      upstreamSignal.removeEventListener("abort", abortFromUpstream);
    }
  }
}
