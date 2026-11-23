// The original member cards share a board with the public web membership flows.
// New writes use only the server's browser-owner cookie.
let community={me:null,items:[],attendance:[]};
let loaded=false, pending=false, message="";
let matchMember=P[0].id, groupTopic="hobby";
const views=["board","plaza","discover","match","groups","me"];
function bindAll(selector,fn){ document.querySelectorAll(selector).forEach(button=>button.addEventListener("click",()=>fn(button))); }
function entryLink(){return '<a class="public-add" href="/members?edit">내 프로필 만들기 · 말로 작성</a>'; }
function ownControls(item){return community.me?.id===item.author?'<button class="ghost" data-remove="'+esc(item.id)+'">내 글 삭제</button>':"";}
function feedback(){return '<p role="status" id="community-status" class="pub-note">'+esc(message)+'</p>';}
async function loadCommunity(){
  const r=await fetch("/api/club",{cache:"no-store"});
  if(!r.ok)throw new Error("멤버 활동을 불러오지 못했어요. 새로고침해 주세요.");
  community=await r.json();loaded=true;
}
async function act(action,values){
  if(pending)return;
  if(!community.me){location.assign("/members?edit");return;}
  pending=true;
  try{
    const r=await fetch("/api/club",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...values})});
    if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"저장하지 못했어요.");}
    await loadCommunity();message="저장했어요.";render();
  }catch(e){message=e.message;const el=$("#community-status");if(el)el.textContent=message;}
  finally{pending=false;}
}
function renderPlaza(){
  const posts=community.items.filter(i=>i.kind==="post"),el=$("#v-plaza");
  el.innerHTML='<h3 class="sec">광장 · 모두에게 한마디</h3><div class="notice">이 링크를 방문하는 누구나 글을 볼 수 있어요.</div>'+feedback()+
    (community.me?'<form id="plaza-form"><div class="chips2">'+TOPIC.map(t=>'<button type="button" data-topic="'+esc(t)+'">'+esc(t)+'</button>').join("")+'</div><textarea required maxlength="300" class="inp" id="post-text" placeholder="무슨 이야기를 나누고 싶나요?" aria-label="광장 글"></textarea><button class="cta">광장에 올리기</button></form>':entryLink())+
    '<h3 class="sec">올라온 글 · '+posts.length+'개</h3>'+posts.map(i=>'<div class="post"><div><b>'+esc(i.name)+'</b><p>'+esc(i.detail)+'</p>'+ownControls(i)+'</div></div>').join("")+
    (posts.length?"":'<div class="notice">'+(loaded?"아직 올라온 글이 없어요.":"광장을 불러오는 중이에요.")+'</div>');
  bindAll("[data-topic]",b=>{const f=$("#post-text");f.value=b.dataset.topic+" · ";f.focus();});
  const form=$("#plaza-form");if(form)form.onsubmit=e=>{e.preventDefault();act("post",{detail:$("#post-text").value});};
}
function renderGroups(){
  const originals=SAMPLE.map(g=>({id:g.id,title:g.t,detail:g.d,topic:g.mode,name:byId(g.by).name,original:true,tags:g.tags}));
  const list=[...community.items.filter(i=>i.kind==="group"),...originals].filter(g=>S.mode==="all"||g.topic===S.mode);
  $("#v-groups").innerHTML='<h3 class="sec">모임 제안 · '+list.length+'개</h3>'+feedback()+list.map(g=>{
    const people=community.attendance.filter(a=>a.groupId===g.id);
    const joined=!!community.me && people.some(a=>a.id===community.me.id);
    const fits=(g.tags||[]).length?P.filter(p=>p.id!==101 && [...p.hobbies,...p.likes].some(t=>g.tags.includes(t))):[];
    return '<div class="group"><div class="gt"><b>'+esc(g.title)+'</b><span class="pill">'+people.length+'명 참여</span></div><p>'+esc(g.detail)+'</p><p>'+esc(g.name)+' · '+(g.topic==="biz"?"사업":"취미 · 여행")+(g.original?" · 원본 예시 제안":"")+'</p>'+(fits.length?'<p>관심 있을 사람 · AI 추정 · '+fits.map(p=>esc(p.name)).join(", ")+'</p>':'')+(people.length?'<p>참여 · '+people.map(p=>esc(p.name)).join(", ")+'</p>':'')+'<button class="join" data-group="'+esc(g.id)+'" data-joined="'+joined+'">'+(joined?"참여 취소":"참여하기")+'</button>'+ownControls(g)+'</div>';
  }).join("")+'<h3 class="sec">새 모임 제안하기</h3>'+(community.me?'<form id="new-group"><select id="group-type" class="inp" aria-label="모임 분야"><option value="hobby">취미 · 여행</option><option value="biz">사업</option></select><input required class="inp" maxlength="60" id="group-title" placeholder="모임 이름" aria-label="모임 이름"><textarea class="inp" maxlength="300" id="group-detail" placeholder="언제 · 어디서 · 무엇을" aria-label="모임 소개"></textarea><button class="cta">제안 올리기</button></form>':entryLink());
  bindAll("[data-group]",b=>act(b.dataset.joined==="true"?"leave":"join",{id:b.dataset.group}));
  const form=$("#new-group");if(form){$("#group-type").value=S.mode==="all"?groupTopic:S.mode;form.onsubmit=e=>{e.preventDefault();groupTopic=$("#group-type").value;act("group",{topic:groupTopic,title:$("#group-title").value,detail:$("#group-detail").value});};}
}
function renderMatch(){
  const p=byId(matchMember),bf=bestFor(p.id);
  const rows=[bf.twin,bf.fit,...bf.rest];
  $("#v-match").innerHTML='<h3 class="sec">멤버별 찰떡 짝</h3><p class="notice">기준이 될 멤버를 골라 추천 근거를 보세요. 모임 기록을 바탕으로 한 AI 추정이에요.</p><div class="chips2">'+P.map(m=>'<button data-base="'+m.id+'" aria-pressed="'+(m.id===p.id)+'">'+esc(m.name)+'</button>').join("")+'</div><h3 class="sec">'+esc(p.name)+'님과의 연결점</h3>'+rows.map(x=>'<button class="pair" data-p="'+x.p.id+'">'+av(x.p)+'<div class="pt"><b>'+esc(x.p.name)+'</b><small>'+esc(x.why.join(" · "))+'</small></div><span class="pc">'+x.pt+'점</span></button>').join("");
  bindAll("[data-base]",b=>{matchMember=Number(b.dataset.base);renderMatch();});bindAll("#v-match [data-p]",b=>openPerson(Number(b.dataset.p)));
}
function render(){
  if(S.tab==="me"){location.assign("/members?edit");return;}
  $("#app").dataset.mode=S.mode;
  document.querySelectorAll(".modes button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===S.mode)));
  document.querySelectorAll("nav button").forEach(b=>b.setAttribute("aria-current",String(b.dataset.tab===S.tab)));
  document.querySelectorAll(".view").forEach(v=>v.hidden=v.id!=="v-"+S.tab);
  $("#actions").hidden=true;["#n-match","#n-me","#n-plaza"].forEach(id=>$(id).hidden=true);
  $("#who").innerHTML='<a href="/members" class="public-add">웹 멤버</a>';
  ({board:renderBoard,plaza:renderPlaza,discover:renderDiscover,match:renderMatch,groups:renderGroups})[S.tab]();
  bindAll(".view:not([hidden]) [data-remove]",b=>{if(confirm("직접 올린 글을 삭제할까요?"))act("remove",{id:b.dataset.remove});});
}
const hash=location.hash.slice(1);S.tab=views.includes(hash)?hash:"board";
bindAll(".modes button",b=>{S.mode=b.dataset.mode;$("#main").scrollTop=0;render();});
bindAll("nav button",b=>{if(b.dataset.tab==="me"){location.assign("/members?edit");return;}S.tab=b.dataset.tab;history.replaceState(null,"","#"+S.tab);$("#main").scrollTop=0;message="";render();});
WIDE.addEventListener("change",()=>render());
$("#btn-yes").onclick=()=>location.assign("/members");
$("#btn-no").onclick=()=>move(1);
render();loadCommunity().then(()=>{if(["groups","plaza"].includes(S.tab))render();}).catch(e=>{message=e.message;if(["groups","plaza"].includes(S.tab))render();});
