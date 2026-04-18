import type { Comic } from "#app/generated/prisma/client";
import type { CVIssue, CVVolume } from "#app/lib/comicvine.server";

export interface MergeInput {
  volume: CVVolume | null;
  issue: CVIssue | null;
}

export interface ComicFieldUpdates {
  title?: string;
  series?: string | null;
  issueNumber?: string | null;
  year?: number | null;
  summary?: string | null;
  publisher?: string | null;
  writer?: string | null;
  volume?: number | null;
  comicvineId?: string | null;
  metadataJson: string;
}

export function buildFieldUpdates(
  existing: Comic,
  merge: MergeInput,
): ComicFieldUpdates {
  const { volume, issue } = merge;

  const cvTitle = cleanOrUndefined(issue?.name);
  const cvSeries = cleanOrUndefined(volume?.name);
  const cvIssueNumber = cleanOrUndefined(issue?.issue_number);
  const cvYear = volume?.start_year ? parseYear(volume.start_year) : undefined;
  const cvCoverYear = issue?.cover_date ? parseYearFromDate(issue.cover_date) : undefined;
  const cvSummary = stripHtml(
    issue?.description ?? issue?.deck ?? volume?.description ?? volume?.deck,
  );
  const cvPublisher = cleanOrUndefined(volume?.publisher?.name);
  const cvWriter = issue?.person_credits
    ? writersFromCredits(issue.person_credits)
    : undefined;

  const existingMeta = safeJsonParse(existing.metadataJson ?? "null");

  const nextMeta = {
    ...(typeof existingMeta === "object" && existingMeta !== null
      ? existingMeta
      : {}),
    comicvine: {
      volume: volume ?? null,
      issue: issue ?? null,
      matchedAt: new Date().toISOString(),
    },
  };

  const comicvineId = issue
    ? `4000-${issue.id}`
    : volume
      ? `4050-${volume.id}`
      : null;

  return {
    title: cvTitle ?? existing.title,
    series: cvSeries ?? existing.series,
    issueNumber: cvIssueNumber ?? existing.issueNumber,
    year: cvCoverYear ?? cvYear ?? existing.year,
    summary: cvSummary ?? existing.summary,
    publisher: cvPublisher ?? existing.publisher,
    writer: cvWriter ?? existing.writer,
    comicvineId,
    metadataJson: JSON.stringify(nextMeta),
  };
}

function cleanOrUndefined(s: string | null | undefined): string | undefined {
  if (s == null) return undefined;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseYear(s: string | number): number | undefined {
  const n = Number(s);
  return Number.isInteger(n) && n > 1800 && n < 2100 ? n : undefined;
}

function parseYearFromDate(s: string): number | undefined {
  const m = s.match(/^(\d{4})/);
  return m ? parseYear(m[1]!) : undefined;
}

function stripHtml(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const noTags = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return noTags.length > 0 ? noTags : undefined;
}

function writersFromCredits(
  credits: Array<{ name: string; role: string }>,
): string | undefined {
  const writers = credits
    .filter((c) => /writer/i.test(c.role))
    .map((c) => c.name.trim())
    .filter(Boolean);
  if (writers.length === 0) return undefined;
  return writers.join(", ");
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}