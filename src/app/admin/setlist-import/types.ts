export type MismatchLine = {
  lineNumber: number;
  value: string;
  suggestedValue?: string;
  suggestionScore?: number;
};

export type SetlistImportActionState = {
  status: "idle" | "error" | "mismatch" | "success";
  message?: string;
  eventernoteEventId?: number;
  eventTitle?: string;
  eventDate?: string;
  venue?: string | null;
  mismatchLines?: MismatchLine[];
  submittedCount?: number;
  existingRecord?: boolean;
};

export function formatSetlistEntriesText(titles: string[]) {
  return titles.join("\n");
}
