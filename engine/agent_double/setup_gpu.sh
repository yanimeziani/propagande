#!/usr/bin/env bash
# Agent double GPU engine: one-time setup on a Linux machine with an NVIDIA GPU (rented or owned).
# Installs the official Wan2.2 code at a pinned commit and downloads Wan2.2-Animate-14B (Apache 2.0)
# with its preprocessing models. Run it on the GPU machine, not on a Mac.
#
#   bash setup_gpu.sh /data/agent-double
#
# Sizing (official guidance and community reports, check before renting):
#   - 80 GB GPU (A100/H100): 720p, comfortable.
#   - 24-48 GB GPU (RTX 4090, L40S, A6000): use the draft resolution (832x480) and job.py's --low-vram mode
#     (model offload + T5 on CPU), slower.
#   - Disk: about 80 GB free for code, weights and work files.
set -euo pipefail
ROOT="${1:-/data/agent-double}"
WAN_COMMIT=1ea34ff48f87168174e12956e200b1d908b1c5ff   # Wan-Video/Wan2.2 main, 2026-09-21
mkdir -p "$ROOT"
cd "$ROOT"

command -v nvidia-smi >/dev/null || { echo "No NVIDIA GPU found (nvidia-smi missing)."; exit 1; }
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
command -v ffmpeg >/dev/null || { echo "Installing ffmpeg"; (sudo apt-get update && sudo apt-get install -y ffmpeg) || { echo "Install ffmpeg yourself, then rerun."; exit 1; }; }

if [ ! -d Wan2.2 ]; then git clone https://github.com/Wan-Video/Wan2.2.git; fi
(cd Wan2.2 && git fetch --quiet origin && git checkout --quiet "$WAN_COMMIT")

python3 -m venv venv
. venv/bin/activate
pip install --upgrade pip wheel
pip install -r Wan2.2/requirements.txt
[ -f Wan2.2/requirements_animate.txt ] && pip install -r Wan2.2/requirements_animate.txt
pip install "huggingface_hub[cli]"

# Weights: the model, its relighting LoRA and the preprocessing models (pose, detector, SAM 2) all live in this repo
huggingface-cli download Wan-AI/Wan2.2-Animate-14B --local-dir Wan2.2-Animate-14B

for f in Wan2.2-Animate-14B/process_checkpoint/det Wan2.2-Animate-14B/process_checkpoint/pose2d Wan2.2-Animate-14B/relighting_lora; do
  [ -e "$f" ] || { echo "Missing $f after download: check the model card."; exit 1; }
done
echo
echo "Ready. Next: python3 server.py --root $ROOT --codes $ROOT/codes.txt   (one access code per line)"
