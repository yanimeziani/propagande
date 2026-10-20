# Launch plan: Propagande, 0 $, no mass DMs

Decided by the Roast Room council on 2026-10-20: **GO on B** (B 8.3, support 8.1/10, 7 of 7 endorse). Full record: `ref/roast-room/sessions/2026-10-20-propagande-launch/verdict.md`.

**In one line:** Propagande goes public alone by Oct 25. The on-device clipper is free forever, a paid Pro is priced on the site from day 1, and users come only from opt-in: Yani's own clips and one public tester call.

## 1. Yani decides before launch (blocking)

| # | Decision | Where it goes |
|---|---|---|
| 1 | ~~**The Pro price.**~~ **Done 2026-10-20: 29 $/mois**, 15 seats. | `src/lib/offer.ts` → `PRO_PRICE`, and `brand/offers.md` |
| 2 | ~~**Approve the free-forever line.**~~ **Approved 2026-10-20**, as written. | `src/lib/offer.ts` → `FREE_FOREVER` |
| 3 | **Runway:** 3 months of living costs covered? If not, the first paid ask moves from Nov 10 to Nov 8. | This file |
| 4 | **Make the code public** (GitHub, AGPL): **yes, before Oct 25** (2026-10-20). Repo to create. | GitHub |
| 5 | **The inbox.** bonjour@madelucid.com is on the site (help, Pro waitlist, privacy). It has to receive mail. | Mail setup |
| 6 | **Where it's hosted: Yani's server** (2026-10-20), replacing the old agency site after a backup. Each deploy still needs his OK. | Deploy |
| 7 | **The 2 communities** for the tester call. Only ones whose rules allow posting a tool. Read the rules first. | Section 4 |
| 8 | **Showcase videos.** The home page wall is Higgsfield concept work labelled « Format 9:16 ». Replace it with real Propagande exports from your own videos when you're OK showing them. | `src/lib/showcase.ts` |
| 9 | **A way to pay, by Nov 7** (does not block Oct 25). The Nov 10 ask needs a working checkout (a payment link from a payment provider is enough to start), or the ask can't close (Hormozi, Buffett). Sales tax: in Canada, a small supplier under 30 000 $ of sales over four quarters doesn't have to register for GST/QST; confirm with an accountant. | Tarifs page |
| 10 | **What Pro is** (see section 1b). | `src/lib/offer.ts` → `PRO` |
| 11 | **Model fallback cap.** Pick where the mirror would live and the trigger (section 7). | This file |
| 12 | **Which account posts:** @yanimeziani or a new Propagande account, on TikTok, Reels and Shorts. | Section 5 |

### The free-forever line (to approve)

What the site promises, and nothing wider: **the list in the « Gratuit » column of Tarifs stays free, forever, and nothing is ever taken back.** That list is the clipper, the chosen moments cut at the end of a sentence, the three openings, word-by-word captions and the 9:16 export, for as many videos as you want, one at a time.

Internal guide only, never public copy (Bezos, readiness check): new things that cost us nothing tend to go in the free list. It is not a promise, because some Pro features run on the device too.

### 1b. What Pro is (to decide)

The readiness check found Pro too thin: the free list is already unlimited, and a queue plus saved styles only save a little effort (Hormozi). Graham's rule from the debate: Pro should be something that costs Yani time or money. A proposal to accept, change or replace:

- File d'attente : dépose 10 vidéos d'un coup (runs on the device)
- Styles de sous-titres sauvegardés par campagne (runs on the device)
- **Chaque semaine, Yani revoit tes 3 meilleurs clips et te dit quoi changer** (costs Yani about 10 minutes per member; seats capped at 15 on the Tarifs page, about 2.5 h a week)
- **Garantie : premier mois remboursé, sans question** (Hormozi)

The queue and saved styles aren't built yet. Target: built by Nov 7, before the paid ask.

## 2. Launch checklist

