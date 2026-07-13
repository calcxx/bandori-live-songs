import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/core";
import { eventernoteUserCache } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventernoteUserBaseUrl = "https://www.eventernote.com/users";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

export default async function AdminUserCachePage() {
  const db = getDb();
  const rows = await db
    .select({
      userId: eventernoteUserCache.userId,
      displayId: eventernoteUserCache.displayId,
      displayName: eventernoteUserCache.displayName,
      fetchStatus: eventernoteUserCache.fetchStatus,
      lastFetchedAt: eventernoteUserCache.lastFetchedAt,
      remoteEventCount: eventernoteUserCache.remoteEventCount,
    })
    .from(eventernoteUserCache)
    .orderBy(desc(eventernoteUserCache.lastFetchedAt));

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
              只读查看 eventernote_user_cache。默认按 last_fetched_at 降序。点击用户名打开本站统计，点击昵称打开
              Eventernote 主页。
            </p>
          </div>
          <div className="rounded-[1.1rem] border border-border-soft bg-panel-strong px-4 py-3">
            <p className="text-xs text-ink-soft">行数</p>
            <p className="mt-1 text-sm font-medium">{rows.length}</p>
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
                <th className="px-4 py-3 font-medium">抓取状态</th>
                <th className="px-4 py-3 font-medium">最后抓取时间</th>
                <th className="px-4 py-3 font-medium">远程活动数</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                    暂无缓存行
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const profileId = row.displayId ?? row.userId;
                  return (
                    <tr key={row.userId} className="border-t border-border-soft">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <Link
                          href={`/?userId=${encodeURIComponent(profileId)}`}
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
                      <td className="px-4 py-3 text-ink-soft">{row.fetchStatus}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {formatDateTime(row.lastFetchedAt)}
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
