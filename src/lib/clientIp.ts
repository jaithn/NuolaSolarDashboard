import "server-only";
import { headers } from "next/headers";

/**
 * Client-IP hinter dem vorgelagerten nginx. Setzt voraus, dass nginx
 * `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (oder
 * X-Real-IP) setzt und der App-Port NICHT direkt aus dem Internet erreichbar
 * ist - sonst koennte ein Angreifer den Header selbst waehlen.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}
