import type { SongCategory } from "@/lib/music/song-category";

export type LiveSetlistCandidate = {
  eventernoteEventId: number;
  title: string;
  eventDate: string;
  venue: string | null;
};

export type LiveSetlistEntry = {
  position: number;
  title: string;
  songId: number | null;
  category: SongCategory | null;
  bandSlug: string | null;
  firstReleaseDate: string | null;
  isFirstPerformance: boolean;
};

export type LiveSetlistBand = {
  slug: string;
  name: string;
};

export type RecentLiveSetlist = LiveSetlistCandidate & {
  performingBands: LiveSetlistBand[];
};

export type LiveSetlistSeriesEvent = LiveSetlistCandidate & {
  label: string;
};

export type LiveSetlistSeries = {
  title: string;
  events: LiveSetlistSeriesEvent[];
};

export type LiveSetlist = LiveSetlistCandidate & {
  performingBands: LiveSetlistBand[];
  entries: LiveSetlistEntry[];
  series?: LiveSetlistSeries | null;
};

export type LiveSetlistCandidatesResponse = {
  candidates: LiveSetlistCandidate[];
};

export type RecentLiveSetlistsResponse = {
  events: RecentLiveSetlist[];
};

export type LiveSetlistResponse = {
  live: LiveSetlist;
};
