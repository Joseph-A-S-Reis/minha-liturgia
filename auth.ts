import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { getUserLockInfo } from "@/lib/account-security";
import { verifyPassword } from "@/lib/password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/entrar",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (rawCredentials) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);

        if (!existingUser || !existingUser.passwordHash) {
          return null;
        }

        const now = new Date();
        if (existingUser.lockedUntil && existingUser.lockedUntil > now) {
          return null;
        }

        const validPassword = await verifyPassword(
          parsed.data.password,
          existingUser.passwordHash,
        );

        if (!validPassword) {
          const failedLoginAttempts = existingUser.failedLoginAttempts + 1;
          const lock = getUserLockInfo(failedLoginAttempts);

          await db
            .update(users)
            .set({
              failedLoginAttempts,
              lockedUntil: lock.locked
                ? new Date(now.getTime() + lock.lockMinutes * 60 * 1000)
                : null,
            })
            .where(eq(users.id, existingUser.id));

          return null;
        }

        if (!existingUser.emailVerified) {
          return null;
        }

        await db
          .update(users)
          .set({
            failedLoginAttempts: 0,
            lockedUntil: null,
          })
          .where(eq(users.id, existingUser.id));

        return {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          image: existingUser.image,
        };
      },
    }),
  ],
  callbacks: {
    session: ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  trustHost: true,
});
