import { isValidIsoDate } from "@/lib/calendar-date";
import { setTimeout as sleep } from "node:timers/promises";
import { and, eq } from "drizzle-orm";
import { BAND_SEEDS } from "@/lib/constants/bands";
import { getDb } from "@/lib/db/core";
import { songs } from "@/lib/db/schema";
import {
  canonicalizeSongTitle,
  isExcludedTrackTitle,
  normalizeSongTitle,
} from "@/lib/music/title-utils";

const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const USER_AGENT = "bandori-live-songs/1.0 (https://github.com/calcxx/bandori-live-songs)";
const REQUEST_DELAY_MS = 1100;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 15000;
const LOOKBACK_DAYS = 30;

export type MusicBrainzRecordingHit = {
  recordingId?: string;
  title: string;
  firstReleaseDate?: string;
  video?: boolean;
  disambiguation?: string;
  releaseTitles?: string[];
  coverWorkTitle?: string;
};

export type ExistingSongRef = {
  title: string;
  firstReleaseDate: string;
};

export type SongInsertCandidate = {
  bandSlug: string;
  title: string;
  firstReleaseDate: string;
  rawTitle: string;
};

export type SongDateUpdateCandidate = {
  title: string;
  previousDate: string;
  firstReleaseDate: string;
  rawTitle: string;
  bandSlug: string;
};

export type FilteredRecording =
  | {
      action: "insert";
      bandSlug: string;
      rawTitle: string;
      title: string;
      firstReleaseDate: string;
    }
  | {
      action: "update-date";
      bandSlug: string;
      rawTitle: string;
      title: string;
      previousDate: string;
      firstReleaseDate: string;
    }
  | {
      action: "skip";
      bandSlug: string;
      rawTitle: string;
      reason: "video" | "incomplete-date" | "outside-window" | "excluded" | "existing" | "empty-title";
      detail?: string;
    };

export type RecentSongsSyncResult = {
  sinceDate: string;
  scannedBands: number;
  skippedBandsWithoutMbid: string[];
  candidates: number;
  inserted: number;
  updated: number;
  skippedExisting: number;
  skippedExcluded: number;
  insertedTitles: string[];
  updatedTitles: string[];
  decisions: FilteredRecording[];
  errors: string[];
  dryRun: boolean;
};

/** Calendar YYYY-MM-DD for `now` minus `days` in UTC. */
export function lookbackSinceDate(now: Date = new Date(), days = LOOKBACK_DAYS): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function isReleaseDateInWindow(date: string, sinceDate: string): boolean {
  return date >= sinceDate;
}

function isCoverReleaseTitle(rawTitle: string) {
  const normalized = rawTitle.normalize("NFKC").toLowerCase();
  return normalized.includes("カバー") || normalized.includes("カヴァー") || /\bcovers?\b/i.test(normalized);
}

function coverReleaseTitle(recording: MusicBrainzRecordingHit) {
  return recording.releaseTitles?.find(isCoverReleaseTitle) ?? null;
}

export type MusicBrainzWorkRelation = {
  type?: string;
  attributes?: string[];
  "target-type"?: string;
  work?: { title?: string };
};

/** Pure: MB marks covers on the recording→work performance relation, which search results omit. */
export function coverWorkTitleFromRelations(relations?: MusicBrainzWorkRelation[]): string | null {
  for (const relation of relations ?? []) {
    if (relation["target-type"] !== "work") continue;
    if (!(relation.attributes ?? []).includes("cover")) continue;
    return relation.work?.title || "(untitled work)";
  }
  return null;
}

function coverDetail(recording: MusicBrainzRecordingHit) {
  if (recording.coverWorkTitle) return `cover of work: ${recording.coverWorkTitle}`;
  const coverRelease = coverReleaseTitle(recording);
  if (coverRelease) return `cover release: ${coverRelease}`;
  return recording.firstReleaseDate;
}

function isCoverRecording(recording: MusicBrainzRecordingHit) {
  return (
    isExcludedTrackTitle(recording.title) ||
    recording.coverWorkTitle !== undefined ||
    /\bcovers?\b/i.test(recording.disambiguation ?? "") ||
    /カ(?:バー|ヴァー)/u.test(recording.disambiguation ?? "") ||
    coverReleaseTitle(recording) !== null
  );
}

