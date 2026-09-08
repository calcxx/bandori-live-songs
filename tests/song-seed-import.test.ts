import { describe, expect, it } from "vitest";
import { planSongSeedImport } from "../scripts/import-song-seed";

describe("planSongSeedImport", () => {
  it("updates originals in place and preserves manual categories", () => {
    const plan = planSongSeedImport(
      [
        {
          bandSlug: "poppin-party",
          title: "Existing Original",
          firstReleaseDate: "2024-01-01",
        },
        {
          bandSlug: "roselia",
          title: "Manual Cover",
          firstReleaseDate: "2024-02-01",
        },
        {
          bandSlug: "project-common",
          title: "Common Song",
          firstReleaseDate: "2024-03-01",
        },
      ],
      [
        {
          id: 10,
          title: "Existing Original",
          category: "original",
        },
        {
          id: 11,
          title: "Manual Cover",
          category: "cover",
        },
      ],
    );

    expect(plan.updates).toEqual([
      {
        id: 10,
        bandSlug: "poppin-party",
        firstReleaseDate: "2024-01-01",
      },
    ]);
    expect(plan.conflicts).toEqual([
      {
        title: "Manual Cover",
        existingCategory: "cover",
      },
    ]);
    expect(plan.inserts).toEqual([
      {
        bandSlug: null,
        category: "project-common",
        title: "Common Song",
        firstReleaseDate: "2024-03-01",
      },
    ]);
  });
});
