import "server-only";

import { cookies } from "next/headers";
import { adminAuthCookieName, isAdminKeyConfigured, verifyAdminAuthToken } from "@/lib/admin/auth";

export type AdminAuthStatus =
  | {
      authenticated: true;
      message?: never;
    }
  | {
      authenticated: false;
      message: string;
    };

export async function getAdminAuthStatus(): Promise<AdminAuthStatus> {
  if (!isAdminKeyConfigured()) {
    return {
      authenticated: false,
      message: "服务端未配置 SETLIST_IMPORT_KEY，暂不可访问管理页面。",
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(adminAuthCookieName)?.value;

  if (!(await verifyAdminAuthToken(token))) {
    return {
      authenticated: false,
      message: "请先在 /admin 输入管理 key。",
    };
  }

  return { authenticated: true };
}
