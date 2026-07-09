import nodemailer from "nodemailer";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt.`);
  }
  return value;
}

function getTransport() {
  return nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASSWORD"),
    },
  });
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const transport = getTransport();
  await transport.sendMail({
    from: requireEnv("SMTP_FROM"),
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  });
}
