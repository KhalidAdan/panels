import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prisma } from "#app/lib/db.server";
import { env } from "#app/lib/env.server";

export const FIRST_ADMIN_TOKEN = "__FIRST_ADMIN__";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: prismaAdapter(prisma, { provider: "sqlite" }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`[panels][verify] ${user.email} → ${url}`);
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const body = ctx.body as Record<string, unknown> | undefined;
      const inviteCode =
        typeof body?.inviteCode === "string" ? body.inviteCode : undefined;

      if (inviteCode === FIRST_ADMIN_TOKEN) {
        const userCount = await prisma.user.count();
        if (userCount === 0) {
          (ctx.context as Record<string, unknown>).isSeedAdmin = true;
          if (body) delete body.inviteCode;
          return;
        }
        throw new APIError("BAD_REQUEST", {
          message: "Invalid invite code",
        });
      }

      if (!inviteCode) {
        throw new APIError("BAD_REQUEST", {
          message: "Invite code required",
        });
      }

      const invite = await prisma.inviteCode.findUnique({
        where: { code: inviteCode },
      });
      if (!invite) {
        throw new APIError("BAD_REQUEST", { message: "Invalid invite code" });
      }
      if (invite.expiresAt < new Date()) {
        throw new APIError("BAD_REQUEST", { message: "Invite code expired" });
      }
      if (invite.usedById) {
        throw new APIError("BAD_REQUEST", {
          message: "Invite code already used",
        });
      }

      (ctx.context as Record<string, unknown>).inviteCode = inviteCode;
      if (body) delete body.inviteCode;
    }),

    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const context = ctx.context as Record<string, unknown>;
      const sessionData = context.newSession as { user?: { id?: string } } | undefined;
      const userId = typeof sessionData?.user?.id === "string" ? sessionData.user.id : undefined;
      if (!userId) return;

      if (context.isSeedAdmin) return;

      const code =
        typeof context.inviteCode === "string" ? context.inviteCode : undefined;
      if (!code) return;

      await prisma.inviteCode.update({
        where: { code },
        data: { usedById: userId, usedAt: new Date() },
      });
    }),
  },

  advanced: {
    cookiePrefix: "panels",
  },
});

export type Session = typeof auth.$Infer.Session;