/** Pure filter: MB hits → insert / earlier-date update / skip decisions. */
export function filterMusicBrainzRecordingsForBand(
  bandSlug: string,
  recordings: MusicBrainzRecordingHit[],
  sinceDate: string,
  existingByNormalized: Map<string, ExistingSongRef>,
): {
  toInsert: SongInsertCandidate[];
  toUpdate: SongDateUpdateCandidate[];
  skippedExcluded: number;
  skippedExisting: number;
  decisions: FilteredRecording[];
} {
  let skippedExcluded = 0;
  let skippedExisting = 0;
  const toInsert: SongInsertCandidate[] = [];
  const toUpdate: SongDateUpdateCandidate[] = [];
  const decisions: FilteredRecording[] = [];
  const batchInsertByNormalized = new Map<string, SongInsertCandidate>();
  const batchUpdateByNormalized = new Map<string, SongDateUpdateCandidate>();

  for (const recording of recordings) {
    if (recording.video) {
      decisions.push({
        action: "skip",
        bandSlug,
        rawTitle: recording.title,
        reason: "video",
      });
      continue;
    }

    if (!isValidIsoDate(recording.firstReleaseDate)) {
      decisions.push({
        action: "skip",
        bandSlug,
        rawTitle: recording.title,
        reason: "incomplete-date",
        detail: recording.firstReleaseDate ?? "(missing)",
      });
      continue;
    }

    if (!isReleaseDateInWindow(recording.firstReleaseDate, sinceDate)) {
      decisions.push({
        action: "skip",
        bandSlug,
        rawTitle: recording.title,
        reason: "outside-window",
        detail: recording.firstReleaseDate,
      });
      continue;
    }

    if (isCoverRecording(recording)) {
      skippedExcluded += 1;
      decisions.push({
        action: "skip",
        bandSlug,
        rawTitle: recording.title,
        reason: "excluded",
        detail: coverDetail(recording),
      });
      continue;
    }

    const title = canonicalizeSongTitle(recording.title);
    if (!title) {
      skippedExcluded += 1;
      decisions.push({
        action: "skip",
        bandSlug,
        rawTitle: recording.title,
        reason: "empty-title",
      });
      continue;
    }

    const normalized = normalizeSongTitle(title);
    const existing = existingByNormalized.get(normalized);
    const pendingInsert = batchInsertByNormalized.get(normalized);

    if (existing) {
      if (recording.firstReleaseDate < existing.firstReleaseDate) {
        const priorBatch = batchUpdateByNormalized.get(normalized);
        const update: SongDateUpdateCandidate = {
          bandSlug,
          title: existing.title,
          previousDate: priorBatch?.previousDate ?? existing.firstReleaseDate,
          firstReleaseDate: recording.firstReleaseDate,
          rawTitle: recording.title,
        };
        batchUpdateByNormalized.set(normalized, update);
        existingByNormalized.set(normalized, {
          title: existing.title,
          firstReleaseDate: recording.firstReleaseDate,
        });
        const index = toUpdate.findIndex((row) => normalizeSongTitle(row.title) === normalized);
        if (index >= 0) toUpdate[index] = update;
        else toUpdate.push(update);
        decisions.push({
          action: "update-date",
          bandSlug,
          rawTitle: recording.title,
          title: existing.title,
          previousDate: update.previousDate,
          firstReleaseDate: recording.firstReleaseDate,
        });
      } else {
        skippedExisting += 1;
        decisions.push({
          action: "skip",
          bandSlug,
          rawTitle: recording.title,
          reason: "existing",
          detail:
            title === recording.title
              ? `${existing.firstReleaseDate}`
              : `→ ${title} @ ${existing.firstReleaseDate}`,
        });
      }
      continue;
    }

    if (pendingInsert) {
      if (recording.firstReleaseDate < pendingInsert.firstReleaseDate) {
        pendingInsert.firstReleaseDate = recording.firstReleaseDate;
        pendingInsert.rawTitle = recording.title;
        decisions.push({
          action: "insert",
          bandSlug,
          rawTitle: recording.title,
          title: pendingInsert.title,
          firstReleaseDate: recording.firstReleaseDate,
        });
      } else {
        skippedExisting += 1;
        decisions.push({
          action: "skip",
          bandSlug,
          rawTitle: recording.title,
          reason: "existing",
          detail: title === recording.title ? undefined : `→ ${title}`,
        });
      }
      continue;
    }

    const insert: SongInsertCandidate = {
      bandSlug,
      title,
      firstReleaseDate: recording.firstReleaseDate,
      rawTitle: recording.title,
    };
    batchInsertByNormalized.set(normalized, insert);
    toInsert.push(insert);
    decisions.push({
      action: "insert",
      bandSlug,
      rawTitle: recording.title,
      title,
      firstReleaseDate: recording.firstReleaseDate,
    });
  }

  return { toInsert, toUpdate, skippedExcluded, skippedExisting, decisions };
}

