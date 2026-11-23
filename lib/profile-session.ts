export const cookie = "__Host-cartel-owner";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
export const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
export function token(req: Request) {
  return req.headers.get("cookie")?.match(/(?:^|;\s*)__Host-cartel-owner=([0-9a-f]{64})(?:;|$)/)?.[1];
}
export async function owner(key: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
}
export function json(value: unknown, status = 200, extra = {}) {
  return Response.json(value, { status, headers: { ...headers, ...extra } });
}
export function sameSite(req: Request) {
  return req.headers.get("origin") === new URL(req.url).origin;
}
