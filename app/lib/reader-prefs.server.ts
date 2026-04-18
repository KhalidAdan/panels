import { z } from "zod";

export const FitMode = z.enum(["screen", "width", "height"]);
export type FitMode = z.infer<typeof FitMode>;

export const BackgroundColor = z.enum(["black", "gray", "white"]);
export type BackgroundColor = z.infer<typeof BackgroundColor>;

export const ReaderPrefsSchema = z.object({
  fit: FitMode.default("screen"),
  doublePage: z.boolean().default(false),
  background: BackgroundColor.default("black"),
  rtlOverride: z.enum(["auto", "ltr", "rtl"]).default("auto"),
});

export type ReaderPrefs = z.infer<typeof ReaderPrefsSchema>;

const COOKIE_NAME = "panels-prefs";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function readPrefs(request: Request): ReaderPrefs {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = parseCookie(cookieHeader)[COOKIE_NAME];
  if (!cookie) return ReaderPrefsSchema.parse({});

  try {
    const decoded = decodeURIComponent(cookie);
    const parsed = JSON.parse(decoded);
    return ReaderPrefsSchema.parse(parsed);
  } catch {
    return ReaderPrefsSchema.parse({});
  }
}

export function serializePrefs(prefs: Partial<ReaderPrefs>): string {
  const merged = ReaderPrefsSchema.parse({
    ...ReaderPrefsSchema.parse({}),
    ...prefs,
  });
  const encoded = encodeURIComponent(JSON.stringify(merged));
  return `${COOKIE_NAME}=${encoded}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = rest.join("=");
  }
  return out;
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