# Agent double GPU engine

Wan2.2-Animate-14B (Apache 2.0) in replacement mode with the relighting LoRA, behind a small HTTP server.
The full picture, the model choice and the rules: `docs/AGENT-DOUBLE.md`.

```bash
bash setup_gpu.sh /data/agent-double          # once, on a Linux NVIDIA machine
python3 server.py --root /data/agent-double --codes /data/agent-double/codes.txt [--low-vram]
```

Test the plumbing anywhere, without a GPU: add `--dry-run` (the « result » is the scene itself, labelled when ffmpeg is installed).
