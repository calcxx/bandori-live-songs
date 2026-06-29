import { describe, expect, it } from "vitest";
import { waitForBdrsongsResult } from "@/lib/bdrsongs/wait";

describe("waitForBdrsongsResult", () => {
  it("keeps polling warming results until a final result is available", async () => {
    const calls: string[] = [];
    let loadCount = 0;
    const result = await waitForBdrsongsResult(
      async () => {
        calls.push("load");
        loadCount += 1;
        return loadCount < 3 ? { state: "warming" as const } : { state: "ok" as const, text: "done" };
      },
      {
        timeoutMs: 1000,
        intervalMs: 10,
        sleep: async () => {
          calls.push("sleep");
        },
        now: () => calls.length * 10,
      },
    );

    expect(result).toEqual({ state: "ok", text: "done" });
    expect(calls).toEqual(["load", "sleep", "load", "sleep", "load"]);
  });

  it("returns the last warming result after timeout", async () => {
    let now = 0;
    const result = await waitForBdrsongsResult(
      async () => ({ state: "warming" as const, message: "refreshing" }),
      {
        timeoutMs: 20,
        intervalMs: 10,
        sleep: async () => {
          now += 10;
        },
        now: () => now,
      },
    );

    expect(result).toEqual({ state: "warming", message: "refreshing" });
  });
});
