import { redirect } from "react-router";
import { auth } from "#app/lib/auth.server";
import { redirectWithAuthCookies } from "#app/lib/auth-utils.server";

export async function loader() {
  throw redirect("/");
}

export async function action({ request }: Route.ActionArgs) {
  const response = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  return redirectWithAuthCookies(response, "/");
}