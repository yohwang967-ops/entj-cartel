"use client";
import {useEffect, useRef, useState} from "react";
import {MAX_VOICE_SECONDS, profileFromSpeech, speechSamples, voiceFileProblem} from "./voice-draft";
import {Mic, Square, Download, Trash2, FolderOpen} from "lucide-react";

function recordingStore(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<Blob|undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("cartel-voice-notebook", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("memo");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("memo", mode);
      const query = action(tx.objectStore("memo"));
      tx.oncomplete = () => { db.close(); resolve(query.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}
export default function Recorder({active,onApply}:{active:boolean;onApply:(draft:ReturnType<typeof profileFromSpeech>)=>void}) {
  const [clip,setClip]=useState<Blob>();
  const [url,setUrl]=useState("");
  const [state,setState]=useState<"idle"|"asking"|"recording"|"saving">("idle");
  const [time,setTime]=useState(0);
  const [message,setMessage]=useState("");
  const [working,setWorking]=useState(false);
  const [transcript,setTranscript]=useState<string|null>(null);
  const worker=useRef<Worker|null>(null);
  const operation=useRef(0);
  const editedDraft=profileFromSpeech(transcript||"");
  const fileInput=useRef<HTMLInputElement>(null);
  const recorder=useRef<MediaRecorder|null>(null);
  const alive=useRef(false);
  const visible=useRef(active);
  useEffect(()=>{
    visible.current=active;
    if(!active && recorder.current?.state==="recording")recorder.current.stop();
  },[active]);
  useEffect(()=>{
    alive.current=true;
    recordingStore("readonly",s=>s.get("current")).then(b=>{if(alive.current)setClip(b)}).catch(()=>{});
    return ()=>{alive.current=false;operation.current++;worker.current?.terminate();const r=recorder.current;if(r?.state==="recording") r.stop();r?.stream.getTracks().forEach(t=>t.stop());};
  },[]);
  useEffect(()=>{if(!clip){setUrl("");return;}const link=URL.createObjectURL(clip);setUrl(link);return ()=>URL.revokeObjectURL(link);},[clip]);
  useEffect(()=>{if(state!=="recording")return;const start=Date.now();
    const timer=setInterval(()=>{const sec=Math.floor((Date.now()-start)/1000);setTime(sec);if(sec>=MAX_VOICE_SECONDS && recorder.current?.state==="recording") recorder.current.stop();},250);
    return ()=>clearInterval(timer);
  },[state]);
  function cancelRecognition(){
    operation.current++;worker.current?.terminate();worker.current=null;
    setWorking(false);setMessage("받아쓰기를 중지했어요. 녹음이나 파일로 다시 시도할 수 있어요.");
  }
  async function transcribe(blob:Blob, imported=false){
    const id=++operation.current;
    worker.current?.terminate();
    setWorking(true);setMessage(imported?"음성 파일을 읽고 있어요.":"녹음을 읽고 있어요.");
    try{
      const samples=await speechSamples(blob);
      if(operation.current!==id || !alive.current)return;
      const task=new Worker("/speech/recognize.js",{type:"module"});
      worker.current=task;
      function finish(){
        task.terminate();worker.current=null;setWorking(false);
      }
      task.onmessage=({data})=>{
        if(operation.current!==id)return;
        if(data.status==="done"){
          setTranscript(data.text);setMessage("초안을 만들었어요. 이름과 내용을 확인해 주세요.");finish();
        }else if(data.status==="error"){setMessage(data.message);finish();}
        else setMessage(data.message);
      };
      task.onerror=()=>{if(operation.current===id){finish();setMessage("받아쓰기 도구를 열지 못했어요. 브라우저를 업데이트한 뒤 다시 시도해 주세요.");}};
      task.postMessage(samples,[samples.buffer]);
    }catch(e){if(operation.current===id && alive.current){setWorking(false);setMessage(e instanceof RangeError || (e instanceof Error && e.message.startsWith("목소리"))?e.message:imported?"이 음성 파일을 읽지 못했어요. M4A, MP3 또는 WAV로 다시 시도해 주세요.":"녹음을 읽지 못했어요. 다시 녹음해 주세요.");}}
  }
  function importFile(file:File|undefined){
    if(!file || state!=="idle" || working)return;
    const problem=voiceFileProblem(file);
    if(problem){setMessage(problem);return;}
    setTranscript(null);
    // Imported files are processed in memory only. Keep any existing voice memo intact.
    void transcribe(file,true);
  }
  async function start(){
    setMessage("");setState("asking");
    let stream:MediaStream|undefined;
    try{
      if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)throw new Error("Safari 또는 Chrome에서 링크를 열어 녹음해 주세요.");
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!alive.current || !visible.current){stream.getTracks().forEach(t=>t.stop());if(alive.current)setState("idle");return;}
      const mime=["audio/webm;codecs=opus","audio/mp4","audio/webm"].find(t=>MediaRecorder.isTypeSupported(t));
      const rec=new MediaRecorder(stream,mime?{mimeType:mime}:{});recorder.current=rec;
      const parts:BlobPart[]=[];
      rec.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};
      rec.onstop=async ()=>{
        rec.stream.getTracks().forEach(t=>t.stop());
        const blob=new Blob(parts,{type:rec.mimeType || mime || "audio/webm"});
        if(!blob.size){if(alive.current){setState("idle");setMessage("녹음된 소리가 없어요. 다시 시도해 주세요.");}return;}
        if(alive.current){setState("saving");setClip(blob);}
        try{await recordingStore("readwrite",s=>s.put(blob,"current"));if(alive.current)setMessage("이 브라우저에 녹음을 저장했어요.");}
        catch{if(alive.current)setMessage("기기에 저장할 공간이 부족해요. 파일로 내려받아 주세요.");}
        if(alive.current){setState("idle");if(visible.current)void transcribe(blob);}
      };
      rec.start(500);setTime(0);setState("recording");
    }catch(e){stream?.getTracks().forEach(t=>t.stop());if(alive.current){setState("idle");setMessage(e instanceof DOMException?"마이크를 사용할 수 없어요. 브라우저의 마이크 권한을 확인해 주세요.":(e as Error).message);}}
  }
  async function erase(){
    try{await recordingStore("readwrite",s=>s.delete("current"));setClip(undefined);setTranscript(null);setMessage("녹음을 삭제했어요.");}catch{setMessage("삭제하지 못했어요. 다시 시도해 주세요.");}
  }
  return <section className="memo"><h3><Mic size={19}/> 말로 프로필 만들기</h3><p>직접 녹음하거나 이미 녹음한 파일을 선택하세요. 이 기기에서 한국어로 받아쓰고, 말한 내용에서 소개 초안을 뽑아요. 첫 사용에는 약 80MB의 받아쓰기 모델을 내려받아요.</p>
    <details><summary>말할 거리 보기</summary><p>불리고 싶은 이름 · 나이 · 동네 · 하는 일 · 취미 · 연애 상태 · 관심 있는 사업 제안 · 최근 도전이나 재미있었던 일. 편한 항목만 골라 이야기해 주세요.</p></details>
    {url && <><audio controls src={url} aria-label="내 음성 메모 다시 듣기"/><div className="actions"><a href={url} download={"내-음성-메모."+(clip?.type.includes("mp4")?"m4a":"webm")}><Download size={15}/> 파일 저장</a><button type="button" disabled={state!=="idle"||working} onClick={erase}><Trash2 size={15}/> 메모 삭제</button></div></>}
    {state==="recording"?<button className="rec on" type="button" onClick={()=>{if(recorder.current?.state==="recording")recorder.current.stop();}}><Square size={15}/> 녹음 마치기 · {Math.floor(time/60)}분 {time%60}초</button>:<button className="rec" type="button" onClick={start} disabled={state!=="idle" || !!clip || working}><Mic size={16}/>{state==="asking"?"마이크 연결 중…":state==="saving"?"녹음 저장 중…":clip?"새로 녹음하려면 메모를 삭제해 주세요":"녹음 시작"}</button>}
    <div className="actions">
      <input ref={fileInput} type="file" hidden accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.opus,.aac,.mp4,.flac"
        onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";importFile(file);}}/>
      <button type="button" className="rec" disabled={state!=="idle"||working} onClick={()=>fileInput.current?.click()}>
        <FolderOpen size={16}/> 기존 녹음 파일 선택
      </button>
      {clip && transcript===null && state==="idle" && !working && <button type="button" className="rec" onClick={()=>transcribe(clip)}>저장한 녹음에서 초안 만들기</button>}
      {working && <button type="button" className="rec" onClick={cancelRecognition}>받아쓰기 중지</button>}
      {!working && state==="idle" && transcript===null && <button type="button" className="rec"
        onClick={()=>{setMessage("");setTranscript("");}}>받아쓴 글 직접 넣기</button>}
    </div>
    <small>3분 · 20MB 이하, 본인 소개가 담긴 파일만 골라 주세요. 원본 음성은 서버에 보내지 않아요.</small>
    {message&&<small role="status">{message}</small>}
    {transcript!==null && <div className="voice-review">
      <label>받아쓴 글<textarea rows={4} maxLength={12000} value={transcript} onChange={e=>setTranscript(e.target.value)}/></label>
      <small>잘못 들은 단어를 고치면 아래 초안에 반영돼요.</small>
      <h4>공개 전 프로필 초안</h4>
      <p><b>{editedDraft.name||"닉네임을 입력해 주세요"}</b> · {editedDraft.topic}</p>
      <p className="voice-intro">{editedDraft.intro||"자기소개에 쓸 내용을 추가해 주세요."}</p>
      <button className="rec" type="button" disabled={working||(!editedDraft.name&&!editedDraft.intro)} onClick={()=>onApply(editedDraft)}>초안을 프로필 입력란에 적용</button>
    </div>}
  </section>;
}
