import { z } from "zod";
import { requireUser } from "#app/lib/auth-utils.server";
import {
  BackgroundColor,
  ContinuousFitMode,
  FitMode,
  ReaderMode,
  serializePrefs,
} from "#app/lib/reader-prefs";
import type { Route } from "./+types/resources.prefs";

const PatchSchema = z.object({
  readerMode: ReaderMode.optional(),
  fit: FitMode.optional(),
  doublePage: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => (typeof v === "boolean" ? v : v === "true")),
  background: BackgroundColor.optional(),
  rtlOverride: z.enum(["auto", "ltr", "rtl"]).optional(),
  continuousFit: ContinuousFitMode.optional(),
  thumbSidebarOpen: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => (typeof v === "boolean" ? v : v === "true")),
});

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);

  let body: Record<string, unknown> = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = (await request.json()) as Record<string, unknown>;
  } else {
    const fd = await request.formData();
    for (const [k, v] of fd.entries()) body[k] = typeof v === "string" ? v : undefined;
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const headers = new Headers();
  headers.set("Set-Cookie", serializePrefs(parsed.data));
  return new Response(null, { status: 204, headers });
}