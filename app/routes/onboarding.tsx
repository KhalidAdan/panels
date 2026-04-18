import { Form, Link, redirect } from "react-router";
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

export function meta() {
  return [{ title: "Welcome — panels" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const count = await prisma.comic.count();
  if (count > 0) throw redirect("/library");
  return { user };
}

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  return (
    <div className="container mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome to panels</CardTitle>
          <CardDescription>
            Hi {loaderData.user.name}. Your library is empty — let&apos;s add
            something to read.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <h3 className="font-medium">Upload a comic</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Pick one .cbz from your computer. Good for testing.
            </p>
            <Button asChild>
              <Link to="/upload">Upload a CBZ</Link>
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <h3 className="font-medium">Scan the library directory</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Point panels at <code>LIBRARY_PATH</code> on disk and import
              every .cbz it finds. Safe to re-run — duplicates are skipped.
            </p>
            <Form method="post" action="/library/scan">
              <Button type="submit" variant="secondary">
                Scan library
              </Button>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}