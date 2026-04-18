import { z } from "zod";
import { DEFAULT_MAX_UPLOAD_SIZE } from "./constants";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().default("file:./prisma/dev.db"),

  // Better Auth
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be >= 32 chars"),
  BETTER_AUTH_URL: z.url().default("http://localhost:5173"),

  // File system
  LIBRARY_PATH: z.string().default("./data/library"),
  CACHE_PATH: z.string().default("./data/cache"),
  UPLOAD_TEMP_PATH: z.string().default("./data/tmp"),
  MAX_UPLOAD_SIZE: z.coerce
    .number()
    .default(Number(process.env.MAX_UPLOAD_SIZE) || DEFAULT_MAX_UPLOAD_SIZE),

  // Optional: ComicVine enrichment
  COMICVINE_API_KEY: z.string().optional(),
  COMICVINE_USER_AGENT: z
    .string()
    .default("panels/0.1 (self-hosted comic reader)"),
  COMICVINE_BASE_URL: z.url().default("https://comicvine.gamespot.com/api"),

  // Admin seed
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
});

export function parseEnv(): z.infer<typeof EnvSchema> {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env: z.infer<typeof EnvSchema> = parseEnv();

export function getPublicEnv(): Record<string, string> {
  return {};
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof EnvSchema> {}
  }
}
