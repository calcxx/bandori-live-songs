"use client";

import { FilterIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buildUserHref } from "@/lib/public-url";

const eventernoteUserBaseUrl = "https://www.eventernote.com/users";

export type AdminUserCacheRow = {
  userId: string;
  displayId: string | null;
  displayName: string | null;
  fetchStatus: "ok" | "error";
  lastFetchedAt: string;
  remoteEventCount: number | null;
};

export function AdminUserCacheClient({
  rows,
}: {
  rows: AdminUserCacheRow[];
}) {
  const [excludeErrors, setExcludeErrors] = useState(true);
  const visibleRows = excludeErrors
    ? rows.filter((row) => row.fetchStatus !== "error")
    : rows;
  const filterLabel = excludeErrors
    ? "显示 error 项"
    : "筛除 error 项";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <section className="rounded-[1.75rem] border border-border-soft bg-panel px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-ink-soft">Cache</p>
            <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em]">
              Eventernote 用户缓存
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-ink-soft">
              只读查看 eventernote_user_cache。默认按 last_fetched_at
              降序。点击用户名打开本站统计，点击昵称打开 Eventernote 主页。
            </p>
          </div>
          <div className="rounded-[1.1rem] border border-border-soft bg-panel-strong px-4 py-3">
            <p className="text-xs text-ink-soft">行数</p>
            <p className="mt-1 text-sm font-medium">
              {visibleRows.length}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-border-soft bg-panel">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-panel-strong text-xs text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">用户名</th>
                <th className="px-4 py-3 font-medium">昵称</th>
                <th className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <span>抓取状态</span>
                    <button
                      type="button"
                      aria-label={filterLabel}
                      title={filterLabel}
                      aria-pressed={excludeErrors}
                      onClick={() =>
                        setExcludeErrors((current) => !current)
                      }
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition ${
                        excludeErrors
                          ? "bg-foreground text-background"
                          : "text-ink-soft hover:bg-panel hover:text-foreground"
                      }`}
                    >
                      <FilterIcon
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </button>
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">最后抓取时间</th>
                <th className="px-4 py-3 font-medium">远程活动数</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-ink-soft"
                  >
                    {rows.length === 0
                      ? "暂无缓存行"
                      : "没有符合筛选条件的缓存行"}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const profileId = row.displayId ?? row.userId;
                  return (
                    <tr
                      key={row.userId}
                      className="border-t border-border-soft"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        <Link
                          href={buildUserHref(profileId)}
                          target="_blank"
                          rel="noreferrer"
                          className="transition hover:text-accent"
                        >
                          {row.displayId ?? row.userId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {row.displayName ? (
                          <a
                            href={`${eventernoteUserBaseUrl}/${encodeURIComponent(profileId)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="transition hover:text-accent"
                          >
                            {row.displayName}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {row.fetchStatus}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {row.lastFetchedAt}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {row.remoteEventCount ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
