import { normalizeEventernoteUserId } from "@/lib/eventernote/user-id";

export function buildUserHref(userId: string) {
  return `/users/${encodeURIComponent(normalizeEventernoteUserId(userId))}`;
}
