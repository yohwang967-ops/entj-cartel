// Audio stays in this dedicated worker. The only external requests download public model files.
import { env, pipeline } from "./transformers.min.js";
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = new URL("./", import.meta.url).href;
self.onmessage = async ({data: samples}) => {
  try {
    self.postMessage({status:"준비", message:"한국어 받아쓰기 모델을 준비하고 있어요. 첫 사용에는 약 80MB를 내려받아요."});
    const progress = new Map();
    const pipe = await pipeline("automatic-speech-recognition", "Xenova/whisper-base", {
      revision:"64da57285918e20ea79ea5c88eed7197933abaa8", quantized:true,
      progress_callback(event) {
        if(event.status==="progress" && event.file?.endsWith(".onnx")){
          progress.set(event.file,event.loaded);
          const mb=Math.floor([...progress.values()].reduce((a,b)=>a+b,0)/1000000);
          if (mb!==self.lastMB) { self.lastMB=mb; self.postMessage({status:"준비",message:"받아쓰기 모델 준비 중 · "+mb+"MB"}); }
        }
      }
    });
    self.postMessage({status:"인식",message:"녹음을 한국어로 받아쓰고 있어요. 이 화면을 열어 두세요."});
    const result=await pipe(samples,{language:"korean",task:"transcribe",chunk_length_s:25,stride_length_s:4,return_timestamps:false,do_sample:false});
    const text=result.text.trim();
    if(!text)throw new Error("empty");
    self.postMessage({status:"done",text});
  } catch(error) {
    console.error("Speech recognition failed:",error?.message);
    self.postMessage({status:"error",message:error?.message==="empty"?"알아들은 말이 없어요. 목소리를 확인한 뒤 다시 녹음해 주세요.":"받아쓰기를 마치지 못했어요. 네트워크를 확인하고 Safari 또는 Chrome에서 다시 시도해 주세요."});
  }
};
