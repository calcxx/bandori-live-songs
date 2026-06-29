import { describe, expect, it } from "vitest";
import { getBandTextColor } from "@/lib/constants/bands";

describe("band text colors", () => {
  it("uses theme-aware text colors only for low-contrast bands", () => {
    expect(getBandTextColor("roselia")).toBe("var(--roselia-highlight)");
    expect(getBandTextColor("ave-mujica")).toBe("var(--ave-mujica-highlight)");
    expect(getBandTextColor("hello-happy-world")).toBe("var(--hello-happy-highlight)");
    expect(getBandTextColor("mygo")).toBe("#3388BB");
  });
});
