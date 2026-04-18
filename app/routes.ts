import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // Auth
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("logout", "routes/logout.tsx"),
  route("api/auth/*", "routes/api.auth.$.ts"),

  // Settings
  route("settings/invites", "routes/settings.invites.tsx"),

  // Library
  route("library", "routes/library._index.tsx"),
  route("library/scan", "routes/library.scan.tsx"),
  route("onboarding", "routes/onboarding.tsx"),
  route("upload", "routes/upload.tsx"),
  route("comics/:comicId", "routes/comics.$comicId._index.tsx"),
  route("comics/:comicId/read", "routes/comics.$comicId.read.tsx"),

  // Resource routes
  route(
    "resources/page/:comicId/:page",
    "routes/resources.page.$comicId.$page.ts",
  ),
  route("resources/progress", "routes/resources.progress.ts"),
] satisfies RouteConfig;