import { describe, expect, it } from "vitest";
import {
  buildAdminAuthToken,
  isValidAdminKey,
  normalizeAdminNextPath,
  verifyAdminAuthToken,
} from "@/lib/admin/auth";

describe("admin auth", () => {
  it("validates submitted admin keys after trimming whitespace", () => {
    expect(isValidAdminKey("  secret-key  ", "secret-key")).toBe(true);
    expect(isValidAdminKey("wrong", "secret-key")).toBe(false);
    expect(isValidAdminKey("secret-key", "")).toBe(false);
  });

  it("builds signed cookie tokens that cannot be reused with a different secret", async () => {
    const token = await buildAdminAuthToken("secret-key");

    await expect(verifyAdminAuthToken(token, "secret-key")).resolves.toBe(true);
    await expect(verifyAdminAuthToken(token, "other-secret")).resolves.toBe(false);
    await expect(verifyAdminAuthToken("not-a-token", "secret-key")).resolves.toBe(false);
  });

  it("only allows same-site admin paths as post-login targets", () => {
    expect(normalizeAdminNextPath("/admin/setlist-import?event=123")).toBe("/admin/setlist-import?event=123");
    expect(normalizeAdminNextPath("/")).toBe("/admin");
    expect(normalizeAdminNextPath("https://example.com/admin")).toBe("/admin");
    expect(normalizeAdminNextPath("/admin")).toBe("/admin");
  });
});
