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
] satisfies RouteConfig;