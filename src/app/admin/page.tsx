import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminAuthCookieMaxAgeSeconds,
  adminAuthCookieName,
  buildAdminAuthToken,
  isAdminKeyConfigured,
  isValidAdminKey,
  normalizeAdminNextPath,
} from "@/lib/admin/auth";
import { getAdminAuthStatus } from "@/lib/admin/server-auth";
import { AdminLoginForm, type AdminLoginActionState } from "./admin-login-form";

const adminLinks = [
  {
    href: "/admin/recent",
    title: "近期活动列表",
    description: "查看近期 Eventernote 活动与歌单收录状态。",
  },
  {
    href: "/admin/list",
    title: "活动列表",
    description: "浏览全量活动，按年份与乐队筛选，并进入歌单导入/编辑。",
  },
  {
    href: "/admin/setlist-import",
    title: "歌单导入",
    description: "按 Eventernote 活动导入 setlist。",
  },
  {
    href: "/admin/songs-import",
    title: "歌曲导入",
    description: "导入新原创曲并刷新曲库缓存。",
  },
  {
    href: "/admin/rules",
    title: "活动屏蔽规则",
    description: "编辑无歌曲活动的屏蔽词和 Eventernote event ID。",
  },
];

async function submitAdminLogin(
  _: AdminLoginActionState,
  formData: FormData,
): Promise<AdminLoginActionState> {
  "use server";

  const adminKey = String(formData.get("adminKey") ?? "");
  const nextPath = normalizeAdminNextPath(String(formData.get("next") ?? ""));

  if (!isAdminKeyConfigured()) {
    return {
      status: "error",
      message: "服务端未配置 SETLIST_IMPORT_KEY，暂不可访问管理页面。",
    };
  }

  if (!isValidAdminKey(adminKey)) {
    return {
      status: "error",
      message: "管理 key 不正确。",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(adminAuthCookieName, await buildAdminAuthToken(), {
    httpOnly: true,
    maxAge: adminAuthCookieMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(nextPath);
}

type AdminPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { next = "" } = await searchParams;
  const nextPath = normalizeAdminNextPath(next);
  const authStatus = await getAdminAuthStatus();

  if (!authStatus.authenticated) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-8 sm:px-6">
        <section className="w-full rounded-2xl border border-border-soft bg-panel p-6">
          <AdminLoginForm action={submitAdminLogin} nextPath={nextPath} />
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <section className="mb-6 space-y-2">
        <p className="text-sm text-ink-soft">Admin</p>
        <h1 className="text-3xl font-semibold text-foreground">管理页面</h1>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {adminLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-border-soft bg-panel px-5 py-4 transition hover:border-accent"
          >
            <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{item.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