type MusicBrainzSearchResponse = {
  count?: number;
  recordings?: Array<{
    id?: string;
    title: string;
    "first-release-date"?: string;
    video?: boolean;
    disambiguation?: string;
    releases?: Array<{
      title?: string;
      "release-group"?: {
        title?: string;
      };
    }>;
  }>;
};

type MusicBrainzRecordingDetailResponse = {
  relations?: MusicBrainzWorkRelation[];
};

async function requestMusicBrainzJson<T>(
  url: string,
  signal: AbortSignal | undefined,
  parse: (data: unknown) => T,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    signal?.throwIfAborted();
    try {
      const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        cache: "no-store",
      });
      if (!response.ok) {
        const error = new Error(`MusicBrainz HTTP ${response.status}`);
        if (response.status !== 429 && response.status < 500) throw Object.assign(error, { permanent: true });
        throw error;
      }
      return parse(await response.json());
    } catch (error) {
      signal?.throwIfAborted();
      if (attempt === MAX_RETRIES || (error as { permanent?: boolean })?.permanent) throw error;
      await sleep(RETRY_BASE_DELAY_MS * attempt, undefined, { signal });
    }
  }
  throw new Error("MusicBrainz request failed");
}

export async function searchRecentRecordingsByArtist(
  mbid: string,
  sinceDate: string,
  signal?: AbortSignal,
): Promise<MusicBrainzRecordingHit[]> {
  const query = `arid:${mbid} AND firstreleasedate:[${sinceDate} TO *]`;
  const hits: MusicBrainzRecordingHit[] = [];
  let offset = 0;

  while (true) {
    const url = `${MUSICBRAINZ_API}/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=100&offset=${offset}`;
    const data = await requestMusicBrainzJson<MusicBrainzSearchResponse>(url, signal, (body) => {
      const parsed = body as MusicBrainzSearchResponse;
      if (!Array.isArray(parsed.recordings)) throw new Error("MusicBrainz response missing recordings");
      return parsed;
    });
    const recordings = data.recordings!;
    hits.push(...recordings.map((recording) => ({
      recordingId: recording.id,
      title: recording.title,
      firstReleaseDate: recording["first-release-date"],
      video: recording.video,
      disambiguation: recording.disambiguation,
      releaseTitles: recording.releases?.flatMap((release) =>
        [release.title, release["release-group"]?.title].filter(
          (title): title is string => Boolean(title),
        ),
      ),
    })));
    offset += recordings.length;
    if (data.count !== undefined ? offset >= data.count : recordings.length < 100) return hits;
    if (recordings.length === 0) throw new Error("MusicBrainz pagination ended before reported count");
    await sleep(REQUEST_DELAY_MS, undefined, { signal });
  }
}

async function fetchCoverWorkTitle(recordingId: string, signal?: AbortSignal): Promise<string | null> {
  const url = `${MUSICBRAINZ_API}/recording/${recordingId}?inc=work-rels&fmt=json`;
  const data = await requestMusicBrainzJson<MusicBrainzRecordingDetailResponse>(url, signal, (body) =>
    body as MusicBrainzRecordingDetailResponse,
  );
  return coverWorkTitleFromRelations(data.relations);
}

