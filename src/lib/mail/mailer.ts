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

/**
 * Einfache Text-Alternative aus dem HTML erzeugen. Reine Text-Parts verbessern
 * die Zustellbarkeit deutlich (Spamfilter werten HTML-only-Mails ab) und sind
 * fuer Clients ohne HTML-Ansicht noetig.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  text?: string;
  attachments?: MailAttachment[];
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const transport = getTransport();
  const from = requireEnv("SMTP_FROM");
  // Reply-To optional separat; hilft, wenn SMTP_FROM eine noreply-Adresse ist.
  const replyTo = process.env.SMTP_REPLY_TO || undefined;
  await transport.sendMail({
    from,
    replyTo,
    to: options.to,
    subject: options.subject,
    html: options.html,
    // Multipart: echte Text-Alternative fuer bessere Zustellbarkeit.
    text: options.text ?? htmlToText(options.html),
    attachments: options.attachments,
  });
}

/**
 * Prueft die SMTP-Verbindung und Zugangsdaten (verify) und verschickt danach
 * eine Test-E-Mail. Gibt bei Fehler eine lesbare Meldung zurueck, damit der
 * Admin die SMTP-Konfiguration pruefen kann.
 */
export async function sendTestMail(to: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transport = getTransport();
    await transport.verify();
    await sendMail({
      to,
      subject: "Test-E-Mail – Nuola Energy Dashboard",
      html: `<div style="font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1c1c21;">
        <h2 style="color:#a2762b;">SMTP-Test erfolgreich</h2>
        <p>Diese Test-E-Mail wurde vom Nuola Energy Dashboard verschickt. Wenn Sie sie erhalten,
        sind Ihre SMTP-Zugangsdaten korrekt konfiguriert.</p>
      </div>`,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unbekannter SMTP-Fehler." };
  }
}
