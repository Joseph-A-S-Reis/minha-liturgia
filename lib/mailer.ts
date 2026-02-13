import nodemailer from "nodemailer";
import { buildAbsoluteAppUrl } from "@/lib/app-url";

type MailPayload = {
  to: string;
  subject: string;
  html: string;
};

const envName = {
  authUrl: ["AUTH", "URL"],
  nextAuthUrl: ["NEXTAUTH", "URL"],
  smtpHost: ["SMTP", "HOST"],
  smtpPort: ["SMTP", "PORT"],
  smtpUser: ["SMTP", "USER"],
  smtpPass: ["SMTP", "PASS"],
  smtpSecure: ["SMTP", "SECURE"],
  emailFrom: ["EMAIL", "FROM"],
  resendApiKey: ["RESEND", "API", "KEY"],
} as const;

function readEnv(parts: readonly string[]): string | undefined {
  const key = parts.join("_");
  return process.env[key];
}

export function buildAppUrl(path: string): string {
  return buildAbsoluteAppUrl(path);
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

async function sendWithSmtp(payload: MailPayload): Promise<boolean> {
  const host = readEnv(envName.smtpHost);
  const portRaw = readEnv(envName.smtpPort);
  const user = readEnv(envName.smtpUser);
  const pass = readEnv(envName.smtpPass);
  const from = readEnv(envName.emailFrom);

  if (!host || !user || !pass || !from) {
    return false;
  }

  const port = Number(portRaw ?? 587);
  const secure =
    readEnv(envName.smtpSecure) !== undefined
      ? parseBoolean(readEnv(envName.smtpSecure))
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
  const resendApiKey = readEnv(envName.resendApiKey);
  const from = readEnv(envName.emailFrom);

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
