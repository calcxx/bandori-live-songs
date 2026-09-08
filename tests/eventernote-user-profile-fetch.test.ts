import { afterEach, expect, it, vi } from "vitest";
import { EventernoteUserNotFoundError, fetchEventernoteUserProfile } from "@/lib/eventernote/client";

afterEach(() => vi.unstubAllGlobals());

it("reports a temporary profile HTTP failure instead of classifying the user as missing", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
  await expect(fetchEventernoteUserProfile("example")).rejects.toThrow("status 503");
});

it("still recognizes a confirmed 404 profile", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("missing", { status: 404 })));
  await expect(fetchEventernoteUserProfile("example")).rejects.toBeInstanceOf(EventernoteUserNotFoundError);
});
