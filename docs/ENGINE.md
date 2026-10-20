# MadeLucid Engine

**Thesis.** Higgsfield's Genjutsu, Katana and the rest are **pipelines**: tracking, masks, depth, prompts, compositing and audio, wrapped around someone else's video model and sold as magic. The pipeline is the product. MadeLucid builds its own pipelines and runs **open-weight models it hosts itself**, so no feature depends on a competitor's API, its pricing or its terms.

What we own: the pipelines, the orchestration, the format data, the French layer and the UX.
What we host but don't train: the foundation models (open weights, commercial licences only).

## Layers

```
App (Next.js on Vercel)        UI, accounts, library, Créer, Propagande, Publier
  │  jobs (Supabase: queue + storage)
  ▼
Engine (our code, Python)      pipelines as versioned DAGs of steps; deterministic, resumable, cached per step
  │
  ├─ Local steps (CPU / Apple Silicon): probe, audio analysis, cuts, reframe, captions, render (ffmpeg), mix
  └─ GPU steps (rented on demand):     segmentation, tracking, depth, video generation / inpainting
       models: open weights we host; an external API only as an explicit, swappable fallback
```

- **One job = one pipeline run.** Each step has typed inputs and outputs, writes its artifact to storage and is skipped when its inputs haven't changed. A failed generation reruns one step, not the whole thing.
- **Model adapters.** Every model sits behind one interface (`segment`, `track`, `depth`, `inpaint_video`, `transcribe`). Swapping Wan for LTX, or self-hosted for an API, is one line of config.
- **GPU only when needed.** Rent GPUs per job (serverless GPU or spot), scale to zero, and log the cost per job so prices are set above cost.

## Pipeline 1: Propagande (long video → clips)
| Step | v0 (shipped, in the browser) | v1 (engine) |
|---|---|---|
| Find moments | audio loudness and variation | + transcript: hooks, punchlines, numbers, questions; scored by a small LLM pass |
| Cut | snapped to quiet frames | snapped to sentence ends from the word timestamps |
| Reframe 9:16 | manual left/right | face and speaker tracking, smooth camera path |
| Captions | none | word-by-word captions in the brand style, Québec French spelling kept |
| Render | MediaRecorder (real time) | ffmpeg on the server, faster than real time, H.264 + AAC |

Models: Whisper large-v3-turbo (MIT) via whisper.cpp (local, Metal on Mac; CPU/GPU on the server); a face detector for tracking.

## Pipeline 2: Genjutsu (« your scene, new character »)
1. **Probe and plan:** shots, length, resolution, audio kept aside.
2. **Track the subject:** point or box prompt → masks over every frame (SAM 2, Apache-2.0).
3. **Structure:** depth and pose per frame, so the new subject moves like the old one.
4. **Generate:** masked video-to-video with the reference image (Wan VACE family, open weights; licence to confirm on the official model card before production).
5. **Composite:** feathered mask edges, colour match to the plate, grain match.
6. **Restore:** put the **original audio** back, untouched.
7. **QC:** flicker and identity-drift checks; draft at low res, then the approved full res.

**Consent rule (built in, not optional):** replacing or inserting a real person needs that person's consent. The upload flow asks for it and stores it. Invented characters are fine.

## What makes it ours
- **The format library and its results:** which hooks, cuts and formats actually perform, fed back from every published clip. Nobody else has this for Québec and French.
- **The French layer:** transcription, captions and voice tuned for Québec French.
- **Deterministic renders:** the beat-synced motion engine already built for the ads and the showreel (Pillow + AVFoundation now, ffmpeg on the server).

## Order of work
1. **Propagande v1 on the Mac:** whisper.cpp + captions + sentence-snapped cuts. No GPU, no cost. Use it on Yani's own videos every week (`data/content/propagande-programme.md`).
2. **Engine skeleton:** job model in Supabase, a step runner, a storage layout, cost logging.
3. **Genjutsu v1 on a rented GPU:** SAM 2 + Wan VACE on short clips (≤ 10 s), drafts first.
4. **Self-serve in the app:** upload, consent, draft, approve, final.

## Licences checked (2026-10-20, re-check before production)
- Wan 2.2: Apache 2.0, commercial use allowed ([fuser.studio](https://fuser.studio/articles/best-open-source-video-models), [Spheron](https://www.spheron.network/blog/kling-ai-alternative-self-host-wan-and-ltx-video-2026/)).
- LTX-2: open with a custom licence, free under 10 M$ revenue ([Wikipedia](https://en.wikipedia.org/wiki/LTX-2)).
- Whisper and turbo: MIT ([Simon Willison](https://simonwillison.net/2024/Oct/1/whisper-large-v3-turbo-model)); whisper.cpp runs on Metal and Core ML.
- SAM 2: Apache 2.0 (recalled; confirm on the official repo). SAM 3: terms to check.
- The Genjutsu open-source workflow (TEIN): MIT; a reference for the step order only.
