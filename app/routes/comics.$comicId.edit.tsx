import { Field } from "#app/components/forms";
import { MarkdownEditor } from "#app/components/markdown-editor";
import { Button } from "#app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#app/components/ui/card";
import { requireUser } from "#app/lib/auth-utils.server";
import { buildFieldUpdates } from "#app/lib/comic-metadata.server";
import {
  bindByComicVineId,
  isComicVineEnabled,
  parseComicVineUrl,
} from "#app/lib/comicvine.server";
import { prisma } from "#app/lib/db.server";
import { enrichFromComicVine } from "#app/lib/ingest.server";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, data, redirect } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/comics.$comicId.edit";

const EditSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("save"),
    title: z.string().min(1).max(512),
    series: z.string().max(512).optional(),
    issueNumber: z.string().max(64).optional(),
    volume: z.coerce.number().int().min(0).max(9999).optional(),
    year: z.coerce.number().int().min(1800).max(2100).optional(),
    publisher: z.string().max(256).optional(),
    writer: z.string().max(512).optional(),
    summary: z.string().max(4096).optional(),
    isManga: z.literal("on").optional(),
  }),
  z.object({
    intent: z.literal("bind-comicvine"),
    reference: z.string().min(1),
  }),
  z.object({
    intent: z.literal("re-enrich"),
  }),
]);

