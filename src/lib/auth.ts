import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { getAuthDatabase } from "@/db/client";
import * as authSchema from "@/db/schema/auth";
import { sendAuthEmail } from "@/lib/auth-email";

const trustedOrigins = (process.env.AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32)
) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
}

if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is required in production");
}

function dispatchAuthEmail(email: Parameters<typeof sendAuthEmail>[0]) {
  void sendAuthEmail(email).catch(() => {
    console.error("Authentication email delivery failed");
  });
}

export const auth = betterAuth({
  ...(process.env.BETTER_AUTH_SECRET
    ? { secret: process.env.BETTER_AUTH_SECRET }
    : {}),
  ...(process.env.BETTER_AUTH_URL
    ? { baseURL: process.env.BETTER_AUTH_URL }
    : {}),
  database: drizzleAdapter(getAuthDatabase(), {
    provider: "pg",
    schema: {
      user: authSchema.user,
      session: authSchema.session,
      account: authSchema.account,
      verification: authSchema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      dispatchAuthEmail({
        to: user.email,
        subject: "Set your ARISE password",
        text: `Use this one-time link to set your ARISE password: ${url}`,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      dispatchAuthEmail({
        to: user.email,
        subject: "Verify your ARISE email",
        text: `Verify your ARISE institutional email with this link: ${url}`,
      });
    },
  },
  user: {
    deleteUser: { enabled: false },
    changeEmail: { enabled: false },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  trustedOrigins,
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
  plugins: [admin({ defaultRole: "user" })],
});
