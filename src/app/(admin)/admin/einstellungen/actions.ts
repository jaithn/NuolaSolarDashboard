"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";

export interface SettingsFormState {
  error?: string;
}

export async function updateFirmenStammdatenAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const anschrift = String(formData.get("anschrift") ?? "").trim();
  const steuernummer = String(formData.get("steuernummer") ?? "").trim();
  const ustIdNr = String(formData.get("ustIdNr") ?? "").trim();
  const bankverbindung = String(formData.get("bankverbindung") ?? "").trim();

  if (!name || !anschrift) return { error: "Bitte Name und Anschrift angeben." };

  await prisma.firmenStammdaten.upsert({
    where: { id: "singleton" },
    update: {
      name,
      anschrift,
      steuernummer: steuernummer || null,
      ustIdNr: ustIdNr || null,
      bankverbindung: bankverbindung || null,
    },
    create: {
      id: "singleton",
      name,
      anschrift,
      steuernummer: steuernummer || null,
      ustIdNr: ustIdNr || null,
      bankverbindung: bankverbindung || null,
    },
  });

  revalidatePath("/admin/einstellungen");
  return {};
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

export async function updateDesignvorlageAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const primaerfarbe = String(formData.get("primaerfarbe") ?? "#0f766e");
  const sekundaerfarbe = String(formData.get("sekundaerfarbe") ?? "#0f172a");
  const fusszeileText = String(formData.get("fusszeileText") ?? "").trim();
  const logo = formData.get("logo");

  let logoPfad: string | undefined;
  if (logo instanceof File && logo.size > 0) {
    if (!ALLOWED_LOGO_TYPES.has(logo.type)) {
      return { error: "Logo muss PNG, JPEG oder SVG sein." };
    }
    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = logo.type === "image/svg+xml" ? "svg" : logo.type === "image/png" ? "png" : "jpg";
    const filename = `logo-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await logo.arrayBuffer());
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
