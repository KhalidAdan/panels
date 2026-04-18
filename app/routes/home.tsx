import { Link, redirect } from "react-router";
import { Button } from "#app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#app/components/ui/card";
import { getSession } from "#app/lib/auth-utils.server";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "panels" },
    { name: "description", content: "A comic book reader." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  if (session?.user) throw redirect("/library");
  return null;
}

export default function Home() {
  return (
    <div className="container mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl">panels</CardTitle>
          <CardDescription>A self-hosted comic book reader.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            You&apos;ll need an invite to create an account.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/register">Register</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}