import { clearStoredSuccessfulUserId } from "@/lib/eventernote/user-id";

export function navigateToDemoHome() {
  clearStoredSuccessfulUserId();
  window.location.assign("/");
}
