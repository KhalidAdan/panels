import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import crypto from "node:crypto";
import { Form, Link, data } from "react-router";
import { z } from "zod";
import { Field } from "#app/components/forms";
import { Button } from "#app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#app/components/ui/card";
import { requireUser } from "#app/lib/auth-utils.server";
import { prisma } from "#app/lib/db.server";

const InviteSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("create"),
    expiresInDays: z.coerce.number().int().min(1).max(365).default(7),
  }),
  z.object({
    intent: z.literal("delete"),
    id: z.string().min(1),
  }),
]);

export function meta() {
  return [{ title: "Invites — panels" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  const invites = await prisma.inviteCode.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      usedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return { user, invites };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: InviteSchema });
  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  switch (submission.value.intent) {
    case "create": {
      const code = crypto.randomBytes(12).toString("base64url");
      const expiresAt = new Date(
        Date.now() + submission.value.expiresInDays * 24 * 60 * 60 * 1000,
      );
      await prisma.inviteCode.create({
        data: { code, expiresAt, createdById: user.id },
      });
      return data({ result: submission.reply({ resetForm: true }) });
    }
    case "delete": {
      const invite = await prisma.inviteCode.findUnique({
        where: { id: submission.value.id },
      });
      if (!invite) {
        return data(
          {
            result: submission.reply({ formErrors: ["Invite not found"] }),
          },
          { status: 404 },
        );
      }
      if (invite.createdById !== user.id) {
        return data(
          { result: submission.reply({ formErrors: ["Not your invite"] }) },
          { status: 403 },
        );
      }
      if (invite.usedById) {
        return data(
          { result: submission.reply({ formErrors: ["Invite already used"] }) },
          { status: 400 },
        );
      }
      await prisma.inviteCode.delete({ where: { id: invite.id } });
      return data({ result: submission.reply() });
    }
  }
}

export default function Invites({ loaderData, actionData }: Route.ComponentProps) {
  const { user, invites } = loaderData;

  const [form, fields] = useForm({
    id: "invite-create",
    lastResult:
      actionData && "result" in actionData ? actionData.result : undefined,
    constraint: getZodConstraint(InviteSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: InviteSchema });
    },
  });

  const origin =
    typeof document !== "undefined" ? window.location.origin : "";

  return (
    <div className="container mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invites</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.name} ({user.email}).
          </p>
        </div>
        <Form method="post" action="/logout">
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </Form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Create an invite</CardTitle>
          <CardDescription>
            One code, one user. Expires after the configured number of days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)} className="flex items-end gap-3">
            <input type="hidden" name="intent" value="create" />
            <Field
              labelProps={{ children: "Expires in (days)" }}
              inputProps={{
                ...getInputProps(fields.expiresInDays, { type: "number" }),
                min: 1,
                max: 365,
                defaultValue: 7,
              }}
              errors={fields.expiresInDays.errors}
              className="flex-1"
            />
            <Button type="submit">Generate</Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All invites</CardTitle>
          <CardDescription>
            {invites.length} {invites.length === 1 ? "invite" : "invites"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No invites yet. Generate one above.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {invites.map((invite) => {
                const expired = invite.expiresAt < new Date();
                const used = !!invite.usedById;
                const status = used
                  ? "Used"
                  : expired
                    ? "Expired"
                    : "Available";
                const url = `${origin}/register?invite=${invite.code}`;
                return (
                  <li
                    key={invite.id}
                    className="flex flex-col gap-1 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <code className="font-mono text-xs">
                        {invite.code}
                      </code>
                      <span
                        className={
                          used
                            ? "text-muted-foreground"
                            : expired
                              ? "text-destructive"
                              : "text-primary"
                        }
                      >
                        {status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created by {invite.createdBy.name} on{" "}
                      {invite.createdAt.toLocaleDateString()} · expires{" "}
                      {invite.expiresAt.toLocaleDateString()}
                      {used && invite.usedBy ? (
                        <> · used by {invite.usedBy.name}</>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {!used && !expired ? (
                        <>
                          <a
                            href={url}
                            className="truncate text-xs underline"
                          >
                            {url}
                          </a>
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="delete"
                            />
                            <input type="hidden" name="id" value={invite.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              disabled={invite.createdById !== user.id}
                            >
                              Revoke
                            </Button>
                          </Form>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link to="/library" className="underline">
          Back to library
        </Link>
      </p>
    </div>
  );
}