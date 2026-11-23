import { env } from "cloudflare:workers";
import { json, sameSite, owner, token } from "../../../lib/profile-session";

async function member(req: Request) {
  const key=token(req);
  return key ? env.DB!.prepare("SELECT id,name FROM profiles WHERE owner=?").bind(await owner(key)).first<{id:string,name:string}>() : null;
}
export async function GET(req: Request) {
  const me=await member(req);
  const db=env.DB!;
  const [items,attending]=await db.batch([
    db.prepare("SELECT c.id,c.kind,c.topic,c.title,c.detail,c.created,p.id AS author,p.name FROM club_items c JOIN profiles p ON p.id=c.author ORDER BY c.created DESC LIMIT 500"),
    db.prepare("SELECT a.group_id AS groupId,p.name,p.id FROM attendance a JOIN profiles p ON a.member=p.id WHERE a.group_id IN ('s1','s2','s3','s4','s5','s6','s7','s8') OR EXISTS (SELECT 1 FROM club_items WHERE id=a.group_id AND kind='group')"),
  ]);
  return json({me,items:items.results,attendance:attending.results});
}
export async function POST(req: Request) {
  if (!sameSite(req))return json({},403);
  const me=await member(req);
  if(!me)return json({error:"먼저 내 프로필을 작성해 주세요."},401);
  if (!req.headers.get("content-type")?.startsWith("application/json"))return json({},415);
  const d=await req.json().catch(()=>null) as Record<string,unknown>|null;
  const str=(key:string)=>typeof d?.[key]==="string" ? (d[key] as string).trim() : "";
  const action=str("action"), id=str("id");
  const db=env.DB!;
  if(action==="post" || action==="group"){
    const detail=str("detail"),title=str("title"),topic=str("topic");
    if(detail.length>300 || title.length>60 || (action==="post"?!detail:!title) || (action==="group"&&!["biz","hobby"].includes(topic)))return json({error:"내용과 길이를 확인해 주세요."},400);
    await db.prepare("INSERT INTO club_items(id,author,kind,topic,title,detail,created) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),me.id,action,topic,title,detail,Date.now()).run();
  }else if(action==="remove"){
    await db.batch([db.prepare("DELETE FROM attendance WHERE group_id=? AND EXISTS(SELECT 1 FROM club_items WHERE id=? AND author=?)").bind(id,id,me.id),db.prepare("DELETE FROM club_items WHERE id=? AND author=?").bind(id,me.id)]);
  }else if(action==="join" || action==="leave"){
    if(action==="leave")await db.prepare("DELETE FROM attendance WHERE member=? AND group_id=?").bind(me.id,id).run();
    else {
      const result=await db.prepare("INSERT OR IGNORE INTO attendance(id,member,group_id) SELECT ?,?,? WHERE ? IN ('s1','s2','s3','s4','s5','s6','s7','s8') OR EXISTS(SELECT 1 FROM club_items WHERE id=? AND kind='group')").bind(me.id+"/"+id,me.id,id,id,id).run();
      if(!result.success)return json({},400);
    }
  }else return json({},400);
  return json({saved:true});
}