/**
 * Search results omit work relations, so one lookup per not-yet-catalogued recording catches
 * covers released without "cover" in their title or release names. Catalog titles stay unverified
 * because the filter skips them as existing anyway.
 */
export async function flagCoverWorkRecordings(
  recordings: MusicBrainzRecordingHit[],
  existingByNormalized: Map<string, ExistingSongRef>,
  signal?: AbortSignal,
): Promise<number> {
  const verifiedIds = new Set<string>();
  let checked = 0;

  for (const recording of recordings) {
    const recordingId = recording.recordingId;
    if (!recordingId || verifiedIds.has(recordingId)) continue;
    verifiedIds.add(recordingId);

    const title = canonicalizeSongTitle(recording.title);
    if (!title || existingByNormalized.has(normalizeSongTitle(title))) continue;

    signal?.throwIfAborted();
    await sleep(REQUEST_DELAY_MS, undefined, { signal });
    const coverWorkTitle = await fetchCoverWorkTitle(recordingId, signal);
    checked += 1;
    if (coverWorkTitle) {
      recording.coverWorkTitle = coverWorkTitle;
    }
  }

  return checked;
}

export type SyncRecentMusicBrainzSongsOptions = {
  now?: Date;
  sinceDate?: string;
  /** Bound upstream work so the route can still save results and report failures. */
  fetchBudgetMs?: number;
  dryRun?: boolean;
  onBand?: (message: string) => void;
};