Built and tested on 2026-10-20:
- [x] Device check and size warning before the 566 MB download, with a no-captions path
- [x] Model stored once in the browser's file storage (the Cache API was dropping it)
- [x] Language detected automatically (French and English tested)
- [x] « Gratuit, pour toujours » on the home page and Tarifs; Pro block with a waitlist (price pending)
- [x] « Fait avec Propagande » end card, on by default, one tap to remove
- [x] FAQ (`/aide`), privacy page (`/confidentialite`), AGPL `LICENSE`, issue template
- [x] Anonymous first-party counts for the scorecard (section 6)
- [x] Agent double marked « Bientôt »; fake credits removed; home copy matches what ships
- [x] 30-minute video tested: 8 clips in 6 min 44 s (Mac, browser pane hidden), French detected
- [x] End card points to madelucid.com/clip, which counts end-card visits

Still to do:
- [ ] Section 1, decisions 1 to 8
- [ ] **By Oct 23 (Yani):** test on a Windows laptop without a recent GPU, an Android phone, an iPhone and Firefox. A failure on iPhone that isn't caught by the device check stops the launch (Wickman).
- [ ] **By Oct 23 (Yani):** film the first long video and the launch demo clip (Gary V)
- [x] Deployed to madelucid.com on 2026-10-20 (backup `html-pre-propagande-20261020T160041.tgz`); smoke test all 200; an `open` event from a real visit reached the log (Wickman)
- [ ] Deploy, with a backup first and Yani's OK
- [ ] **By Nov 7:** build the Pro queue and saved styles, and the checkout

## 3. Dates

| Date | What | Gate |
|---|---|---|
| Oct 21 to 24 | Section 1 decisions, device tests, deploy | Polish capped at 12 h |
| **Oct 25** | Public. Tester call in 2 communities. First 3 clips. | |
| Oct 31 | 10 tester recordings in | 7 of 10 finish a clip, 3 or more on non-Mac → Show HN |
| Nov 10 | Paid ask to every week-2 returner. The 10 testers first, on a live call. | |
| Nov 14 | First charge. Full council again. | Fewer than 3 payers → change the Pro offer, never the free core |
| Dec 14 | Business gate | Fewer than 3 payers after the revised offer → stop building, hours back to earning cash |

## 4. The tester call (one public post, no DMs)

Post once in each of the 2 communities. Reply to whoever answers, in the thread or by email.

The reward changed after the readiness check: Pro isn't built yet, so promising it on Oct 25 would break a promise on day one (Hormozi). The reward is a 20-minute call with Yani to tune their clips. It exists today, it's the live call where the Nov 10 ask happens, and it fits Martell's 2 live calls.

> **FR.** Je cherche 10 clippeurs pour tester Propagande, un outil gratuit qui tire 8 clips verticaux sous-titrés d'une vidéo longue. Tout tourne sur ton ordi, rien n'est envoyé. Si tu m'envoies une capture vidéo de ta première utilisation (du dépôt jusqu'au clip), on fait un appel de 20 minutes pour régler tes clips ensemble. madelucid.com/propagande

> **EN.** Looking for 10 clippers to test Propagande, a free tool that turns a long video into 8 captioned vertical clips. It runs on your computer, nothing is uploaded. Send me a screen recording of your first run (from drop to clip) and we'll do a 20-minute call to tune your clips together. madelucid.com/propagande

Log each tester: device, browser, time to the first clip, finished yes or no, came back in week 2 yes or no.

## 5. Content: 3 clips a day, 45 minutes a day at most

Day by day: `data/content/propagande-calendar.csv` and its guide `propagande-calendar.md` (in the MadeLucid workspace, not this repo).

