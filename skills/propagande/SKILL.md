---
name: propagande
description: Clip a long video (podcast, live, interview, vlog) into vertical 9:16 shorts with word-by-word captions and cold opens, entirely on this machine at 0 $ per clip, through the Propagande MCP server. Use when the user wants clips, shorts, reels or TikToks cut from a long video, a batch of clips for a clipping campaign, « the best moments », or a hook-first edit of a talk. Needs the propagande MCP server (tools check_setup, analyze_video, render_clips).
---

# Propagande: Claude edits, the machine cuts

The tools do the heavy work locally (whisper.cpp transcription, face-centred 9:16 render, burned-in captions). Your job is the editor's: choose moments that work on their own, choose how each one opens, and report back. Nothing is uploaded and nothing costs credits, so a batch of 10 or 20 clips is fine.

## Workflow
1. **Get the file.** Ask for an absolute path to a local video if you don't have one. Only clip footage the user has the right to use: their own, or a campaign's approved source. If they ask to clip someone else's video with no permission, say so and stop.
2. **Analyze.** `analyze_video` with the path. Language defaults to `auto`. It returns numbered, timed sentences and the engine's suggested moments with reasons. The suggestions are a starting point; you decide.
3. **Choose moments** with the rules below. Default: 8 clips of 20 to 45 s, unless the user asks otherwise.
4. **Show the plan before rendering** when the user is present: for each clip, its first line, its length, why it works, and the cold open if any. Skip this when they asked for a batch with no review.
5. **Render.** `render_clips` with `start`/`end` in seconds taken from sentence edges (a sentence's start minus 0.15 s, the last sentence's end plus 0.35 s). Give each a short `title`.
6. **Report.** The file paths, then one line per clip: the hook, the length, and why it should hold attention. Point out the strongest one.

## Choosing a moment (the craft)
- **It stands alone.** A stranger who has never seen the speaker gets it in 2 seconds. No « comme je disais », no pronoun pointing back to something cut. If it needs one line of setup, include that line.
- **One idea per clip.** Engine windows sometimes cross a topic change. Split or trim them at the change.
- **The first sentence is the hook:** a question, a number, a bold claim, « tu » / « you », a surprise. Weak start → find a later line for a cold open, or move the start.
- **It ends on a complete sentence**, ideally the payoff or a punchline, never on « et », « mais », « parce que ».
- **20 to 45 s by default.** Shorter if the idea lands earlier; never pad.
- **No overlap** between clips of the same batch unless the user wants several angles on one moment.

## Openings
- **Tel quel (as is):** when the first sentence already hooks.
- **Cold open:** pick one short, strong sentence from inside the clip (2 to 6 s: a punchline, a number, an emotional line) and pass it as `cold_open`. It plays first, then the clip from its start, so the line is heard again in context.
- **Question first:** same mechanism, using a question the speaker asks inside the clip.
- **Never** stitch lines together into a claim the speaker didn't make. A cold open moves one whole sentence; it never edits words.

## Batch mode (clipping campaigns)
When the user needs volume (« 10 clips from this podcast »), skip the review step. Cover different moments and different hook types (one number, one question, one story, one bold claim…). Name the files by hook. Report which 3 to post first.

## When something fails
Call `check_setup` and relay its fix lines. Rendering is macOS-only for now. A video with no speech returns a plain message: say so; Propagande clips people talking.
