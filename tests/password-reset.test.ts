import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import {
  createPasswordResetToken,
  findValidPasswordResetToken,
  markPasswordResetTokenUsed,
} from "@/lib/auth/resetToken";

describe("Passwort-Reset-Flow", () => {
  let nutzerId: string;

  beforeAll(async () => {
    const nutzer = await prisma.nutzer.create({
      data: {
        username: `test-reset-${crypto.randomUUID()}`,
        passwordHash: "irrelevant-for-this-test",
        role: "ADMIN",
        mustChangePassword: false,
      },
    });
    nutzerId = nutzer.id;
  });

  afterAll(async () => {
    await prisma.nutzer.delete({ where: { id: nutzerId } });
    await prisma.$disconnect();
  });

  it("erzeugt einen gültigen Token mit ca. 1h Gültigkeit", async () => {
    const token = await createPasswordResetToken(nutzerId);
    const record = await findValidPasswordResetToken(token);
    expect(record).not.toBeNull();
    expect(record?.nutzerId).toBe(nutzerId);

    const ttlMs = record!.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(55 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("liefert null für einen unbekannten Token", async () => {
    const record = await findValidPasswordResetToken("does-not-exist");
    expect(record).toBeNull();
  });

  it("liefert null, nachdem ein Token als verwendet markiert wurde (Einmalnutzung)", async () => {
    const token = await createPasswordResetToken(nutzerId);
    const record = await findValidPasswordResetToken(token);
    expect(record).not.toBeNull();

    await markPasswordResetTokenUsed(record!.id);

    const afterUse = await findValidPasswordResetToken(token);
    expect(afterUse).toBeNull();
  });

  it("liefert null für einen abgelaufenen Token", async () => {
    const expired = await prisma.passwordResetToken.create({
      data: {
        nutzerId,
        token: `expired-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const record = await findValidPasswordResetToken(expired.token);
    expect(record).toBeNull();
  });
});
