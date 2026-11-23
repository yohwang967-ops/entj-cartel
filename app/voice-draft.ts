export function profileFromSpeech(transcript: string) {
  const clean = transcript.replace(/\s+/g, " ").trim();
  const name = clean.match(/(?:제\s*(?:이름|닉네임)은|제\s*(?:이름|닉네임)이|닉네임은)\s*([가-힣a-zA-Z]{2,12}?)(?:입니다|이에요|예요)(?=[\s.,!?]|$)/)?.[1];
  const sentences=clean.split(/(?<=\.)\s+|(?<=[!?。])\s*|(?<=(?:입니다|합니다|있어요|해요|예요|이에요))\s+/u);
  const contact=/[\w.+-]+@[\w.-]+\.[a-z]{2,}|01[016789][\s.-]*\d{3,4}[\s.-]*\d{4}|\d{6}\s*-\s*[1-4]\d{6}/i;
  const candidates=[...new Set(sentences.map(line=>line.replace(/^안녕(?:하세요|하십니까)[.?!, ]*/,"").trim()))]
    .filter(line=>line && !contact.test(line) && !(name && line.includes(name) && /(?:이름|닉네임)/.test(line) && line.length<=30));
  const themes=[/일하|회사|개발|운영|사업|창업|공부|프로젝트/,/취미|좋아|여행|운동|등산|독서/,/함께|목표|싶|도전|찾고/];
  const selected=new Set<string>();
  for(const theme of themes){
    const line=candidates.find(line=>theme.test(line));
    if(line)selected.add(line);
  }
  for(const line of candidates){
    if(selected.size>=4)break;
    selected.add(line);
  }
  const intro=candidates.filter(line=>selected.has(line)).join(" ").slice(0,500).trim();
  const business=(intro.match(/사업|창업|투자|매장|스타트업/g)||[]).length;
  const hobby=(intro.match(/취미|여행|독서|운동|등산|러닝|마라톤|클라이밍/g)||[]).length;
  return {name:name||"",intro,topic:business>hobby?"사업":hobby>0?"취미 · 여행":"일과 도전"};
}

export const MAX_VOICE_SECONDS = 180;
export const MAX_VOICE_BYTES = 20 * 1024 * 1024;

export function voiceFileProblem(file: {size:number;type:string;name:string}) {
  if (!file.size) return "빈 파일이에요. 다시 골라 주세요.";
  if (file.size > MAX_VOICE_BYTES) return "20MB 이하의 음성 파일을 골라 주세요.";
  if (!file.type.startsWith("audio/") && !/\.(?:m4a|mp3|wav|webm|ogg|oga|opus|aac|mp4|flac)$/i.test(file.name))
    return "M4A, MP3, WAV, WebM 같은 음성 파일을 골라 주세요.";
  return "";
}

export async function speechSamples(blob: Blob) {
  const decoder=new AudioContext();
  let decoded:AudioBuffer;
  try{decoded=await decoder.decodeAudioData(await blob.arrayBuffer());}
  finally{await decoder.close();}
  // Allow a fraction of a second for MediaRecorder stop/codec padding.
  if(decoded.duration>MAX_VOICE_SECONDS+0.5)throw new RangeError("3분 이하의 녹음이나 음성 파일로 다시 시도해 주세요.");
  const frames=Math.min(MAX_VOICE_SECONDS*16000,Math.max(1,Math.ceil(decoded.duration*16000)));
  const offline=new OfflineAudioContext(1,frames,16000);
  const source=offline.createBufferSource();
  source.buffer=decoded;source.connect(offline.destination);source.start();
  const samples=(await offline.startRendering()).getChannelData(0);
  let power=0;
  for(const sample of samples)power+=sample*sample;
  if(samples.length<6400 || Math.sqrt(power/samples.length)<0.00045)throw new Error("목소리가 들리지 않아요. 마이크를 확인하고 다시 녹음해 주세요.");
  return samples;
}
