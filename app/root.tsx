import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type LinksFunction,
} from "react-router";
import { Toaster } from "#app/components/ui/sonner";
import { GeneralErrorBoundary } from "#app/components/error-boundary";
import appStylesHref from "#app/app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appStylesHref },
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        {children}
        <Toaster position="top-right" richColors />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  return (
    <GeneralErrorBoundary
      statusHandlers={{
        404: () => (
          <>
            <h1 className="text-2xl font-semibold">Not found</h1>
            <p className="text-muted-foreground">
              The page you were looking for doesn&apos;t exist.
            </p>
          </>
        ),
        403: () => (
          <>
            <h1 className="text-2xl font-semibold">Forbidden</h1>
            <p className="text-muted-foreground">
              You don&apos;t have access to this page.
            </p>
          </>
        ),
      }}
    />
  );
}

export function HydrateFallback() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}