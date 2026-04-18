import { Field } from "#app/components/forms";
import { Button } from "#app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#app/components/ui/card";
import {
  redirectWithAuthCookies,
  requireAnonymous,
  safeRedirect,
} from "#app/lib/auth-utils.server";
import { auth } from "#app/lib/auth.server";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, data, useSearchParams } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/login";

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password required"),
  redirectTo: z.string().optional(),
});

export function meta() {
  return [{ title: "Sign in — panels" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: LoginSchema });
  if (submission.status !== "success") {
    return data(
      { result: submission.reply() },
      { status: submission.status === "error" ? 400 : 200 },
    );
  }

  const response = await auth.api.signInEmail({
    body: {
      email: submission.value.email,
      password: submission.value.password,
    },
    headers: request.headers,
    asResponse: true,
  });

  if (!response.ok) {
    return data(
      {
        result: submission.reply({
          formErrors: ["Incorrect email or password"],
          hideFields: ["password"],
        }),
      },
      { status: 400 },
    );
  }

  return redirectWithAuthCookies(
    response,
    safeRedirect(submission.value.redirectTo),
  );
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "";

  const [form, fields] = useForm({
    id: "login",
    lastResult: actionData?.result,
    constraint: getZodConstraint(LoginSchema),
    defaultValue: { redirectTo },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: LoginSchema });
    },
  });

  return (
    <div className="container mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Welcome back to panels.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            method="post"
            {...getFormProps(form)}
            className="flex flex-col gap-2"
          >
            {form.errors ? (
              <p className="text-sm text-destructive" id={form.errorId}>
                {form.errors.join(", ")}
              </p>
            ) : null}

            <Field
              labelProps={{ children: "Email" }}
              inputProps={{
                ...getInputProps(fields.email, { type: "email" }),
                autoComplete: "email",
                autoFocus: true,
              }}
              errors={fields.email.errors}
            />

            <Field
              labelProps={{ children: "Password" }}
              inputProps={{
                ...getInputProps(fields.password, { type: "password" }),
                autoComplete: "current-password",
              }}
              errors={fields.password.errors}
            />

            <input {...getInputProps(fields.redirectTo, { type: "hidden" })} />

            <Button type="submit" className="mt-2">
              Sign in
            </Button>

            <p className="mt-4 text-sm text-muted-foreground">
              New here?{" "}
              <Link to="/register" className="underline">
                Register with an invite code
              </Link>
              .
            </p>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
