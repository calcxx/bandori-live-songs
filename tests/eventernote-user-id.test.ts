import { describe, expect, it } from "vitest";
import {
  isValidEventernoteUserId,
  normalizeEventernoteUserCacheKey,
  normalizeEventernoteUserId,
} from "@/lib/eventernote/user-id";

describe("eventernote user id", () => {
  it("normalizes input by trimming outer whitespace", () => {
    expect(normalizeEventernoteUserId("  Tetsuya_Ryusei  ")).toBe("Tetsuya_Ryusei");
  });

  it("builds cache keys case-insensitively", () => {
    expect(normalizeEventernoteUserCacheKey("Tetsuya_Ryusei")).toBe("tetsuya_ryusei");
    expect(normalizeEventernoteUserCacheKey("tetsuya_ryusei")).toBe("tetsuya_ryusei");
  });

  it("accepts valid usernames", () => {
    expect(isValidEventernoteUserId("Tetsuya_Ryusei")).toBe(true);
    expect(isValidEventernoteUserId("abc_123")).toBe(true);
    expect(isValidEventernoteUserId("A23456789012345")).toBe(true);
    expect(isValidEventernoteUserId("A234567890123456")).toBe(true);
  });

  it("rejects invalid usernames", () => {
    expect(isValidEventernoteUserId("")).toBe(false);
    expect(isValidEventernoteUserId("has-dash")).toBe(false);
    expect(isValidEventernoteUserId("含中文")).toBe(false);
  });
});
