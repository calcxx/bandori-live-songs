/** bandori.fans setlist picker labels (演唱). */
export const BANDORI_FANS_BAND_LABELS: Record<string, string> = {
  "poppin-party": "POPPIN\u2019PARTY",
  afterglow: "AFTERGLOW",
  "pastel-palettes": "PASTEL*PALETTES",
  roselia: "ROSELIA",
  "hello-happy-world": "HELLO,HAPPY WORLD!",
  "raise-a-suilen": "RAISE A SUILEN",
  morfonica: "MORFONICA",
  mygo: "MyGO!!!!!",
  "ave-mujica": "AVE MUJICA",
  "mugendai-mewtype": "MUGENDAI MYU-TYPE",
};

export function toBandoriFansBandLabel(bandSlug: string, fallbackName?: string) {
  return BANDORI_FANS_BAND_LABELS[bandSlug] ?? fallbackName ?? null;
}
