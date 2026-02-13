import nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  html: string;
};

type EnvKey =
  | "AUTH_URL"
  | "NEXTAUTH_URL"
  | "SMTP_HOST"
  | "SMTP_PORT"
  | "SMTP_USER"
  | "SMTP_PASS"
  | "SMTP_SECURE"
  | "EMAIL_FROM"
  | "RESEND_API_KEY";

function readEnv(key: EnvKey): string | undefined {
  return process.env[key];
}

function getBaseUrl() {
  return readEnv("AUTH_URL") ?? readEnv("NEXTAUTH_URL") ?? "http://127.0.0.1:3000";
}

export function buildAppUrl(path: string): string {
  return new URL(path, getBaseUrl()).toString();
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

async function sendWithSmtp(payload: MailPayload): Promise<boolean> {
  const host = readEnv("SMTP_HOST");
  const portRaw = readEnv("SMTP_PORT");
  const user = readEnv("SMTP_USER");
  const pass = readEnv("SMTP_PASS");
  const from = readEnv("EMAIL_FROM");

  if (!host || !user || !pass || !from) {
    return false;
  }

  const port = Number(portRaw ?? 587);
  const secure =
    readEnv("SMTP_SECURE") !== undefined
      ? parseBoolean(readEnv("SMTP_SECURE"))
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
  const resendApiKey = readEnv("RESEND_API_KEY");
  const from = readEnv("EMAIL_FROM");

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