- Twice a week, film one long video (a live, a talk to camera, a walk-through). Each gives 8 clips: 16 a week. The other 5 posts are a second opening (punch or question) of the week's strongest clips, posted on a different platform than the first version. That makes 21, which is 3 a day (Gary V's math check).
- Post 3 clips a day on TikTok, Reels and Shorts. If a day goes over 45 minutes, post 1 that day (the council's floor).
- The launch clip is the demo itself: a long video drops in, the timer, 8 clips out, « 0 $ ». One plain line and the link. No emojis, no comment bait, no teaser.
- Answer every comment.

## 6. Monday scorecard (5 numbers)

| Number | Source |
|---|---|
| People who made a clip | count of `GET /e/first-clip.txt` this week |
| Week-2 returners | count of `GET /e/return-w2.txt` |
| What the end card brings in | count of `GET /e/from-endcard.txt` (visits to madelucid.com/clip) |
| Device fail or crash rate | (`device-cpu` + `error` + `export-fail`) / `open` |
| Open issues | GitHub plus the inbox |
| Founder hours on Propagande | Yani's log, cap 20 |

On the server (the site's nginx logs go to `docker logs madelucid-agency-web`; they survive restarts, not a recreated container). Smoke-test `curl` hits are skipped:

```bash
L=$(docker logs --since 168h madelucid-agency-web 2>/dev/null | grep -v curl)
for e in open device-gpu device-cpu voice-yes voice-no voice-fail clips-ready export export-fail first-clip return-w2 from-endcard error; do printf '%-12s %s\n' "$e" "$(grep -c "GET /e/$e.txt" <<<"$L")"; done
```

The counts carry no identifier: only the path is used. They don't record on localhost.

## 7. If Hugging Face throttles or drops the model

The browser downloads about 566 MB of model files from huggingface.co once, plus about 27 MB of ONNX Runtime from cdn.jsdelivr.net. For 500 first-time users that is about 283 GB of model traffic, today paid by Hugging Face.

The switch, if needed:
1. Copy the files to our own server under `/models/`, keeping the same paths: `onnx-community/whisper-large-v3-turbo_timestamped/resolve/main/…` (config files, `onnx/encoder_model_q4f16.onnx`, `onnx/decoder_model_merged_q4f16.onnx`, and the q4 and whisper-small q8 variants for other devices).
2. In `src/lib/clips/transcribe.worker.ts`, set `env.remoteHost = "https://madelucid.com/models/"`.
3. To serve ONNX Runtime ourselves too, copy `node_modules/onnxruntime-web/dist/*.wasm` and `*.mjs` to `/ort/` and set `env.backends.onnx.wasm.wasmPaths = "/ort/"`.

**Don't put the mirror on the web server** (Buffett): 283 GB on the box that serves madelucid.com could bring a bandwidth bill and take the site down. Put it on object storage with no egress fee (for example Cloudflare R2, where storage for these files is a few cents a month and downloads aren't billed; check the current pricing before choosing). Hard cap: 10 $ a month. If a provider can't stay under it, stay on Hugging Face and pause new first-run downloads instead.

**The trigger:** more than 5% of first-run downloads fail in a week (`voice-fail` ÷ `voice-yes` in the scorecard counts), or Hugging Face announces limits on these files. Users who already have the model are not affected either way.

## 8. Show HN (only after the Oct 31 gate)

> **Show HN: Propagande – turn long videos into captioned shorts, entirely in the browser**
> Whisper large-v3-turbo runs on WebGPU in a worker; cuts land on sentence boundaries; each clip can open on its strongest sentence and cut back; captions are burned in with canvas + MediaRecorder. Nothing is uploaded, so it's free to run. AGPL. Built in Québec, French first, language auto-detected.

## 9. Kill criteria

- Fewer than 7 of 10 testers finish a clip → fix the product, no Show HN.
- More than 20% of visitors fail the device check or crash in week 1 → Show HN waits.
- Fewer than 5 of the first 20 outside clippers make a second batch in week 2 → back to users, no public push.
- Support above 5 h a week by day 14 → capped private beta.
- Fewer than 3 payers by Nov 14 → change the Pro offer. By Dec 14 after the revision → stop building.
