import { prisma } from "#app/lib/db.server";
import { env } from "#app/lib/env.server";

export interface CVImage {
  icon_url?: string;
  thumb_url?: string;
  small_url?: string;
  medium_url?: string;
  screen_url?: string;
  screen_large_url?: string;
  super_url?: string;
  original_url?: string;
}

export interface CVVolume {
  id: number;
  name: string;
  start_year?: string;
  count_of_issues?: number;
  publisher?: { id: number; name: string } | null;
  image?: CVImage | null;
  site_detail_url?: string;
  deck?: string | null;
  description?: string | null;
}

export interface CVIssue {
  id: number;
  name?: string | null;
  issue_number?: string;
  cover_date?: string | null;
  volume?: { id: number; name: string } | null;
  person_credits?: Array<{ id: number; name: string; role: string }>;
  image?: CVImage | null;
  site_detail_url?: string;
  deck?: string | null;
  description?: string | null;
}

export interface CVListResponse<T> {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: T[];
  version?: string;
}

export interface CVDetailResponse<T> {
  error: string;
  status_code: number;
  results: T;
  version?: string;
}

export function isComicVineEnabled(): boolean {
  return typeof env.COMICVINE_API_KEY === "string" && env.COMICVINE_API_KEY.length > 0;
}

const MIN_GAP_MS = 1500;
let lastRequestTs = 0;
let chainedGate: Promise<void> = Promise.resolve();

function rateLimit(): Promise<void> {
  const gate = chainedGate.then(async () => {
    const now = Date.now();
    const wait = lastRequestTs + MIN_GAP_MS - now;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestTs = Date.now();
  });
  chainedGate = gate;
  return gate;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function cachedFetch<T>(
  cacheKey: string,
  loader: () => Promise<T | null>,
): Promise<T | null> {
  const row = await prisma.comicVineCache.findUnique({
    where: { cacheKey },
  });
  if (row && row.expiresAt > new Date()) {
    try {
      return JSON.parse(row.payload) as T;
    } catch {
      // Fall through and re-fetch on parse corruption.
    }
  }

  const fresh = await loader();
  if (fresh !== null) {
    await prisma.comicVineCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        payload: JSON.stringify(fresh),
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
      update: {
        payload: JSON.stringify(fresh),
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
    });
  }
  return fresh;
}

const MAX_RETRIES = 3;

async function rawFetch<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T | null> {
  if (!isComicVineEnabled()) return null;

  const url = new URL(path.startsWith("/") ? path.slice(1) : path, `${env.COMICVINE_BASE_URL}/`);
  url.searchParams.set("api_key", env.COMICVINE_API_KEY!);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  let attempt = 0;
  let backoffMs = 2000;
  while (true) {
    await rateLimit();
    attempt++;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": env.COMICVINE_USER_AGENT,
          Accept: "application/json",
        },
      });
    } catch (err) {
      console.error("[comicvine] network error", err);
      if (attempt >= MAX_RETRIES) return null;
      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs *= 2;
      continue;
    }

    if (response.status === 420 || response.status === 429) {
      if (attempt >= MAX_RETRIES) {
        console.error(
          `[comicvine] rate-limited after ${attempt} attempts: ${url.pathname}`,
        );
        return null;
      }
      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs *= 2;
      continue;
    }

    if (!response.ok) {
      console.error(
        `[comicvine] HTTP ${response.status} ${response.statusText}: ${url.pathname}`,
      );
      return null;
    }

    const body = (await response.json()) as {
      status_code?: number;
      error?: string;
    } & T;

    if (body.status_code === 107) {
      if (attempt >= MAX_RETRIES) return null;
      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs *= 2;
      continue;
    }
    if (body.status_code === 101) {
      return null;
    }
    if (body.status_code && body.status_code !== 1 && body.status_code !== 100) {
      console.error(
        `[comicvine] status ${body.status_code} ${body.error ?? ""}: ${url.pathname}`,
      );
      return null;
    }
    return body as T;
  }
}

const VOLUME_FIELD_LIST =
  "id,name,start_year,count_of_issues,publisher,image,site_detail_url,deck";
const ISSUE_FIELD_LIST =
  "id,name,issue_number,cover_date,volume,person_credits,image,site_detail_url,deck,description";

