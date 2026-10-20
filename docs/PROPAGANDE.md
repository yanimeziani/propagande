# Propagande: the simplest clipping tool, built where vibe-coding can't follow

Context: clipping is a real economy. Brands fund campaigns (e.g. **$3 per 1 000 views** on Whop Content Rewards), clippers cut long-form into 5–10 shorts per session (a hook in the first 3 s, captions, adapted per platform), and good clippers earn up to about $10 000/month. Their tools are CapCut, Opus, Descript and InShot. Source: [Whop, « What is content clipping »](https://whop.com/blog/what-is-content-clipping/).

## 1. The easiest UX: one action
**Drop a video and get the clips. That's the whole product on first use.**
- No settings visible by default. Defaults are 8 clips of 20–45 s, 9:16, captions on, crop on the face. « Réglages » stays collapsed for the 10 % who want it.
- The results show up as a feed of finished clips, each with its hook line, ready to download. One button: **« Tout télécharger »**.
- Every clip says *why* it was picked (« Question en ouverture », « Chiffre », « Énergie haute »). That builds trust in one glance.
- Edits are three verbs only: **plus tôt / plus tard** (move the cut to the previous or next sentence), **recadrer** (drag the face box), **retirer**. No timeline.
- Phone first: drop from the camera roll, swipe through the clips, save to Photos.

## 2. Five layers, each harder to copy than the last
A clipper's income is roughly **volume × speed × hit rate × payout rate**. Each layer raises one factor.

| # | Layer | What the clipper gets | Why it's hard to copy |
|---|---|---|---|
| 1 | **Unlimited, on the device, 0 $ per clip** | « Illimité, gratuit, rien n'est envoyé. » Hours of video a day without credits | Whisper on WebGPU with word timing, plus rendering in the browser. Cloud rivals pay for every minute they process, so they can't match it without losing money |
| 2 | **Cold open** | The strongest sentence moved to the first second, then a cut back to the setup. 3 hook versions per moment, to A/B test on their own accounts | Needs word-level timing, sentence structure and pacing rules, not just a trim |
| 3 | **Campaign mode** | Paste a campaign brief (length, required tag or mention, banned topics); every clip is checked before export. Views → $ per campaign | Owns the daily workflow clippers now run in spreadsheets |
| 4 | **Data loop** | Real stats (read-only) retrain the moment score and the hook choice; « ton style qui marche » | A copycat starts at zero data |
| 5 | **Reputation** | A public leaderboard of verified views and a « Fait avec Propagande » badge; later Propagande Réseau (campaigns, verification, payouts) | A network with both sides and verified trust |

Also: Québec French. Transcription and captions that handle Québec vocabulary, joual and anglicisms, and the caption style that works here.

Left out on purpose: clipping other people's live streams in real time (rights), variants built to beat platform duplicate detection (terms of service), more caption styles (everyone has them).

## 3. Rules
- Only content the user has the right to clip: their own, or a campaign's approved source. No downloading other people's videos.
- Paid clips are labelled (#partenariat / #pub); no disguised « fan » accounts.
- No cuts that change what the speaker meant. The cold open moves a sentence, it never joins two sentences into one new claim.

## 4. Build order
1. ~~**One-drop flow**: defaults, a feed of results, « Tout télécharger », the edit verbs.~~ Shipped 2026-10-20.
2. ~~**Layers 1 + 2 together**~~ Shipped 2026-10-20 (`src/lib/clips/`):
   - `transcribe.worker.ts`: Whisper large-v3-turbo (q4f16, about 566 MB, downloaded once and cached) on WebGPU, or whisper-small on WASM without a GPU. Word timing, French elisions joined, known hallucinations dropped, a 90 s watchdog.
   - `transcribe.ts`: windows of 28 s at most, cut at pauses; silent windows skipped; transcripts cached per file, so changing settings takes about 1 s.
   - `moments.ts`: sentence-bounded moments scored on hook, ending, energy and speech rate (port of `engine/propagande.py`), no cut in mid-sentence, three openings per moment (Tel quel, Punch, Question), word caption chunks.
   - `export.ts`: several segments in one file (the recorder pauses during seeks), a 180 ms flash on the cut back, captions burned in (Geist 800, the spoken word in amber), a worker clock so rendering keeps going in a background tab.
   - Measured in the app's browser pane on Yani's M-series Mac, with the pane hidden (which slows it): 6 min of French takes transcribed in 2 min 10 s, plus about 20 s for the first model download. A 22 s Punch clip rendered in real time, 720×1280 MP4 with audio.
   - Not yet: no face-tracked crop (step 3); captions can't be edited by hand yet; « Tout télécharger » was not run end to end in the test (it reuses the single export, which was tested).
3. **Face-tracked crop** in the browser (on-device face detection).
4. **Campaign mode**: brief → checks before export, earnings per campaign.
5. **Data loop**: connect accounts read-only, pull clip stats, recalibrate.
6. **Reputation, then Propagande Réseau**: leaderboard first; campaigns, verification and payouts after the legal, payments and fraud work.
