# UX benchmark: Higgsfield and OpenArt (2026-10-20)

Goal: make MadeLucid feel like a funded, premium product rather than a weekend project. These are patterns we observed on both sites, not copied assets.

## What makes them feel premium
1. **The product is the page.** OpenArt's home is the workspace: a sidebar plus a composer (« What are we making today? »). Every Higgsfield tool page opens with a working prompt bar in the hero (prompt, model · length · aspect · sound chips, a big GENERATE). You try before any sign-up wall.
2. **An app shell from the first click.** OpenArt has a persistent, collapsible left sidebar grouped like a product: Agents, **Tools** (a 2-column icon grid), **Assets** (projects, characters, brand kit, media), **Inspire** (templates, arena, tutorials). The old hub uses an icon rail. Higgsfield uses a dense top nav whose tabs carry « Top » and « New » badges.
3. **Momentum signals.** « New », « Beta », « Top » and « 10 % OFF » badges on nav items; a thin promo strip at the very top; « What's new? » feature cards with « Try now ».
4. **The studio layout.** A control panel on the left (start/end frame tiles, prompt, model picker), the result in the middle, **history on the right** (each past generation with its prompt, reuse, copy, delete). Nothing is ever lost.
5. **Templates as features.** « Direct your video », « Viral presets » and preset rows turn the catalogue into one-tap starts.
6. **Pricing as a conversion page:**
   - a promo banner at the top
   - Individual / Business tabs, plus a Monthly / Annual switch showing « 30 % OFF »
   - a « Not sure which plan? » helper
   - **credits translated into outcomes** (« 1 200 credits = ~80 videos »)
   - struck-through prices with « Save $144 »
   - one highlighted card
   - benefit groups with status chips (« 3 free gens », « UNLIMITED », « 720p »)
7. **Big, confident type** on landing pages (uppercase display, two lines), then a **real screenshot of the studio**, then a feature bento, then « who it's for » (filmmakers, agencies, creators, e-commerce).

## MadeLucid today vs. the bar
| Area | Them | Us now | Fix |
|---|---|---|---|
| First screen | The tool itself | A marketing hero | A home composer: pick a tool, drop a video, land in the tool already running |
| Navigation | A grouped sidebar with badges | A top nav with 2 links | **App shell**: a sidebar (Outils, Mes créations, Inspiration) with badges; top bar with credits, help, account |
| History | A right column on every tool | Results vanish on reload | A « Mes créations » library and a history column in each tool (local first, then Supabase) |
| Momentum | New/Beta badges, promo strip | None | « Nouveau » / « Bêta » badges on real things only; a launch strip |
| Pricing | Credits → outcomes, toggles | « Bientôt » | Credits shown as outcomes once Yani sets prices |
| Accounts | Sign-in gate at generate | None | Supabase auth at the moment of export or generate, never before trying |

## Rules we keep while borrowing
- Real badges only: « Nouveau » means it shipped this month; « Bêta » means it's in beta.
- No fake discounts or countdowns. A promo strip announces a real launch.
- French first. Our own visuals, never their assets.

## Build order
1. **App shell:** the sidebar and slim top bar on desktop, the bottom tabs on mobile. *(Now.)*
2. **Home composer:** pick Propagande or Agent double, drop a file, and the tool opens with it already loaded. *(Now.)*
3. Mes créations: a local history of exports (IndexedDB), then Supabase.
4. A history column inside each tool.
5. Pricing with credits as outcomes (needs Yani's prices).
6. Supabase auth at export time.
