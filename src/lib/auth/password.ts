import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Erzeugt ein zufälliges, ausreichend starkes Einmal-Passwort für den Versand per E-Mail. */
export function generateOneTimePassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}
