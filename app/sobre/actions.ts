"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendEmail } from "@/lib/mailer";

export type AboutContactActionState = {
  success: boolean;
  message: string;
};

const contactSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome com pelo menos 2 caracteres.").max(120, "O nome deve ter no máximo 120 caracteres."),
  email: z.string().trim().email("Informe um e-mail válido.").max(255, "O e-mail deve ter no máximo 255 caracteres."),
  message: z.string().trim().min(10, "A mensagem deve ter pelo menos 10 caracteres.").max(2000, "A mensagem deve ter no máximo 2000 caracteres."),
});

function normalizeError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function submitAboutContactAction(
  _previousState: AboutContactActionState,
  formData: FormData,
): Promise<AboutContactActionState> {
  try {
    const recipient = process.env.CONTACT_EMAIL_TO?.trim();

    if (!recipient) {
      return {
        success: false,
        message: "Configure CONTACT_EMAIL_TO no ambiente para receber as mensagens da página Sobre.",
      };
    }

    const parsed = contactSchema.parse({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      message: String(formData.get("message") ?? ""),
    });

    const submittedAt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    await sendEmail({
      to: recipient,
      subject: `Novo contato recebido em Minha Liturgia — ${parsed.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #18181b;">
          <h1 style="font-size: 20px; margin-bottom: 16px;">Nova mensagem enviada pela página Sobre</h1>
          <p><strong>Nome:</strong> ${escapeHtml(parsed.name)}</p>
          <p><strong>E-mail:</strong> ${escapeHtml(parsed.email)}</p>
          <p><strong>Recebido em:</strong> ${escapeHtml(submittedAt)}</p>
          <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="white-space: pre-wrap;">${escapeHtml(parsed.message)}</p>
        </div>
      `,
    });

    revalidatePath("/sobre");

    return {
      success: true,
      message: "Mensagem enviada com sucesso. Obrigado pelo contato!",
    };
  } catch (error) {
    return {
      success: false,
      message: normalizeError(error, "Não foi possível enviar sua mensagem agora. Tente novamente em instantes."),
    };
  }
}
