import nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  html: string;
};

function getBaseUrl() {
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

export function buildAppUrl(path: string): string {
  return new URL(path, getBaseUrl()).toString();
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

async function sendWithSmtp(payload: MailPayload): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;

  if (!host || !user || !pass || !from) {
    return false;
  }

  const port = Number(portRaw ?? 587);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? parseBoolean(process.env.SMTP_SECURE)
      : port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  return true;
}

async function sendWithResend(payload: MailPayload): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!resendApiKey || !from) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar e-mail via Resend: ${response.status} ${body}`);
  }

  return true;
}

export async function sendEmail(payload: MailPayload) {
  if (await sendWithSmtp(payload)) {
    return;
  }

  if (await sendWithResend(payload)) {
    return;
  }

  console.info("[mail:fallback]", {
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
}
