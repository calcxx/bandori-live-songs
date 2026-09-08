import type { CopyDefinition } from "./types";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const enCopy = {
  metadataTitle: "Bandori Live Song Stats",
  metadataDescription:
    "Enter an Eventernote ID to see which Bandori songs you have heard live.",
  navTitleMobile: "Bandori Live Stats",
  navTitleDesktop: "BanG Dream! Live Song Stats",
  languageToggleAria: "Change display language",
  themeToggleAria: "Change theme",
  githubRepoAria: "GitHub repository",
  themeLight: "Light",
  themeSystem: "System",
  themeDark: "Dark",
  searchModeAria: "Change search type",
  searchModeUser: "User",
  searchModeLive: "Events",
  searchSectionTitle: "Eventernote ID",
  searchInputLabel: "Eventernote username",
  searchPlaceholder: "Enter an Eventernote username",
  searchClearAria: "Clear username",
  invalidUserIdHint:
    "Usernames may contain only letters, numbers, and underscores.",
  searchSubmit: "View stats",
  liveSearchSectionTitle: "Event Setlists",
  liveSearchInputLabel: "Event title or date",
  liveSearchPlaceholder: "Enter an event title or date",
  liveSearchClearAria: "Clear search",
  liveSearchSubmit: "Search",
  liveSearchCandidatesAria: "Event search suggestions",
  liveSearchLoading: "Searching events…",
  liveSearchEmpty: "No events with a recorded setlist were found.",
  liveSearchError: "Event search failed. Please try again later.",
  liveSetlistLoading: "Loading setlist…",
  onThisDaySetlistsTitle: "On This Day",
  recentSetlistsTitle: "Recent Events",
  liveSeriesAria: "Events in this series",
  coverSongBadge: "Cover",
  resultSectionLabel: "Results",
  warmingTitle: "Loading",
  warmingDescription: "Loading stats for the sample user. Please wait.",
  restoringUserDescription:
    "Restoring your previous search. Please wait.",
  warmingAutoRefresh:
    "This page will refresh automatically. Results usually appear within a few seconds.",
  warmingCacheInit:
    "Fetching this user's Eventernote data for the first time. Please wait.",
  warmingCacheRefresh: "Refreshing Eventernote data. Please wait.",
  notFoundTitle: "Eventernote user not found",
  notFoundMessage: (userId: string) =>
    `The user ID “${userId}” does not exist or its event history is not accessible.`,
  invalidUserIdTitle: "Invalid username",
  invalidUserIdMessage:
    "Eventernote usernames may contain only letters, numbers, and underscores.",
  configErrorTitle: "Database not configured",
  configErrorMessage:
    "DATABASE_URL / DIRECT_URL is not configured, so Supabase Postgres cannot be reached.",
  upstreamErrorTitle: "Could not fetch Eventernote data",
  upstreamErrorMessage:
    "Eventernote data is temporarily unavailable. Please try again later.",
  hideVirtualBands: "Hide virtual bands",
  hideUnplayedSongs: "Hide songs never performed live",
  hideSonglessActivities: "Hide events without songs",
  catalogSummaryNote: "Stats include each band's original songs only.",
  matchedEventsLabel: "Matched events",
  bandEventShareLabel: "Events attended by band",
  bandEventShareTooltip: (
    bandName: string,
    eventCount: number,
    percentage: string,
  ) =>
    `${bandName}: ${eventCount} ${eventCount === 1 ? "event" : "events"} · ${percentage}`,
  bandProgressTitle: "Song Progress",
  bandProgressHintMobile: "Tap a song to view its performances.",
  bandProgressHintDesktop: "Hover over a song to view its performances.",
  heardProgress: (heardCount: number, totalCount: number) =>
    `Heard ${heardCount} / ${totalCount}`,
  expandSongsAria: "Expand song list",
  collapseSongsAria: "Collapse song list",
  relatedEventsLabel: (count: number) =>
    `Performed at ${count} ${count === 1 ? "event" : "events"}`,
  songEventCountsLabel: (performedCount: number, heardCount: number) =>
    `Performed at ${performedCount} ${performedCount === 1 ? "event" : "events"} · Heard at ${heardCount} ${heardCount === 1 ? "event" : "events"}`,
  releaseDateLabel: (date: string) => {
    const [year, month, day] = date.split("-");
    const monthName = monthNames[Number(month) - 1] ?? month;
    return `Released ${monthName} ${Number(day)}, ${year}`;
  },
  loadingEvents: "Loading performances…",
  noSongEvents: "No performances have been recorded for this song",
  closeSongEventsAria: "Close performance history",
  eventCoverageTitle: "Events and Setlist Coverage",
  eventCoverageNote: "The events this user attended are shown below.",
  eventUnlockSongsLabel: "First heard",
  eventUnlockSongsSuffix: (count: number) =>
    count === 1 ? "song" : "songs",
  eventSetlistLabel: "Songs performed at this event",
  expandEventUnlocksAria: "Expand songs performed at this event",
  collapseEventUnlocksAria: "Collapse songs performed at this event",
  venueMissing: "Venue not recorded",
  matchedBands: "Bands",
  collectedSetlistBadge: "Setlist recorded",
  missingSetlistBadge: "Setlist not recorded",
  saveImageButtonIdle: "Save as image",
  saveImageButtonCapturing: "Creating image...",
  saveImageButtonSuccess: "Saved!",
  manualRefresh: "Refresh",
  adminNav: "Admin",
  songStatsNav: "Song Stats",
  songStatsTitle: "Song Performance Counts",
  songStatsDescription:
    "See how many recorded events featured each band's original songs. Select a song to view its performances.",
  songStatsAllBands: "All bands",
  songStatsSearchInputLabel: "Search songs",
  songStatsSearchPlaceholder: "Search all recorded songs",
  songStatsSearchClearAria: "Clear song search",
  songStatsSearchResultsLabel: "Matches",
  songStatsSearchResultsUnit: (count: number) =>
    count === 1 ? "song" : "songs",
  songStatsSearchEmpty: "No matching songs found",
  songStatsRecordedEventsLabel: "Recorded events",
  songStatsRecordedEventsUnit: (count: number) =>
    count === 1 ? "event" : "events",
  songStatsSongColumn: "Song",
  songStatsCountColumn: "Count",
  songStatsLastPerformanceDateColumn: "Last performed",
  songStatsReleaseDateColumn: "Release date",
  apiDocsFooter: "Open API",
  demoPrefix: "Showing data for a ",
  demoLinkLabel: "sample user",
  demoSuffix: ".",
} as const satisfies CopyDefinition;
