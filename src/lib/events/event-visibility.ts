import { z } from "zod";
import { normalizeNFKC } from "@/lib/music/title-utils";

export const eventVisibilityRulesSchema = z.object({
  version: z.literal(1),
  hiddenTitleKeywords: z.array(z.string()),
  hiddenEventernoteEventIds: z.array(z.number().int().positive()),
});

export type EventVisibilityRules = z.infer<typeof eventVisibilityRulesSchema>;

export const emptyEventVisibilityRules: EventVisibilityRules = {
  version: 1,
  hiddenTitleKeywords: [],
  hiddenEventernoteEventIds: [],
};

type EventVisibilityCandidate = {
  eventernoteEventId: number;
  title: string;
};

function normalizeEventMatchValue(value: string) {
  return normalizeNFKC(value).toLowerCase().replace(/\s+/g, " ").trim();
}

export function shouldHideEventByRulesWithRules(event: EventVisibilityCandidate, rules: EventVisibilityRules) {
  const hiddenEventernoteEventIds = new Set(rules.hiddenEventernoteEventIds);
  const normalizedHiddenKeywords = rules.hiddenTitleKeywords
    .map(normalizeEventMatchValue)
    .filter((value) => value.length > 0);

  if (hiddenEventernoteEventIds.has(event.eventernoteEventId)) {
    return true;
  }

  const normalizedTitle = normalizeEventMatchValue(event.title);
  return normalizedHiddenKeywords.some((keyword) => normalizedTitle.includes(keyword));
}

export function filterEventsByVisibilityRules<T extends EventVisibilityCandidate>(
  events: T[],
  enabled: boolean,
  rules: EventVisibilityRules = emptyEventVisibilityRules,
) {
  if (!enabled) {
    return events;
  }

  return events.filter((event) => !shouldHideEventByRulesWithRules(event, rules));
}
