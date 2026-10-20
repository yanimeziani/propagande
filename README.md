# MadeLucid · Propagande

Drop a long video, get 8 vertical clips with word-by-word captions. Everything runs in the browser: Whisper large-v3-turbo on the user's GPU (WebGPU), cuts on whole sentences, three openings per clip (as is, punch first, question first), export to 9:16 MP4. The video never leaves the device, so a clip costs nothing to serve.

Live: [madelucid.com/propagande](https://madelucid.com/propagande/) (French first). Source: [github.com/yanimeziani/propagande](https://github.com/yanimeziani/propagande). License: AGPL-3.0 (see `LICENSE`).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000/propagande and drop a video. The first run downloads the voice model (about 566 MB, once, after asking).

## How it works

| File | Job |
|---|---|
| `src/lib/clips/transcribe.worker.ts` | Whisper in a worker (transformers.js, WebGPU or WASM), language detection, word timing |
| `src/lib/clips/transcribe.ts` | Runtime choice, pause-cut windows, the worker, the transcript cache |
| `src/lib/clips/model-store.ts` | Model files kept in the origin-private file system (the Cache API drops big files) |
| `src/lib/clips/moments.ts` | Sentences, moment scoring, the cold open, caption chunks |
| `src/lib/clips/export.ts` | Canvas + MediaRecorder render: segments, captions, the end card |
| `docs/PROPAGANDE.md` | Product plan and build order |
| `docs/LAUNCH.md` | Launch plan, scorecard, fallbacks |

## Propagande in Claude (local, 0 $ per clip)

An MCP server and a skill let Claude use the local engine: Claude chooses the moments and openings, your Mac transcribes and renders. Setup: `engine/mcp/README.md`.

## Report a problem

Open an issue with your browser, device and what you saw, or write to bonjour@madelucid.com.
