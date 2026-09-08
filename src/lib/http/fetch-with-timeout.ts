export class FetchTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

/** The deadline includes consuming the response body inside readResponse. */
export async function fetchWithTimeout<T>(
  input: string | URL,
  init: RequestInit & { timeoutMs?: number },
  readResponse: (response: Response) => Promise<T>,
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
    const response = await fetch(input, {
      ...rest,
      signal: controller.signal,
    });
    return await readResponse(response);
  } catch (error) {
    if (controller.signal.aborted) {
      throw controller.signal.reason;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    if (upstreamSignal) {
      upstreamSignal.removeEventListener("abort", abortFromUpstream);
    }
  }
}
