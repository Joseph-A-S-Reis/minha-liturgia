"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
} from "@/lib/account-security";
import { buildAppUrl, sendEmail } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha precisa ter no mínimo 6 caracteres."),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, "Informe seu nome."),
  confirmPassword: z.string().min(6),
});

export type AuthActionState = {
  success: boolean;
  message: string;
};

const requestEmailSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, "A senha precisa ter no mínimo 6 caracteres."),
  confirmPassword: z.string().min(6),
});

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const [existingUser] = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      failedLoginAttempts: users.failedLoginAttempts,
      lockedUntil: users.lockedUntil,
    })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (existingUser?.lockedUntil && existingUser.lockedUntil > new Date()) {
    const minutes = Math.max(
      1,
      Math.ceil((existingUser.lockedUntil.getTime() - Date.now()) / 60000),
    );

    return {
      success: false,
      message: `Conta temporariamente bloqueada. Tente novamente em ${minutes} minuto(s).`,
    };
  }

  if (existingUser && !existingUser.emailVerified) {
    return {
      success: false,
      message:
        "Seu e-mail ainda não foi verificado. Use o link enviado no cadastro ou reenvie a verificação.",
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/diario",
    });

    return { success: true, message: "Login realizado com sucesso." };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, message: "E-mail ou senha inválidos." };
    }

    throw error;
  }
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { success: false, message: "As senhas não conferem." };
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (existingUser) {
    return { success: false, message: "Já existe conta com este e-mail." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db.insert(users).values({
    id: crypto.randomUUID(),
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
  });

  const [createdUser] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (createdUser) {
    const token = await createEmailVerificationToken({
      userId: createdUser.id,
      email: createdUser.email,
    });
    const verifyUrl = buildAppUrl(`/verificar-email?token=${token}`);

    await sendEmail({
      to: createdUser.email,
      subject: "Verifique seu e-mail - Minha Liturgia",
      html: `<p>Olá ${createdUser.name ?? ""},</p><p>Confirme seu e-mail para ativar sua conta:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
  }

  return {
    success: true,
    message:
      "Conta criada com sucesso. Verifique seu e-mail para concluir a ativação.",
  };
}

export async function resendVerificationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = requestEmailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const [existingUser] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!existingUser) {
    return {
      success: true,
      message: "Se o e-mail existir, uma nova verificação foi enviada.",
    };
  }

  if (existingUser.emailVerified) {
    return { success: false, message: "Este e-mail já está verificado." };
  }

  const token = await createEmailVerificationToken({
    userId: existingUser.id,
    email: existingUser.email,
  });

  const verifyUrl = buildAppUrl(`/verificar-email?token=${token}`);

  await sendEmail({
    to: existingUser.email,
    subject: "Reenvio de verificação - Minha Liturgia",
    html: `<p>Olá ${existingUser.name ?? ""},</p><p>Use este link para verificar seu e-mail:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });

  return { success: true, message: "Link de verificação reenviado." };
}

export async function requestPasswordResetAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = requestEmailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const [existingUser] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (existingUser) {
    const token = await createPasswordResetToken({
      userId: existingUser.id,
      email: existingUser.email,
    });
    const resetUrl = buildAppUrl(`/redefinir-senha?token=${token}`);

    await sendEmail({
      to: existingUser.email,
      subject: "Redefinição de senha - Minha Liturgia",
      html: `<p>Olá ${existingUser.name ?? ""},</p><p>Use este link para redefinir sua senha:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }

  return {
    success: true,
    message: "Se o e-mail existir, você receberá um link para redefinição.",
  };
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { success: false, message: "As senhas não conferem." };
  }

  const newPasswordHash = await hashPassword(parsed.data.password);
  const result = await consumePasswordResetToken({
    token: parsed.data.token,
    newPasswordHash,
  });

  if (!result.success) {
    return {
      success: false,
      message: "Token inválido ou expirado. Solicite um novo link.",
    };
  }

  return { success: true, message: "Senha redefinida com sucesso. Faça login." };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/inicio" });
}
