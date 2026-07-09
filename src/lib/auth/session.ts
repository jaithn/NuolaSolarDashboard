import type { SessionOptions } from "iron-session";

export type Rolle = "ADMIN" | "MIETER";

export interface SessionData {
  userId?: string;
  role?: Rolle;
  mustChangePassword?: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt.`);
  }
  return value;
}

export const sessionOptions: SessionOptions = {
  password: requireEnv("SESSION_SECRET"),
  cookieName: "nuola_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};
