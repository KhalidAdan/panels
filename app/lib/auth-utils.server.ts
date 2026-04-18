import { redirect } from "react-router";
import { auth } from "#app/lib/auth.server";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export async function requireUser(
  request: Request,
  redirectTo = "/login",
): Promise<AuthUser> {
  const result = await getSession(request);
  if (!result?.user) {
    const url = new URL(request.url);
    const params = new URLSearchParams({
      redirectTo: url.pathname + url.search,
    });
    throw redirect(`${redirectTo}?${params}`);
  }
  return result.user as AuthUser;
}

export async function requireAnonymous(
  request: Request,
  redirectTo = "/library",
): Promise<void> {
  const result = await getSession(request);
  if (result?.user) throw redirect(redirectTo);
}

export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect = "/library",
): string {
  if (!to || typeof to !== "string") return defaultRedirect;
  if (!to.startsWith("/")) return defaultRedirect;
  if (to.startsWith("//")) return defaultRedirect;
  return to;
}

export function redirectWithAuthCookies(
  authResponse: Response,
  to: string,
): Response {
  const headers = new Headers();
  for (const cookie of authResponse.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }
  return redirect(to, { headers });
}