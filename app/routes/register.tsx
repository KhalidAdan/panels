import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, data, useSearchParams } from "react-router";
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
import { auth } from "#app/lib/auth.server";
import {
  redirectWithAuthCookies,
  requireAnonymous,
} from "#app/lib/auth-utils.server";

const RegisterSchema = z.object({
  name: z.string().min(1, "Name required").max(64),
  email: z.email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  inviteCode: z.string().min(1, "Invite code required"),
});

export function meta() {
  return [{ title: "Register — panels" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: RegisterSchema });
  if (submission.status !== "success") {
    return data(
      { result: submission.reply() },
      { status: submission.status === "error" ? 400 : 200 },
    );
  }

  type SignUpBody = Parameters<typeof auth.api.signUpEmail>[0]["body"];
  const body = {
    email: submission.value.email,
    password: submission.value.password,
    name: submission.value.name,
    inviteCode: submission.value.inviteCode,
  } as unknown as SignUpBody;

  const response = await auth.api.signUpEmail({
    body,
    headers: request.headers,
    asResponse: true,
  });

  if (!response.ok) {
    let message = "Registration failed";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore parse errors
    }

    const lower = message.toLowerCase();
    if (lower.includes("invite")) {
      return data(
        {
          result: submission.reply({
            fieldErrors: { inviteCode: [message] },
          }),
        },
        { status: 400 },
      );
    }
    if (lower.includes("email") || lower.includes("already")) {
      return data(
        {
          result: submission.reply({
            fieldErrors: { email: [message] },
          }),
        },
        { status: 400 },
      );
    }
    return data(
      {
        result: submission.reply({
          formErrors: [message],
          hideFields: ["password"],
        }),
      },
      { status: 400 },
    );
  }

  return redirectWithAuthCookies(response, "/library");
}

export default function Register({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const prefilledInvite = searchParams.get("invite") ?? "";

  const [form, fields] = useForm({
    id: "register",
    lastResult: actionData?.result,
    constraint: getZodConstraint(RegisterSchema),
    defaultValue: { inviteCode: prefilledInvite },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: RegisterSchema });
    },
  });

  return (
    <div className="container mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            You need an invite code from an existing user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)} className="flex flex-col gap-2">
            {form.errors ? (
              <p className="text-sm text-destructive" id={form.errorId}>
                {form.errors.join(", ")}
              </p>
            ) : null}

            <Field
              labelProps={{ children: "Name" }}
              inputProps={{
                ...getInputProps(fields.name, { type: "text" }),
                autoComplete: "name",
                autoFocus: true,
              }}
              errors={fields.name.errors}
            />
            <Field
              labelProps={{ children: "Email" }}
              inputProps={{
                ...getInputProps(fields.email, { type: "email" }),
                autoComplete: "email",
              }}
              errors={fields.email.errors}
            />
            <Field
              labelProps={{ children: "Password" }}
              inputProps={{
                ...getInputProps(fields.password, { type: "password" }),
                autoComplete: "new-password",
                minLength: 8,
                maxLength: 128,
              }}
              errors={fields.password.errors}
            />
            <Field
              labelProps={{ children: "Invite code" }}
              inputProps={{
                ...getInputProps(fields.inviteCode, { type: "text" }),
                autoComplete: "off",
                spellCheck: false,
              }}
              errors={fields.inviteCode.errors}
            />

            <Button type="submit" className="mt-2">
              Create account
            </Button>

            <p className="mt-4 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="underline">
                Sign in
              </Link>
              .
            </p>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}