export function meta({ data }: Route.MetaArgs) {
  if (!data?.comic) return [{ title: "Edit — panels" }];
  return [{ title: `Edit: ${data.comic.title} — panels` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const comic = await prisma.comic.findUnique({
    where: { id: params.comicId },
  });
  if (!comic) throw new Response("Not found", { status: 404 });

  return {
    user,
    comic,
    comicVineEnabled: isComicVineEnabled(),
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const comic = await prisma.comic.findUnique({
    where: { id: params.comicId },
  });
  if (!comic) throw new Response("Not found", { status: 404 });
  if (comic.importedById !== user.id) {
    throw new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: EditSchema });
  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  switch (submission.value.intent) {
    case "save": {
      const v = submission.value;
      await prisma.comic.update({
        where: { id: comic.id },
        data: {
          title: v.title,
          series: v.series?.trim() || null,
          issueNumber: v.issueNumber?.trim() || null,
          volume: v.volume ?? null,
          year: v.year ?? null,
          publisher: v.publisher?.trim() || null,
          writer: v.writer?.trim() || null,
          summary: v.summary?.trim() || null,
          isManga: v.isManga === "on",
        },
      });
      return redirect(`/comics/${comic.id}?saved=1`);
    }

    case "bind-comicvine": {
      if (!isComicVineEnabled()) {
        return data(
          {
            result: submission.reply({
              formErrors: ["ComicVine is not configured on this server."],
            }),
          },
          { status: 400 },
        );
      }
      const ref = submission.value.reference.trim();
      const id = ref.includes("://") ? parseComicVineUrl(ref) : ref;
      if (!id || !/^\d{4}-\d+(?:\/\d+)?$/.test(id)) {
        return data(
          {
            result: submission.reply({
              fieldErrors: {
                reference: ["Not a valid ComicVine URL or ID"],
              },
            }),
          },
          { status: 400 },
        );
      }

      const result = await bindByComicVineId(id);
      if (!result || (!result.volume && !result.issue)) {
        return data(
          {
            result: submission.reply({
              fieldErrors: {
                reference: ["ComicVine returned no match for that ID"],
              },
            }),
          },
          { status: 404 },
        );
      }

      const updates = buildFieldUpdates(comic, result);
      await prisma.comic.update({
        where: { id: comic.id },
        data: updates,
      });
      return redirect(`/comics/${comic.id}?saved=1`);
    }

    case "re-enrich": {
      if (!isComicVineEnabled()) {
        return data(
          {
            result: submission.reply({
              formErrors: ["ComicVine is not configured on this server."],
            }),
          },
          { status: 400 },
        );
      }
      await enrichFromComicVine(comic.id, {
        series: comic.series,
        issueNumber: comic.issueNumber,
        year: comic.year,
        comicInfoWebUrl: null,
      });
      return redirect(`/comics/${comic.id}?saved=1`);
    }
  }
}

export default function EditComic({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { comic, comicVineEnabled } = loaderData;

  const [form, fields] = useForm({
    id: `edit-${comic.id}`,
    lastResult:
      actionData && "result" in actionData ? actionData.result : undefined,
    constraint: getZodConstraint(EditSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    defaultValue: {
      intent: "save",
      title: comic.title,
      series: comic.series ?? "",
      issueNumber: comic.issueNumber ?? "",
      volume: comic.volume?.toString() ?? undefined,
      year: comic.year?.toString() ?? undefined,
      publisher: comic.publisher ?? "",
      writer: comic.writer ?? "",
      summary: comic.summary ?? "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: EditSchema });
    },
  });

  return (
    <div className="container mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/comics/${comic.id}`}>← Back</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Edit metadata</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>
            Save to overwrite auto-derived values with your edits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            method="post"
            {...getFormProps(form)}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="intent" value="save" />

            {form.errors ? (
              <p className="text-sm text-destructive" id={form.errorId}>
                {form.errors.join(", ")}
              </p>
            ) : null}

            <Field
              labelProps={{ children: "Title" }}
              inputProps={getInputProps(fields.title, { type: "text" })}
              errors={fields.title.errors}
            />
            <Field
              labelProps={{ children: "Series" }}
              inputProps={getInputProps(fields.series, { type: "text" })}
              errors={fields.series.errors}
            />

            <div className="grid grid-cols-3 gap-2">
              <Field
                labelProps={{ children: "Issue #" }}
                inputProps={getInputProps(fields.issueNumber, { type: "text" })}
                errors={fields.issueNumber.errors}
              />
              <Field
                labelProps={{ children: "Volume" }}
                inputProps={{
                  ...getInputProps(fields.volume, { type: "number" }),
                  min: 0,
                  max: 9999,
                }}
                errors={fields.volume.errors}
              />
              <Field
                labelProps={{ children: "Year" }}
                inputProps={{
                  ...getInputProps(fields.year, { type: "number" }),
                  min: 1800,
                  max: 2100,
                }}
                errors={fields.year.errors}
              />
            </div>

            <Field
              labelProps={{ children: "Publisher" }}
              inputProps={getInputProps(fields.publisher, { type: "text" })}
              errors={fields.publisher.errors}
            />
            <Field
              labelProps={{ children: "Writer" }}
              inputProps={getInputProps(fields.writer, { type: "text" })}
              errors={fields.writer.errors}
            />

            <MarkdownEditor
              name="summary"
              defaultValue={comic.summary ?? ""}
              label="Summary"
              placeholder="Enter a summary... Supports **bold**, *italic*, [links](url)"
              errors={fields.summary.errors}
            />

            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isManga"
                defaultChecked={comic.isManga}
                className="h-4 w-4 rounded border-input"
              />
              <span>Read right-to-left (manga)</span>
            </label>

            <div className="mt-2">
              <Button type="submit">Save</Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ComicVine</CardTitle>
          <CardDescription>
            {comicVineEnabled
              ? comic.comicvineId
                ? `Currently bound to ${comic.comicvineId}.`
                : "Not yet bound to a ComicVine entry."
              : "ComicVine API key not configured. Set COMICVINE_API_KEY to enable."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Form method="post" className="flex items-end gap-2">
            <input type="hidden" name="intent" value="bind-comicvine" />
            <div className="flex-1">
              <label htmlFor="reference" className="mb-1 block text-sm">
                ComicVine URL or ID
              </label>
              <input
                id="reference"
                name="reference"
                type="text"
                placeholder="https://comicvine.gamespot.com/…/4000-12345/"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                autoComplete="off"
                spellCheck={false}
                disabled={!comicVineEnabled}
              />
            </div>
            <Button type="submit" disabled={!comicVineEnabled}>
              Bind
            </Button>
          </Form>

          <Form method="post">
            <input type="hidden" name="intent" value="re-enrich" />
            <Button
              type="submit"
              variant="secondary"
              disabled={!comicVineEnabled}
            >
              Re-run auto-match
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
