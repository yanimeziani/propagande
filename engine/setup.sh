#!/usr/bin/env bash
# Builds the Propagande engine's Swift tools (macOS) and checks the Whisper pieces.
# It downloads nothing: missing pieces are printed with how to get them.
set -euo pipefail
cd "$(dirname "$0")"
[ "$(uname)" = "Darwin" ] || { echo "Propagande's local engine renders with AVFoundation: macOS only for now."; exit 1; }
command -v swiftc >/dev/null || { echo "swiftc missing: install the Xcode Command Line Tools (xcode-select --install)."; exit 1; }
mkdir -p bin
for t in extract_audio render_clip join_clips reference; do
  swiftc -O "swift/$t.swift" -o "bin/${t//_/-}" 2>/dev/null && echo "built bin/${t//_/-}"
done
W="$HOME/.local/bin/whisper-cli"; M="$HOME/.local/share/whisper-models/ggml-large-v3-turbo-q5_0.bin"
[ -x "$W" ] && echo "ok $W" || echo "MISSING $W: build whisper.cpp (https://github.com/ggml-org/whisper.cpp, cmake -DGGML_METAL=1) and copy build/bin/whisper-cli there."
[ -f "$M" ] && echo "ok $M" || echo "MISSING $M: download ggml-large-v3-turbo-q5_0.bin (whisper.cpp models/download-ggml-model.sh large-v3-turbo-q5_0) to that path."
echo
echo "Then register the server with Claude Code:"
echo "  claude mcp add propagande -- python3 \"$(pwd)/mcp/server.py\""
