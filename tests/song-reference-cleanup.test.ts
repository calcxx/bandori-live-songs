import { describe, expect, it } from "vitest";
import { buildSongReferenceCleanupPlan } from "../scripts/cleanup-song-references";

describe("buildSongReferenceCleanupPlan", () => {
  it("links uniquely matched entries, canonicalizes titles, and removes unreferenced covers", () => {
    const plan = buildSongReferenceCleanupPlan(
      [
        { id: 1, title: "EXPOSE ‘Burn out!!!’", category: "original" },
        { id: 2, title: "未使用の翻唱", category: "cover" },
      ],
      [
        { id: 10, eventernoteEventId: 100, rawTitle: "EXPOSE 'Burn out!!!'", songId: null },
        { id: 11, eventernoteEventId: 101, rawTitle: "EXPOSE ‘Burn out!!!’", songId: 1 },
      ],
    );

    expect(plan.entryUpdates).toEqual([
      { entryId: 10, songId: 1, rawTitle: "EXPOSE ‘Burn out!!!’" },
    ]);
    expect(plan.unreferencedCoverIds).toEqual([2]);
    expect(plan.unresolvedEntries).toEqual([]);
  });

  it("does not delete a cover referenced by a setlist", () => {
    const plan = buildSongReferenceCleanupPlan(
      [{ id: 1, title: "有现场记录的翻唱", category: "cover" }],
      [{ id: 10, eventernoteEventId: 100, rawTitle: "有现场记录的翻唱", songId: 1 }],
    );

    expect(plan.unreferencedCoverIds).toEqual([]);
  });

  it("stops unresolved or ambiguous entries from being changed", () => {
    const plan = buildSongReferenceCleanupPlan(
      [
        { id: 1, title: "唯一歌曲", category: "original" },
        { id: 2, title: "另一个歌曲", category: "original" },
      ],
      [{ id: 10, eventernoteEventId: 100, rawTitle: "未收录歌曲", songId: null }],
    );

    expect(plan.entryUpdates).toEqual([]);
    expect(plan.unresolvedEntries).toHaveLength(1);
  });
});
