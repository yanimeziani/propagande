# Propagande: the simplest clipping tool, built where vibe-coding can't follow

Context: clipping is a real economy. Brands fund campaigns (e.g. **$3 per 1 000 views** on Whop Content Rewards), clippers cut long-form into 5–10 shorts per session (a hook in the first 3 s, captions, adapted per platform), and good clippers earn up to about $10 000/month. Their tools are CapCut, Opus, Descript and InShot. Source: [Whop, « What is content clipping »](https://whop.com/blog/what-is-content-clipping/).

## 1. The easiest UX: one action
**Drop a video and get the clips. That's the whole product on first use.**
- No settings visible by default. Defaults are 8 clips of 20–45 s, 9:16, captions on, crop on the face. « Réglages » stays collapsed for the 10 % who want it.
- The results show up as a feed of finished clips, each with its hook line, ready to download. One button: **« Tout télécharger »**.
- Every clip says *why* it was picked (« Question en ouverture », « Chiffre », « Énergie haute »). That builds trust in one glance.
- Edits are three verbs only: **plus tôt / plus tard** (move the cut to the previous or next sentence), **recadrer** (drag the face box), **retirer**. No timeline.
- Phone first: drop from the camera roll, swipe through the clips, save to Photos.

## 2. What vibe-coding can't copy (the moat)
Any interface can be cloned in a weekend. These parts can't:
1. **The engine.** Moments come from the transcript (sentence boundaries, hooks, numbers) plus audio energy, with captions timed to the word and a face-tracked crop. We already run this locally (`engine/`). The next step is running it **in the browser on the GPU** (Whisper via WebGPU, rendering via WebCodecs), so it's private, instant and costs us nothing per clip. That is hard engineering, not a prompt.
2. **The data loop.** Every published clip's real performance (views, watch-through, saves) flows back and retrains the moment score. More clips mean better picks, a compounding advantage a clone starts at zero.
3. **Québec French.** Transcription and captions that handle Québec French (vocabulary, joual, anglicisms) and the caption style that works here. Generic tools get this wrong.
4. **The network (later): « Propagande Réseau ».** A campaign marketplace. Creators and brands fund clipping campaigns on their own content, clippers use Propagande, views are **verified** from platform data, payouts are automatic. The verification and anti-fraud layer is what Whop's article doesn't even describe. A network with both sides plus trust is the hardest thing to copy.

## 3. Rules
- Only content the user has the right to clip: their own, or a campaign's approved source. No downloading other people's videos.
- Paid clips are labelled (#partenariat / #pub); no disguised « fan » accounts.
- No cuts that change what the speaker meant.

## 4. Build order
1. **One-drop flow** in the web app: defaults, a feed of results, « Tout télécharger », the three edit verbs. *(UX, days)*
2. **Captions in the browser**: Whisper on WebGPU plus word-timed captions burned into the export. *(engine, about 1–2 weeks)*
3. **Face-tracked crop** in the browser (on-device face detection). *(engine)*
4. **Performance loop**: connect accounts (read-only), pull clip stats, recalibrate the score. *(data)*
5. **Propagande Réseau**: campaigns, view verification, payouts. *(network: legal, payments and fraud work first)*