export async function syncRecentMusicBrainzSongs(
  options: SyncRecentMusicBrainzSongsOptions = {},
): Promise<RecentSongsSyncResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;
  const log = options.onBand ?? (() => {});

  const sinceDate = options.sinceDate ?? lookbackSinceDate(now);
  if (!isValidIsoDate(sinceDate)) throw new Error("sinceDate must be a valid YYYY-MM-DD date");
  const signal = AbortSignal.timeout(options.fetchBudgetMs ?? 240_000);
  const bands = BAND_SEEDS.filter((band) => band.groupType === "band");
  const skippedBandsWithoutMbid = bands
    .filter((band) => !band.musicbrainzArtistMbid)
    .map((band) => band.slug);

  const db = getDb();
  const existingRows = await db
    .select({ title: songs.title, firstReleaseDate: songs.firstReleaseDate })
    .from(songs)
    .where(eq(songs.category, "original"));
  const existingByNormalized = new Map<string, ExistingSongRef>();
  for (const row of existingRows) {
    if (!row.firstReleaseDate) {
      continue;
    }
    existingByNormalized.set(normalizeSongTitle(row.title), {
      title: row.title,
      firstReleaseDate: row.firstReleaseDate,
    });
  }

  log(`since=${sinceDate} bands=${bands.length} existingSongs=${existingRows.length} dryRun=${dryRun}`);

  const errors: string[] = [];
  const insertedTitles: string[] = [];
  const updatedTitles: string[] = [];
  const decisions: FilteredRecording[] = [];
  let candidates = 0;
  let skippedExcluded = 0;
  let skippedExisting = 0;
  let scannedBands = 0;
  const pendingInserts: SongInsertCandidate[] = [];
  const pendingUpdates = new Map<string, SongDateUpdateCandidate>();

  for (const band of bands) {
    const mbid = band.musicbrainzArtistMbid;
    if (!mbid) {
      log(`skip band ${band.slug}: no MusicBrainz MBID`);
      continue;
    }

    if (signal.aborted) {
      errors.push(`${band.slug}: sync fetch budget exhausted; band not scanned`);
      continue;
    }
    scannedBands += 1;
    try {
      const recordings = await searchRecentRecordingsByArtist(mbid, sinceDate, signal);
      await flagCoverWorkRecordings(recordings, existingByNormalized, signal);
      const filtered = filterMusicBrainzRecordingsForBand(
        band.slug,
        recordings,
        sinceDate,
        existingByNormalized,
      );

      candidates += recordings.length;
      skippedExcluded += filtered.skippedExcluded;
      skippedExisting += filtered.skippedExisting;
      decisions.push(...filtered.decisions);

      log(
        `${band.slug}: fetched=${recordings.length} insert=${filtered.toInsert.length} update=${filtered.toUpdate.length} existing=${filtered.skippedExisting} excluded=${filtered.skippedExcluded}`,
      );
      for (const decision of filtered.decisions) {
        if (decision.action === "insert") {
          log(
            `  + ${decision.title} (${decision.firstReleaseDate})${decision.rawTitle === decision.title ? "" : ` ← ${decision.rawTitle}`}`,
          );
        } else if (decision.action === "update-date") {
          log(
            `  ~ ${decision.title} ${decision.previousDate} → ${decision.firstReleaseDate}${decision.rawTitle === decision.title ? "" : ` ← ${decision.rawTitle}`}`,
          );
        } else {
          log(
            `  - [${decision.reason}] ${decision.rawTitle}${decision.detail ? ` (${decision.detail})` : ""}`,
          );
        }
      }

      for (const song of filtered.toInsert) {
        existingByNormalized.set(normalizeSongTitle(song.title), {
          title: song.title,
          firstReleaseDate: song.firstReleaseDate,
        });
        pendingInserts.push(song);
      }
      for (const song of filtered.toUpdate) {
        const key = normalizeSongTitle(song.title);
        const prior = pendingUpdates.get(key);
        if (!prior || song.firstReleaseDate < prior.firstReleaseDate) {
          pendingUpdates.set(key, song);
        }
      }
    } catch (error) {
      const message = `${band.slug}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      log(`ERROR ${message}`);
    }

    if (!signal.aborted) await sleep(REQUEST_DELAY_MS);
  }

  let inserted = 0;
  let updated = 0;
  const updateList = [...pendingUpdates.values()];

  if (pendingInserts.length === 0 && updateList.length === 0) {
    log("nothing to insert or update");
  }

  if (pendingInserts.length > 0) {
    if (dryRun) {
      insertedTitles.push(...pendingInserts.map((song) => song.title));
      log(`dryRun: would insert ${pendingInserts.length} song(s)`);
    } else {
      const values = pendingInserts.map(({ bandSlug, title, firstReleaseDate }) => ({
        bandSlug,
        category: "original" as const,
        title,
        firstReleaseDate,
      }));
      try {
        await db.insert(songs).values(values);
        inserted = values.length;
        insertedTitles.push(...values.map((song) => song.title));
      } catch {
        for (const song of values) {
          try {
            await db.insert(songs).values(song);
            inserted += 1;
            insertedTitles.push(song.title);
          } catch (insertError) {
            const cause = insertError as { code?: string; cause?: { code?: string } };
            if ((cause.code ?? cause.cause?.code) === "23505") skippedExisting += 1;
            else errors.push(`insert ${song.title}: ${insertError instanceof Error ? insertError.message : String(insertError)}`);
          }
        }
      }
    }
  }

  if (updateList.length > 0) {
    if (dryRun) {
      updatedTitles.push(...updateList.map((song) => `${song.title}:${song.previousDate}→${song.firstReleaseDate}`));
      log(`dryRun: would update ${updateList.length} release date(s)`);
    } else {
      for (const song of updateList) {
        try {
          await db
            .update(songs)
            .set({
              firstReleaseDate: song.firstReleaseDate,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(songs.title, song.title),
                eq(songs.category, "original"),
              ),
            );
          updated += 1;
          updatedTitles.push(`${song.title}:${song.previousDate}→${song.firstReleaseDate}`);
        } catch (error) {
          errors.push(
            `update ${song.title}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      log(`updated ${updated} release date(s)`);
    }
  }

  return {
    sinceDate,
    scannedBands,
    skippedBandsWithoutMbid,
    candidates,
    inserted,
    updated: dryRun ? 0 : updated,
    skippedExisting,
    skippedExcluded,
    insertedTitles,
    updatedTitles,
    decisions,
    errors,
    dryRun,
  };
}
