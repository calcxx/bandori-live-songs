import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FetchTimeoutError, fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Model fetch's cancellation contract; the production helper owns the timeout.
function pendingFetch() {
  vi.stubGlobal("fetch", vi.fn((_input: string | URL, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init.signal!;
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  ));
}

describe("fetchWithTimeout", () => {
  it("passes request options through and clears the timeout after success", async () => {
    const response = new Response("ok");
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchWithTimeout("https://example.test", { method: "POST", body: "data", timeoutMs: 100 }, (response) => response.text()))
      .toBe("ok");
    expect(fetchMock).toHaveBeenCalledWith("https://example.test", expect.objectContaining({ method: "POST", body: "data" }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a stalled request at the deadline", async () => {
    pendingFetch();
    const result = fetchWithTimeout("https://example.test", { timeoutMs: 100 }, (response) => response.text());
    const rejection = expect(result).rejects.toBeInstanceOf(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves network errors and clears the timeout", async () => {
    const failure = new TypeError("network failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
    await expect(fetchWithTimeout("https://example.test", {}, (response) => response.text())).rejects.toBe(failure);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([true, false])("honors upstream cancellation (already aborted: %s)", async (alreadyAborted) => {
    pendingFetch();
    const controller = new AbortController();
    const reason = new Error("caller cancelled");
    if (alreadyAborted) controller.abort(reason);
    const result = fetchWithTimeout("https://example.test", { signal: controller.signal }, (response) => response.text());
    const rejection = expect(result).rejects.toBe(reason);
    if (!alreadyAborted) controller.abort(reason);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});


it("keeps the deadline active after headers while the response body is stalled", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_input: string, init: RequestInit) => new Response(
    new ReadableStream({ start(stream) {
      init.signal!.addEventListener("abort", () => stream.error(init.signal!.reason), { once: true });
    } }),
  )));
  const result = fetchWithTimeout("https://example.test", { timeoutMs: 100 }, response => response.text());
  const rejection = expect(result).rejects.toBeInstanceOf(FetchTimeoutError);
  await vi.advanceTimersByTimeAsync(100);
  await rejection;
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves a default AbortError instead of reporting a caller abort as a timeout", async () => {
  pendingFetch();
  const controller = new AbortController();
  const result = fetchWithTimeout("https://example.test", { signal: controller.signal }, response => response.text());
  const rejection = expect(result).rejects.toBeInstanceOf(DOMException);
  controller.abort();
  await rejection;
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
});
