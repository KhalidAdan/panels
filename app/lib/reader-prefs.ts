import { z } from "zod";

export const FitMode = z.enum(["screen", "width", "height"]);
export type FitMode = z.infer<typeof FitMode>;

export const ContinuousFitMode = z.enum(["width", "original"]);
export type ContinuousFitMode = z.infer<typeof ContinuousFitMode>;

export const ReaderMode = z.enum(["paginated", "continuous"]);
export type ReaderMode = z.infer<typeof ReaderMode>;

export const BackgroundColor = z.enum(["black", "gray", "white"]);
export type BackgroundColor = z.infer<typeof BackgroundColor>;

export const ReaderPrefsSchema = z.object({
  readerMode: ReaderMode.default("paginated"),
  fit: FitMode.default("screen"),
  doublePage: z.boolean().default(false),
  background: BackgroundColor.default("black"),
  rtlOverride: z.enum(["auto", "ltr", "rtl"]).default("auto"),
  continuousFit: ContinuousFitMode.default("width"),
  thumbSidebarOpen: z.boolean().default(false),
});

export type ReaderPrefs = z.infer<typeof ReaderPrefsSchema>;

const COOKIE_NAME = "panels-prefs";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function serializePrefs(prefs: Partial<ReaderPrefs>): string {
  const merged = ReaderPrefsSchema.parse({
    ...ReaderPrefsSchema.parse({}),
    ...prefs,
  });
  const encoded = encodeURIComponent(JSON.stringify(merged));
  return `${COOKIE_NAME}=${encoded}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

export function resolveRTL(prefs: ReaderPrefs, isManga: boolean): boolean {
  switch (prefs.rtlOverride) {
    case "ltr":
      return false;
    case "rtl":
      return true;
    case "auto":
      return isManga;
  }
}