"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type RefreshWhileWarmingProps = {
  enabled: boolean;
  userId: string;
  intervalMs?: number;
  maxAttempts?: number;
  removeParamNames?: string[];
};

export function RefreshWhileWarming({
  enabled,
  userId,
  intervalMs = 400,
  maxAttempts = 6,
  removeParamNames = [],
}: RefreshWhileWarmingProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  async function waitForDelay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const hasParamsToRemove = removeParamNames.some((name) => searchParams.has(name));

    if (hasParamsToRemove) {
      const nextSearchParams = new URLSearchParams(searchParams.toString());

      for (const name of removeParamNames) {
        nextSearchParams.delete(name);
      }

      const nextQuery = nextSearchParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      return;
    }

    const abortController = new AbortController();

    async function queryRefreshStatus(signal: AbortSignal) {
      const response = await fetch(`/api/user-refresh-status?userId=${encodeURIComponent(userId)}`, {
        method: "GET",
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        return "warming" as const;
      }

      const payload = (await response.json()) as { state?: "warming" | "ready" };
      return payload.state === "ready" ? "ready" : "warming";
    }

    const runLongPolling = async () => {
      let attempts = 0;

      while (!abortController.signal.aborted && attempts < maxAttempts) {
        attempts += 1;

        const refreshStatus = await queryRefreshStatus(abortController.signal).catch(() => "warming" as const);
        if (abortController.signal.aborted) {
          return;
        }

        if (refreshStatus === "ready") {
          router.refresh();
          return;
        }

        if (attempts < maxAttempts) {
          await waitForDelay(intervalMs);
        }
      }

      // 长轮询已完成（已达到最大尝试次数或被中止）
      // 刷新页面，让服务器检查数据是否已准备好
      if (!abortController.signal.aborted) {
        router.refresh();
      }
    };

    void runLongPolling();

    return () => {
      abortController.abort();
    };
  }, [enabled, intervalMs, maxAttempts, pathname, removeParamNames, router, searchParams, userId]);

  return null;
}
