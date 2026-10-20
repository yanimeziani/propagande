# Agent double: the open-source pipeline

Your scene, another character: same motion, same light, same sound. Every model is open weights under Apache 2.0. Researched and built on 2026-10-20.

## The models, and why these
| Step | Model | License | Where it runs | Why |
|---|---|---|---|---|
| Pick and follow the person | **EdgeTAM** (Meta, `onnx-community/EdgeTAM-ONNX`) | Apache 2.0 | The visitor's browser, on the GPU (about 20 MB) | SAM 2-class segmentation built for phones and laptops; free to run, nothing uploaded at this step |
| Skeleton, face, mask, background | Wan2.2 official preprocessing (YOLOv10 detector, ViTPose whole-body, SAM 2) | Apache 2.0 code; checkpoints in the Wan2.2-Animate-14B repo | GPU server | What the generator expects as input |
| Replace the person | **Wan2.2-Animate-14B**, replacement mode | Apache 2.0 | GPU server | The open model with an explicit replacement mode: keeps the scene and the motion, swaps the character |
| Match the light | Wan2.2-Animate **relighting LoRA** | Apache 2.0 | GPU server | Re-lights the new character to the scene (`--use_relighting_lora`) |
| Sound and label | ffmpeg | LGPL/GPL tool | GPU server | Original audio back on; « Modifié par IA » burned in |

**Considered, not chosen (yet):**
- **Wan2.2-Animate-2-14B** (Apache 2.0, released 2026-08-07): stronger animation and viewpoint control, but its model card describes animating a character from a driving video, not replacing one in the original scene, and its default setup targets 8 data-center GPUs. It's the candidate for a future « Animer » mode.
- **Wan 2.5 to 3.0:** API only, no open weights.
- **LTX-2.x:** community license with revenue conditions. **HunyuanVideo-1.5:** license excludes some regions.

## Why the split
Wan2.2-Animate-14B can't run in a browser or on a 16 GB Mac. Common setups use a 24 GB GPU with model offload at draft resolution; 80 GB is comfortable at 720p. So:
- **On the device, free:** the person is chosen and followed (tested: 10 s clip, 100 % of frames, about 15 s).
- **On a GPU, paid (Pro):** generation. It costs GPU time, so under the council's rule it belongs in Pro, not in the free list.

## What the official tools don't do, and we do
The official mask extraction is single-person only; its guide says multi-person videos need « their own solution ». Our EdgeTAM tracking is that solution: the visitor taps the right person. **v1** runs the official pipeline unchanged (one person on screen) and sends the tap and the tracking coverage with the job. **v2** feeds our per-frame masks into replacement (the diffusers pipeline takes a mask video), so scenes with several people work.

## The pieces
- `src/lib/double/track.worker.ts`, `track.ts`: EdgeTAM in a worker. Tap → largest confident outline; then anchor points + a slightly wider box per frame, with the candidate that overlaps the previous outline chosen. Rejects background leaks (a wide band on the top edge, sudden growth, a size far from the tap's), retries with torso points and a « not this » point above the head, and widens the search while lost.
- `src/lib/double/engine.ts` + the page: sends the job (scene, character as PNG, tap, coverage, consent record), follows the status, shows and saves the result. The server address comes from the build (`NEXT_PUBLIC_DOUBLE_ENGINE`); access needs a code the server knows.
- `engine/agent_double/setup_gpu.sh`: one-time setup on a Linux NVIDIA machine (Wan2.2 pinned to `1ea34ff`, weights from `Wan-AI/Wan2.2-Animate-14B`).
- `engine/agent_double/job.py`: checks (length, consent) → official preprocessing (`--replace_flag`) → generation (`--replace_flag --use_relighting_lora`, `--low-vram` adds offload and T5 on CPU) → sound and label.
- `engine/agent_double/server.py`: standard-library HTTP server. One job at a time, access codes from a file (revoke by deleting a line), CORS limited to madelucid.com.

Tested here: the tracking on a real take; the server and the whole page flow in `--dry-run` (job accepted, status, result delivered, bad code refused, missing consent refused). **Not tested:** real generation; it needs the GPU machine.

## Rules built in
- The visitor confirms the scene is theirs (or that they may edit it). A real person as the new character requires their written consent; the job carries this record with a timestamp, and the server refuses a job without it.
- Every output carries a visible « Modifié par IA » label.
- 10 seconds at most per scene for now; a 480p draft first, then the final after the visitor's OK.
- See `ops/guardrails.md` for AI disclosure and Québec image rights.

## To go live (Yani)
1. Rent a GPU with 24 GB or more of video memory (48 to 80 GB is easier), run `setup_gpu.sh`, then `server.py --codes codes.txt` behind HTTPS.
2. Time a 10 s draft and a final, multiply by the hourly price: that's the cost per clip, which sets the Pro price or a credits count.
3. Build the site with `NEXT_PUBLIC_DOUBLE_ENGINE=https://<server>` and deploy, then hand out codes.
