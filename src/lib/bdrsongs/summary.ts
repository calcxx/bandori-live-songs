import type { AggregatedStats } from "@/lib/stats/aggregate";
import { normalizeEventernoteUserId } from "@/lib/eventernote/user-id";

export type BdrsongsOptions = {
  userId: string;
  hideUnplayed: boolean;
  hideVirtualBands: boolean;
  includeUnplayedSongs: boolean;
  includeVirtualBands: boolean;
};

function isEnabledFlag(value: string | null) {
  if (value === null) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function resolveBdrsongsOptions(searchParams: URLSearchParams): BdrsongsOptions {
  const includeUnplayedSongs = isEnabledFlag(searchParams.get("allSongs"));
  const includeVirtualBands = isEnabledFlag(searchParams.get("allBands"));

  return {
    userId: normalizeEventernoteUserId(searchParams.get("userId") ?? ""),
    hideUnplayed: !includeUnplayedSongs,
    hideVirtualBands: !includeVirtualBands,
    includeUnplayedSongs,
    includeVirtualBands,
  };
}

export function formatBdrsongsSummary({
  userId,
  displayName,
  stats,
  includeVirtualBands,
  includeUnplayedSongs,
}: {
  userId: string;
  displayName: string | null;
  stats: AggregatedStats;
  includeVirtualBands: boolean;
  includeUnplayedSongs: boolean;
}) {
  const lines = [
    `${userId} / ${displayName ?? userId}`,
    `现场已听原创曲：${stats.totalSummary.heardCount}/${stats.totalSummary.totalCount}`,
  ];

  for (const summary of stats.bandSummaries) {
    lines.push(`${summary.nameJa}：${summary.heardCount}/${summary.totalCount}`);
  }

  lines.push(
    `模式：虚拟团 ${includeVirtualBands ? "✅" : "❌"}  未演奏曲 ${
      includeUnplayedSongs ? "✅" : "❌"
    }`,
  );

  return lines.join("\n");
}
