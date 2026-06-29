export type BdrsongsWaitableResult = {
  state: string;
};

type WaitForBdrsongsResultOptions = {
  timeoutMs: number;
  intervalMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForBdrsongsResult<T extends BdrsongsWaitableResult>(
  load: () => Promise<T>,
  {
    timeoutMs,
    intervalMs,
    sleep = defaultSleep,
    now = Date.now,
  }: WaitForBdrsongsResultOptions,
) {
  const deadline = now() + timeoutMs;

  while (true) {
    const result = await load();
    if (result.state !== "warming" || now() >= deadline) {
      return result;
    }

    await sleep(intervalMs);
  }
}
