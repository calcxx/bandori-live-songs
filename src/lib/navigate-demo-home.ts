import { clearStoredSuccessfulUserId } from "@/lib/eventernote/user-id";

export function navigateToDemoHome() {
  clearStoredSuccessfulUserId();
  // A full reload resets home-page state even when the current route is already "/".
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/");
}
