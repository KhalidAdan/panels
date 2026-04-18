export interface ParsedFilename {
  series: string;
  issue?: string;
  volume?: number;
  year?: number;
  ofCount?: number;
  title?: string;
}

const EXT = /\.(cbz|cbr|cb7|cbt|zip|pdf)$/i;
const YEAR = /\((\d{4})\)/;
const OF_N = /\(of\s*(\d{1,3})\)/i;
const VOL = /(?:^|\s)(?:v|vol\.?|volume)\s*(\d{1,4})\b/i;
const ISSUE = /(?:\s|^)(?:#|no\.?\s*)?(\d{1,4}(?:\.\d+)?)(?:\s|$)/;
const TRASH = /[(\[{][^()\[\]{}]*[)\]}]/g;
const SEP_TITLE = /\s-\s/;

export function parseComicFilename(rawName: string): ParsedFilename {
  const base = rawName.replace(/^.*[\\/]/, "");

  let s = base.replace(EXT, "").replace(/_/g, " ").trim();

  const yearMatch = s.match(YEAR);
  const ofMatch = s.match(OF_N);
  const volMatch = s.match(VOL);

  const trashless = s.replace(TRASH, " ").replace(/\s+/g, " ").trim();

  let head = trashless;
  let title: string | undefined;
  const parts = trashless.split(SEP_TITLE);
  if (parts.length > 1) {
    head = parts[0]!.trim();
    title = parts.slice(1).join(" - ").trim();
  }

  const issueMatch = head.match(ISSUE);
  const issue = issueMatch?.[1];

  const series = head
    .replace(VOL, " ")
    .replace(ISSUE, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    series: series || base.replace(EXT, ""),
    issue,
    volume: volMatch?.[1] ? Number(volMatch[1]) : undefined,
    year: yearMatch?.[1] ? Number(yearMatch[1]) : undefined,
    ofCount: ofMatch?.[1] ? Number(ofMatch[1]) : undefined,
    title,
  };
}