export function normalizeSeriesName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchVolumes(
  series: string,
  startYear?: number,
  limit = 10,
): Promise<CVVolume[]> {
  const normalized = normalizeSeriesName(series);
  if (!normalized) return [];
  const cacheKey = `vol:${normalized}:${startYear ?? "any"}:${limit}`;

  const response = await cachedFetch(cacheKey, async () => {
    const filter = startYear
      ? `name:${normalized},start_year:${startYear}`
      : `name:${normalized}`;
    return rawFetch<CVListResponse<CVVolume>>("/volumes/", {
      filter,
      field_list: VOLUME_FIELD_LIST,
      limit,
    });
  });

  return response?.results ?? [];
}

export async function getVolume(volumeId: number): Promise<CVVolume | null> {
  const cacheKey = `vol-detail:${volumeId}`;
  const response = await cachedFetch(cacheKey, () =>
    rawFetch<CVDetailResponse<CVVolume>>(`/volume/4050-${volumeId}/`, {
      field_list: VOLUME_FIELD_LIST,
    }),
  );
  return response?.results ?? null;
}

export async function searchIssues(
  volumeId: number,
  issueNumber: string,
  limit = 5,
): Promise<CVIssue[]> {
  const cacheKey = `iss:${volumeId}/${issueNumber}:${limit}`;
  const response = await cachedFetch(cacheKey, () =>
    rawFetch<CVListResponse<CVIssue>>("/issues/", {
      filter: `volume:${volumeId},issue_number:${issueNumber}`,
      field_list: ISSUE_FIELD_LIST,
      limit,
    }),
  );
  return response?.results ?? [];
}

export async function getIssue(issueId: number): Promise<CVIssue | null> {
  const cacheKey = `iss-detail:${issueId}`;
  const response = await cachedFetch(cacheKey, () =>
    rawFetch<CVDetailResponse<CVIssue>>(`/issue/4000-${issueId}/`, {
      field_list: ISSUE_FIELD_LIST,
    }),
  );
  return response?.results ?? null;
}

export interface MatchCandidate {
  series: string;
  issueNumber?: string;
  year?: number;
}

export interface MatchResult {
  volume: CVVolume;
  issue: CVIssue | null;
  score: number;
}

function scoreVolume(v: CVVolume, c: MatchCandidate): number {
  let score = 0;
  const vName = (v.name ?? "").toLowerCase();
  const cName = c.series.toLowerCase();
  if (vName === cName) score += 10;
  else if (vName.includes(cName) || cName.includes(vName)) score += 3;
  if (c.year && v.start_year) {
    const delta = Math.abs(Number(v.start_year) - c.year);
    if (delta === 0) score += 5;
    else if (delta <= 1) score += 3;
    else if (delta <= 2) score += 1;
  }
  if (typeof v.count_of_issues === "number" && v.count_of_issues > 0) {
    score += 0.5;
  }
  return score;
}

export async function matchComic(
  candidate: MatchCandidate,
): Promise<MatchResult | null> {
  const volumes = await searchVolumes(candidate.series, candidate.year);
  if (volumes.length === 0) return null;

  const ranked = volumes
    .map((v) => ({ v, score: scoreVolume(v, candidate) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;
  const best = ranked[0]!;

  if (!candidate.issueNumber) {
    return { volume: best.v, issue: null, score: best.score };
  }

  const issues = await searchIssues(best.v.id, candidate.issueNumber);
  const issue = issues[0] ?? null;

  return { volume: best.v, issue, score: best.score };
}

export interface DirectBindResult {
  volume: CVVolume | null;
  issue: CVIssue | null;
}

export async function bindByComicVineId(
  id: string,
): Promise<DirectBindResult | null> {
  const match = id.match(/^(\d{4})-(\d+)(?:\/(\d+))?$/);
  if (!match) return null;
  const [, kind, first, second] = match;
  if (kind === "4000") {
    const issue = await getIssue(Number(first));
    if (!issue) return null;
    const volume = issue.volume
      ? await getVolume(issue.volume.id)
      : null;
    return { volume, issue };
  }
  if (kind === "4050") {
    const volume = await getVolume(Number(first));
    if (!volume) return null;
    if (second) {
      const issues = await searchIssues(volume.id, second);
      return { volume, issue: issues[0] ?? null };
    }
    return { volume, issue: null };
  }
  return null;
}

export function parseComicVineUrl(url: string): string | null {
  const m = url.match(/\/(4000|4050)-(\d+)(?:\/(\d+))?/);
  if (!m) return null;
  return m[3] ? `${m[1]}-${m[2]}/${m[3]}` : `${m[1]}-${m[2]}`;
}