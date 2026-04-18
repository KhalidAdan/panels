import "dotenv/config";
import { auth, FIRST_ADMIN_TOKEN } from "../app/lib/auth.server";
import { prisma } from "../app/lib/db.server";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "[seed] SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD not set — skipping admin creation.",
    );
    return;
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`[seed] ${userCount} user(s) already exist — nothing to do.`);
    return;
  }

  console.log(`[seed] Creating first admin: ${email}`);

  type SignUpBody = Parameters<typeof auth.api.signUpEmail>[0]["body"];
  const body = {
    email,
    password,
    name: email.split("@")[0] ?? "admin",
    inviteCode: FIRST_ADMIN_TOKEN,
  } as unknown as SignUpBody;

  const response = await auth.api.signUpEmail({
    body,
    headers: new Headers(),
    asResponse: true,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[seed] Admin signup failed: ${response.status} ${text}`);
  }

  const admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    throw new Error("[seed] Admin user not found after signup");
  }

  console.log(`[seed] Admin created: ${admin.id} ${admin.email}`);
  console.log(
    "[seed] You can now log in with the SEED_ADMIN_* credentials you just used.",
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });