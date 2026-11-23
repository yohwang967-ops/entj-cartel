import { env } from "cloudflare:workers";

import { cookie, hex, token, owner, json, sameSite } from "../../../lib/profile-session";
const fields = "id, name, topic, intro, updated";
export async function GET(req: Request) {
  const db = env.DB!;
  const url = new URL(req.url);
  const after = url.searchParams.get("after") || "";
  const filter = url.searchParams.get("topic") || "";
  const key = token(req);
  const mine = key ? await db.prepare("SELECT " + fields + " FROM profiles WHERE owner=?").bind(await owner(key)).first() : null;
  const result = await db.prepare("SELECT " + fields + " FROM profiles WHERE id>? AND (?='' OR topic=?) ORDER BY id LIMIT 25").bind(after, filter, filter).all();
  const page = result.results.slice(0, 24);
  return json({ mine, profiles: page, next: result.results.length > 24 ? page[23].id : null });
}
export async function POST(req: Request) {
  if (!sameSite(req)) return json({}, 403);
  // Establish ownership before the form can submit, including on retries.
  if (new URL(req.url).searchParams.has("session")) {
    if (token(req)) return json({ready:true});
    const key = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
    return json({ready:true}, 200, {"Set-Cookie": cookie+"="+key+"; Secure; HttpOnly; Path=/; Max-Age=31536000; SameSite=Lax"});
  }
  const key = token(req);
  if (!key) return json({error:"브라우저에서 쿠키를 허용한 뒤 새로고침해 주세요."}, 401);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return json({}, 415);
  if (Number(req.headers.get("content-length")) > 8192) return json({}, 413);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const topic = typeof body?.topic === "string" ? body.topic : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const intro = typeof body?.intro === "string" ? body.intro.trim() : "";
  if (!name || name.length > 24 || !intro || intro.length > 500 || !["일과 도전","취미 · 여행","사업"].includes(topic)) return json({error:"닉네임, 관심 분야, 자기소개를 확인해 주세요."}, 400);
  // Reverse timestamp prefix supports newest-first discovery with a stable keyset cursor.
  const now = Date.now();
  const id = (9999999999999-now).toString().padStart(13,"0")+"-"+crypto.randomUUID();
  await env.DB!.prepare("INSERT INTO profiles (id, owner, name, topic, intro, updated) VALUES (?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET name=excluded.name,topic=excluded.topic,intro=excluded.intro,updated=excluded.updated").bind(id,await owner(key),name,topic,intro,now).run();
  return json({saved:true});
}
export async function DELETE(req: Request) {
  if (!sameSite(req)) return json({}, 403);
  const key = token(req);
  if (!key) return json({}, 401);
  await env.DB!.prepare("DELETE FROM profiles WHERE owner=?").bind(await owner(key)).run();
  return json({deleted:true});
}
