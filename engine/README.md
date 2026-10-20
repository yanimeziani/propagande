# MadeLucid Engine (local)

Our own pipelines on open-weight models. Architecture: `../docs/ENGINE.md`.

## Propagande v1: a long video becomes captioned 9:16 clips

```
python3 engine/propagande.py ~/Movies/mon-live.mp4 --clips 8 --min 20 --max 45
```

Output (next to the video, in `<name>-propagande/`):
- `propagande-01.mp4` … : 1080×1920 clips with captions burned in, cut on sentence edges, the crop placed on the face (Vision)
- `moments.json`: each clip's times, score, first line and the reasons it was picked (« Question en ouverture », « Chiffre dans la première phrase »…)
- `transcript.txt`: the whole transcript with timestamps

Speed on an M4: a 28 s test runs end to end in 13 s; a rerun with new settings takes about 5 s, because the transcript is cached in `work/`.

### Needs (installed in `~/.local`, nothing system-wide)
- `whisper-cli` (whisper.cpp v1.9.5, Metal) and `~/.local/share/whisper-models/ggml-large-v3-turbo-q5_0.bin` (MIT, sha256 checked)
- the two Swift tools, built once:
  ```
  swiftc -O engine/swift/render_clip.swift -o engine/bin/render-clip
  swiftc -O engine/swift/extract_audio.swift -o engine/bin/extract-audio
  ```

### Known limits (v1)
- The crop is fixed per clip (the median face position); it doesn't follow a moving speaker yet.
- Captions use Avenir Next Heavy (a macOS system font); the brand font comes when it's bundled.
- Moment scoring is rule-based (hook, ending, energy, speech rate). An LLM pass on the transcript is next.
- `DEBUG_CAPS=1 engine/bin/render-clip …` draws captions without animation, for layout checks.
