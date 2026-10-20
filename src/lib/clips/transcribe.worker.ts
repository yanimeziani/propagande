/// <reference lib="webworker" />
/** Whisper in a worker, on the GPU when there is one. Takes 16 kHz mono audio and a list of windows
 *  (each under 30 s, cut at pauses), sends back word timings window by window. Nothing leaves the device:
 *  only the model weights are downloaded, once, then served from the browser cache. */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { modelStore } from "./model-store";

export type Runtime = { model: string; device: "webgpu" | "wasm"; dtype: Record<string, string> };
export type WorkerIn = { type: "run"; audio: Float32Array; windows: [number, number][]; runtime: Runtime; language: string };
export type WorkerOut =
  | { type: "load"; file: string; loaded: number; total: number }
  | { type: "ready" }
  | { type: "lang"; code: string }
  | { type: "words"; index: number; words: { t0: number; t1: number; w: string }[] }
  | { type: "done" }
  | { type: "error"; message: string };

env.allowLocalModels = false;
// Our own store (OPFS): the Cache API drops the big weight files in some browsers
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = modelStore as never;

const SR = 16000;
// Whisper's well-known French hallucinations on silence and music
const JUNK = /sous-titr|amara\.org|merci d'avoir regard|^\s*(générique|musique)\s*[.!]?\s*$/i;

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let loadedKey = "";

const post = (m: WorkerOut) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { audio, windows, runtime, language } = e.data;
  try {
    const key = `${runtime.model}|${runtime.device}|${JSON.stringify(runtime.dtype)}`;
    if (!asr || key !== loadedKey) {
      loadedKey = key;
      asr = pipeline("automatic-speech-recognition", runtime.model, {
        device: runtime.device,
        dtype: runtime.dtype as never,
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === "progress" && p.file) post({ type: "load", file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 });
        },
      }) as Promise<AutomaticSpeechRecognitionPipeline>;
    }
    const run = await asr;
    post({ type: "ready" });

    // Whisper in this library defaults to English when no language is given, so detect it ourselves:
    // one decoding step from <|startoftranscript|> on up to 3 speech windows, majority vote
    let lang = language;
    if (language === "auto") {
      lang = await detectLanguage(run, audio, windows.slice(0, 3));
      post({ type: "lang", code: lang });
    }

    for (let i = 0; i < windows.length; i++) {
      const [a, b] = windows[i];
      const sub = audio.subarray(Math.floor(a * SR), Math.min(audio.length, Math.floor(b * SR)));
      const out = (await run(sub, { language: lang, task: "transcribe", return_timestamps: "word" } as never)) as {
        chunks?: { text: string; timestamp: [number, number | null] }[];
      };
      const chunks = out.chunks ?? [];
      const text = chunks.map((c) => c.text).join("");
      const words: { t0: number; t1: number; w: string }[] = [];
      if (!JUNK.test(text)) {
        for (const c of chunks) {
          const w = c.text.trim();
          if (!w) continue;
          const t0 = a + c.timestamp[0], t1 = a + (c.timestamp[1] ?? c.timestamp[0] + 0.3);
          const prev = words[words.length - 1];
          // A piece with no leading space continues the previous word: French elisions and hyphens
          // (« qu' » + « une », « peut » + « -être »), digit groups, trailing punctuation
          if (prev && !/^\s/.test(c.text)) {
            prev.w += w;
            prev.t1 = Math.max(prev.t1, t1);
          } else words.push({ t0, t1, w });
        }
      }
      post({ type: "words", index: i, words });
    }
    post({ type: "done" });
  } catch (err) {
    asr = null;
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

type Internals = {
  processor: (a: Float32Array) => Promise<{ input_features: unknown }>;
  model: {
    generation_config: { decoder_start_token_id: number; lang_to_id: Record<string, number> };
    generate: (o: Record<string, unknown>) => Promise<{ tolist: () => (number | bigint)[][] }>;
  };
};

async function detectLanguage(run: AutomaticSpeechRecognitionPipeline, audio: Float32Array, wins: [number, number][]): Promise<string> {
  const { processor, model } = run as unknown as Internals;
  const byId = new Map(Object.entries(model.generation_config.lang_to_id).map(([tok, id]) => [id, tok.slice(2, -2)]));
  const votes = new Map<string, number>();
  for (const [a, b] of wins) {
    const sub = audio.subarray(Math.floor(a * SR), Math.min(audio.length, Math.floor(b * SR)));
    const { input_features } = await processor(sub);
    const out = await model.generate({ inputs: input_features, decoder_input_ids: [model.generation_config.decoder_start_token_id], max_new_tokens: 1 });
    const seq = out.tolist()[0].map(Number);
    const code = byId.get(seq[1]);
    if (code) votes.set(code, (votes.get(code) ?? 0) + 1);
  }
  let best = "fr", n = 0;
  for (const [code, v] of votes) if (v > n) { best = code; n = v; }
  return best;
}
