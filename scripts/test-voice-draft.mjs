import assert from "node:assert/strict";
import test from "node:test";
import {MAX_VOICE_BYTES, MAX_VOICE_SECONDS, profileFromSpeech, speechSamples, voiceFileProblem} from "../app/voice-draft.ts";

test("file chooser accepts named common audio files including missing browser MIME",()=>{
  for(const name of ["voice.M4A","intro.mp3","clip.webm","voice.wav"])assert.equal(voiceFileProblem({name,type:"",size:1}),"");
  assert.equal(voiceFileProblem({name:"blob",type:"audio/mpeg",size:MAX_VOICE_BYTES}),"");
});
test("rejects empty, oversized and unrelated files",()=>{
  assert.match(voiceFileProblem({name:"voice.wav",type:"audio/wav",size:0}),/빈 파일/);
  assert.match(voiceFileProblem({name:"voice.wav",type:"audio/wav",size:MAX_VOICE_BYTES+1}),/20MB/);
  assert.match(voiceFileProblem({name:"cover.png",type:"image/png",size:1}),/음성 파일/);
});
test("draft uses spoken text and omits a contact line",()=>{
  const result=profileFromSpeech("제 닉네임은 테스트예요. 러닝을 좋아해요. 함께 달리고 싶어요. 메일은 test@example.com 입니다.");
  assert.deepEqual(result,{name:"테스트",intro:"러닝을 좋아해요. 함께 달리고 싶어요.",topic:"취미 · 여행"});
  assert.equal(profileFromSpeech("사업을 시작했어요. 창업 팀을 운영해요.").name,"");
});
test("duration capped before a large resampling buffer is allocated",async()=>{
  globalThis.AudioContext=class {async decodeAudioData(){return {duration:MAX_VOICE_SECONDS+1}} async close(){}};
  globalThis.OfflineAudioContext=class {constructor(){throw new Error("must not allocate")}};
  try{await assert.rejects(speechSamples(new Blob(["synthetic"])),/3분 이하/);}
  finally{delete globalThis.AudioContext;delete globalThis.OfflineAudioContext;}
});
