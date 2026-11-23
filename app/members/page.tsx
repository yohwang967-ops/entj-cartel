"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Compass, PencilLine, Radio, UsersRound } from "lucide-react";
import Recorder from "../recorder";

type Profile = { id:string; name:string; topic:string; intro:string; updated:number };
type Directory = { mine:Profile|null; profiles:Profile[]; next:string|null };
const topics=["일과 도전","취미 · 여행","사업"];
const blank={ name:"",topic:topics[0],intro:"" };
const api="/api/profiles";
async function data<T = unknown>(response:Response): Promise<T> {
  if(response.ok) return response.json() as Promise<T>;
  const message=await response.json().catch(()=>null) as {error?:string}|null;
  throw new Error(message?.error || "연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
}
export default function Home(){
  const [view,setView]=useState("discover");
  const [filter,setFilter]=useState("");
  const [records,setRecords]=useState<Profile[]>([]);
  const [mine,setMine]=useState<Profile|null>(null);
  const [draft,setDraft]=useState(blank);
  const [next,setNext]=useState<string|null>(null);
  const [status,setStatus]=useState("");
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [remove,setRemove]=useState(false);
  const [reload,refresh]=useState(0);
  const init=useRef(false);
  const current=useRef(0);
  const session=useRef<Promise<unknown>|null>(null);
  useEffect(()=>{if(new URLSearchParams(location.search).has("edit"))setView("edit");},[]);
  useEffect(()=>{
    const seq=++current.current;
    setLoading(true);setRecords([]);setNext(null);
    async function load(){
      const d=await data<Directory>(await fetch(api+"?topic="+encodeURIComponent(filter),{cache:"no-store"}));
      if(seq!==current.current)return;
      setRecords(d.profiles);setNext(d.next);setMine(d.mine);
      if(!init.current){if(d.mine)setDraft(d.mine);init.current=true;}
      setReady(true);
    }
    load().catch(e=>{if(seq===current.current){setReady(false);setStatus(e.message);}}).finally(()=>{if(seq===current.current)setLoading(false);});
    return ()=>{current.current++;};
  },[filter,reload]);
  async function more(){
    const seq=current.current;setLoading(true);
    try{
      const d=await data<Directory>(await fetch(api+"?topic="+encodeURIComponent(filter)+"&after="+encodeURIComponent(next||""),{cache:"no-store"}));
      if(seq===current.current){setRecords(old=>[...old,...d.profiles]);setNext(d.next);}
    }catch(e){if(seq===current.current)setStatus((e as Error).message);}finally{if(seq===current.current)setLoading(false);}
  }
  function go(v:string){setView(v);setRemove(false);setStatus("");window.scrollTo({top:0});}
  async function save(deleting=false){
    setSaving(true);setStatus("");
    try{
      if(!session.current)session.current=fetch(api+"?session",{method:"POST"}).then(data).catch(e=>{session.current=null;throw e;});
      await session.current;
      await data(await fetch(api,{method:deleting?"DELETE":"POST",...(deleting?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)})}));
      if(deleting){setMine(null);setDraft(blank);}else{setMine({...draft,id:mine?.id||"",updated:Date.now()});}
      setFilter("");setRemove(false);setView("discover");refresh(n=>n+1);window.scrollTo({top:0});
      setStatus(deleting?"프로필을 삭제했어요.":"프로필을 공개했어요.");
    }catch(e){setStatus((e as Error).message);}finally{setSaving(false);}
  }
  return <div className="shell">
    <header><div className="wrap bar"><button className="wordmark" onClick={()=>location.assign("/club.html")} aria-label="ENTJ 카르텔 처음으로"><i aria-hidden="true">E</i> ENTJ <b>카르텔</b></button><span className="location"><Radio size={16}/> 대구</span></div></header>
    <main className="wrap">
      {view==="discover" && <>
        <section className="hero"><div className="heroText"><div className="edition">DAEGU / ENTJ CLUB</div><h1>ENTJ<br/>카르텔<span>.</span></h1><p>대구 ENTJ의 일과 도전, 취미를 만나는 곳.</p><button className="heroAction" onClick={()=>go("edit")}>{mine?"내 프로필 수정":"내 프로필 만들기"} <ArrowUpRight size={18}/></button></div><div className="poster" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><div className="orbit o3"/><div className="orb"/><div className="cross c1">+</div><div className="cross c2">+</div><div className="bigE">E</div><div className="posterFoot">35.87° N &nbsp; 128.60° E</div></div></section>
        <section className="directory"><div className="sectionHead"><h2>멤버 발견</h2><Compass size={24}/></div><div className="filters">{["",...topics].map(t=><button key={t} aria-pressed={t===filter} onClick={()=>{setStatus("");setFilter(t);}}>{t||"전체"}</button>)}</div>
          {records.length===0?<div className="empty"><UsersRound size={27}/><div><h3>{loading?"프로필을 불러오는 중이에요":!ready?"프로필을 불러오지 못했어요":filter?"이 분야의 첫 멤버가 되어보세요":"첫 번째 프로필을 기다려요"}</h3><p>{!loading&&(ready?"닉네임과 짧은 소개로 나를 알려주세요.":"연결 상태를 확인하고 다시 시도해 주세요.")}</p></div>{!loading&&<button onClick={()=>ready?go("edit"):refresh(n=>n+1)}>{ready?"프로필 작성":"다시 시도"} <ArrowUpRight size={15}/></button>}</div>:<div className="grid">{records.map(p=><article key={p.id}><span className="tag">{p.topic}</span><h3>{p.name}</h3><p>{p.intro}</p></article>)}</div>}
          {next&&<button className="more" disabled={loading} onClick={more}>더 보기 <ArrowDown size={15}/></button>}
        </section>
      </>}
      <div hidden={view!=="edit"} className="editor">
        <div className="edition">MEMBER PROFILE</div><h1>내 프로필<span>.</span></h1><p className="sub">다른 멤버에게 보여줄 이름과 이야기를 적어주세요.</p>
        <Recorder active={view==="edit"} onApply={voice=>{
          setDraft(current=>({name:voice.name||current.name,intro:voice.intro||current.intro,topic:voice.topic}));
          setStatus("초안을 입력란에 옮겼어요. 내용을 수정한 뒤 공개해 주세요.");
          requestAnimationFrame(()=>document.getElementById("profile-name")?.focus());
        }}/>
        <form onSubmit={e=>{e.preventDefault();save();}}>
          <label>닉네임<input id="profile-name" required maxLength={24} placeholder="어떻게 불러드릴까요?" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
          <fieldset><legend>관심 분야</legend><div className="filters">{topics.map(t=><button type="button" aria-pressed={draft.topic===t} key={t} onClick={()=>setDraft({...draft,topic:t})}>{t}</button>)}</div></fieldset>
          <label>자기소개<textarea required maxLength={500} rows={4} placeholder="요즘 하는 일이나 함께하고 싶은 활동을 소개해 주세요." value={draft.intro} onChange={e=>setDraft({...draft,intro:e.target.value})}/></label>
          <p className="note">닉네임, 관심 분야, 자기소개는 링크를 가진 누구나 볼 수 있어요. 프로필 수정과 삭제는 작성한 브라우저에서 가능해요. 쿠키를 지우면 수정 권한을 잃어요.</p>
          <button className="primary" disabled={saving||!ready}>{saving?"처리 중…":mine?"변경 사항 공개":"프로필 공개하기"} <ArrowUpRight size={17}/></button>
        </form>
        {!ready&&!loading&&<button onClick={()=>refresh(n=>n+1)}>연결 다시 시도</button>}
        {mine&&<div className="delete">{remove?<><p>공개 프로필을 삭제할까요?</p><button disabled={saving} onClick={()=>save(true)}>삭제하기</button><button onClick={()=>setRemove(false)}>취소</button></>:<button onClick={()=>setRemove(true)}>공개 프로필 삭제</button>}</div>}
      </div>
      {status&&<div className="status" role="status">{status}</div>}
    </main><nav aria-label="주 메뉴"><div><button aria-current={view==="discover"?"page":undefined} onClick={()=>go("discover")}><Compass size={20}/> 멤버 발견</button><button aria-current={view==="edit"?"page":undefined} onClick={()=>go("edit")}><PencilLine size={20}/> 내 프로필</button></div></nav>
  </div>;
}
