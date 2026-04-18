import { XMLParser } from "fast-xml-parser";

export type MangaFlag = "Unknown" | "No" | "Yes" | "YesAndRightToLeft";

export interface ComicInfoPage {
  Image: number;
  Type?: string;
  DoublePage?: boolean;
  ImageSize?: number;
  ImageWidth?: number;
  ImageHeight?: number;
}

export interface ComicInfo {
  Title?: string;
  Series?: string;
  Number?: string;
  Count?: number;
  Volume?: number;
  AlternateSeries?: string;
  Summary?: string;
  Notes?: string;
  Year?: number;
  Month?: number;
  Day?: number;
  Writer?: string;
  Penciller?: string;
  Inker?: string;
  Colorist?: string;
  Letterer?: string;
  CoverArtist?: string;
  Editor?: string;
  Translator?: string;
  Publisher?: string;
  Imprint?: string;
  Genre?: string;
  Tags?: string;
  Web?: string;
  PageCount?: number;
  LanguageISO?: string;
  Format?: string;
  BlackAndWhite?: "Unknown" | "No" | "Yes";
  Manga?: MangaFlag;
  Characters?: string;
  Teams?: string;
  Locations?: string;
  AgeRating?: string;
  CommunityRating?: number;
  GTIN?: string;
  Pages?: ComicInfoPage[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: true,
  isArray: (name) => name === "Page",
  trimValues: true,
  numberParseOptions: {
    hex: false,
    leadingZeros: false,
  },
});

export function parseComicInfoXml(xml: string): ComicInfo | null {
  try {
    const stripped = xml.replace(/^\uFEFF/, "");
    const parsed = parser.parse(stripped) as {
      ComicInfo?: ComicInfo;
    };
    return parsed.ComicInfo ?? null;
  } catch (err) {
    console.error("[comicinfo] parse failed:", err);
    return null;
  }
}

export function isMangaRTL(info: ComicInfo | null | undefined): boolean {
  return info?.Manga === "YesAndRightToLeft";
}

export function decideCoverPage(
  info: ComicInfo | null | undefined,
  totalPages: number,
): number {
  if (totalPages <= 0) return 1;
  const cover = info?.Pages?.find((p) =>
    typeof p.Type === "string" && p.Type.split(/\s+/).includes("FrontCover"),
  );
  if (cover && Number.isInteger(cover.Image)) {
    const idx = cover.Image;
    if (idx >= 0 && idx < totalPages) return idx;
  }
  return 1;
}