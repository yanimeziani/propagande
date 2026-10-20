# Propagande in Claude (MCP server + skill)

Claude edits, your machine cuts. Claude reads the transcript, chooses the moments and the openings; the local engine transcribes and renders. Nothing is uploaded, no credits, 0 $ per clip.

## Install (macOS)

```bash
engine/setup.sh
```

builds the Swift tools and tells you if whisper.cpp or its model is missing. Then:

**Claude Code**

```bash
claude mcp add propagande -- python3 /absolute/path/to/engine/mcp/server.py
mkdir -p ~/.claude/skills && cp -R skills/propagande ~/.claude/skills/
```

**Claude Desktop** (`claude_desktop_config.json`)

```json
{ "mcpServers": { "propagande": { "command": "python3", "args": ["/absolute/path/to/engine/mcp/server.py"] } } }
```

and add `skills/propagande` as a skill.

## Use

« Tire 8 clips de ~/Movies/live-du-mardi.mp4, avec un cold open quand la première phrase est faible. »

## Tools
| Tool | Does |
|---|---|
| `check_setup` | Lists what's installed and how to fix what's missing |
| `analyze_video` | Transcribes on this machine (cached), returns numbered timed sentences and suggested moments |
| `render_clips` | Renders chosen ranges as 1080×1920 MP4s with word captions, face-centred, optional cold open |

Measured on an M-series Mac: a 5 min 46 s video analyzed in 36 s (first run), two clips (48 s of output, one with a cold open) rendered in 11 s.

The server is plain Python 3 (standard library only) speaking MCP over stdio.
