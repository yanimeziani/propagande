/// <reference lib="webworker" />
/** EdgeTAM in a worker (Apache 2.0, about 20 MB): one frame + a point or a box in, the person's mask out.
 *  Runs on the GPU when there is one. The model is kept in the same on-device store as Whisper. */
import { AutoProcessor, env, RawImage, type Processor, type Tensor } from "@huggingface/transformers";
import { EdgeTamModel } from "@huggingface/transformers";
import { modelStore } from "../clips/model-store";

env.allowLocalModels = false;
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = modelStore as never;

const MODEL = "onnx-community/EdgeTAM-ONNX";

export type TrackIn =
  | { type: "init"; device: "webgpu" | "wasm" }
  | { type: "segment"; id: number; width: number; height: number; rgba: Uint8ClampedArray; points?: [number, number][]; labels?: number[]; box?: [number, number, number, number] };
export type Candidate = { mask: Uint8Array; score: number; box: [number, number, number, number] | null; area: number };
export type TrackOut =
  | { type: "ready" }
  | { type: "load"; loaded: number; total: number }
  | { type: "masks"; id: number; candidates: Candidate[] }
  | { type: "error"; message: string };

let model: Awaited<ReturnType<typeof EdgeTamModel.from_pretrained>> | null = null;
let processor: Processor | null = null;
const post = (m: TrackOut, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

self.onmessage = async (e: MessageEvent<TrackIn>) => {
  const m = e.data;
  try {
    if (m.type === "init") {
      const files = new Map<string, { loaded: number; total: number }>();
      const progress = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== "progress" || !p.file) return;
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
        let loaded = 0, total = 0;
        for (const f of files.values()) { loaded += f.loaded; total += f.total; }
        post({ type: "load", loaded, total });
      };
      processor = await AutoProcessor.from_pretrained(MODEL);
      model = await EdgeTamModel.from_pretrained(MODEL, {
        device: m.device,
        dtype: m.device === "webgpu" ? "fp16" : "int8",
        progress_callback: progress as never,
      });
      post({ type: "ready" });
      return;
    }
    if (!model || !processor) throw new Error("not ready");
    const { id, width, height, rgba, points, labels, box } = m;
    const image = new RawImage(rgba, width, height, 4).rgb();
    const prompt: Record<string, unknown> = {};
    if (points?.length) {
      prompt.input_points = [[points]];
      prompt.input_labels = [[labels ?? points.map(() => 1)]];  // 1 = the person, 0 = not this
    }
    if (box) prompt.input_boxes = [[box]];
    const inputs = await (processor as unknown as (img: RawImage, o: Record<string, unknown>) => Promise<Record<string, Tensor>>)(image, prompt);
    const out = (await model(inputs)) as { pred_masks: Tensor; iou_scores: Tensor };
    const masks = (await (processor as unknown as { post_process_masks: (...a: unknown[]) => Promise<Tensor[]> }).post_process_masks(
      out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes,
    ))[0];
    // All candidates go back (a detail, a part, the whole): the page picks with what it knows (size on the first
    // tap, continuity with the previous frame after that)
    const scores = Array.from(out.iou_scores.data as Float32Array);
    const n = width * height;
    const all = masks.data as Uint8Array | boolean[];
    const candidates: Candidate[] = scores.map((score, k) => {
      const mask = new Uint8Array(n);
      let area = 0, x0 = width, y0 = height, x1 = -1, y1 = -1;
      for (let i = 0; i < n; i++) {
        if (all[k * n + i]) {
          mask[i] = 1; area++;
          const x = i % width, y = (i / width) | 0;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      return { mask, score, area, box: area ? [x0, y0, x1, y1] : null };
    });
    post({ type: "masks", id, candidates }, candidates.map((c) => c.mask.buffer));
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
