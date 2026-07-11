"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendTestMail } from "@/lib/mail/mailer";

export interface SettingsFormState {
  error?: string;
}

export interface TestMailState {
  error?: string;
  success?: string;
}

export async function sendTestMailAction(
  _prevState: TestMailState,
  formData: FormData,
): Promise<TestMailState> {
  await requireAdmin();

  const to = String(formData.get("to") ?? "").trim();
  if (!z.string().email().max(254).safeParse(to).success) {
    return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  }

  const result = await sendTestMail(to);
  if (!result.ok) {
    return { error: `SMTP-Fehler: ${result.error}` };
  }
  return { success: `Test-E-Mail wurde an ${to} verschickt. Bitte auch den Spam-Ordner prüfen.` };
}

export async function updateFirmenStammdatenAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const anschrift = String(formData.get("anschrift") ?? "").trim();
  const plz = String(formData.get("plz") ?? "").trim();
  const ort = String(formData.get("ort") ?? "").trim();
  const steuernummer = String(formData.get("steuernummer") ?? "").trim();
  const ustIdNr = String(formData.get("ustIdNr") ?? "").trim();
  const bankname = String(formData.get("bankname") ?? "").trim();
  const bankverbindung = String(formData.get("bankverbindung") ?? "").trim();
  const shellyFehlerEmail = String(formData.get("shellyFehlerEmail") ?? "").trim();

  if (!name || !anschrift) return { error: "Bitte Name und Anschrift angeben." };
  if (shellyFehlerEmail && !z.string().email().max(254).safeParse(shellyFehlerEmail).success) {
    return { error: "Die Fehler-Benachrichtigungs-E-Mail ist ungültig." };
  }

  const data = {
    name,
    anschrift,
    plz,
    ort,
    steuernummer: steuernummer || null,
    ustIdNr: ustIdNr || null,
    bankname: bankname || null,
    bankverbindung: bankverbindung || null,
    shellyFehlerEmail: shellyFehlerEmail || null,
  };
  await prisma.firmenStammdaten.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath("/admin/einstellungen");
  return {};
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Bewusst KEIN SVG: SVG-Dateien koennen eingebettetes JavaScript enthalten und
// wuerden unter /uploads same-origin ausgeliefert (Stored XSS). Zudem kann
// @react-pdf/renderer SVG-Dateien in <Image> ohnehin nicht rendern.
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Prueft die Magic Bytes, damit der (client-kontrollierte) MIME-Typ nicht allein entscheidet. */
function hasValidImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/jpeg") {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

export async function updateDesignvorlageAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const primaerfarbe = String(formData.get("primaerfarbe") ?? "#d9a441");
  const sekundaerfarbe = String(formData.get("sekundaerfarbe") ?? "#1c1c21");
  const fusszeileText = String(formData.get("fusszeileText") ?? "").trim();
  const logo = formData.get("logo");

  if (!HEX_COLOR.test(primaerfarbe) || !HEX_COLOR.test(sekundaerfarbe)) {
    return { error: "Farben müssen im Format #rrggbb angegeben werden." };
  }

  let logoPfad: string | undefined;
  if (logo instanceof File && logo.size > 0) {
    const ext = ALLOWED_LOGO_TYPES[logo.type];
    if (!ext) {
      return { error: "Logo muss PNG oder JPEG sein." };
    }
    if (logo.size > MAX_LOGO_BYTES) {
      return { error: "Logo darf höchstens 2 MB groß sein." };
    }
    const buffer = Buffer.from(await logo.arrayBuffer());
    if (!hasValidImageMagicBytes(buffer, logo.type)) {
      return { error: "Die Datei ist keine gültige PNG-/JPEG-Bilddatei." };
    }
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `logo-${Date.now()}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);
    logoPfad = `/uploads/${filename}`;
  }

  const existing = await prisma.rechnungsDesignvorlage.findUnique({ where: { id: "singleton" } });

  await prisma.rechnungsDesignvorlage.upsert({
    where: { id: "singleton" },
    update: {
      primaerfarbe,
      sekundaerfarbe,
      fusszeileText: fusszeileText || null,
      ...(logoPfad ? { logoPfad } : {}),
    },
    create: {
      id: "singleton",
      primaerfarbe,
      sekundaerfarbe,
      fusszeileText: fusszeileText || null,
      logoPfad: logoPfad ?? existing?.logoPfad,
    },
  });

  revalidatePath("/admin/einstellungen");
  return {};
}
