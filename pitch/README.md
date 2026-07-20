# Chromopunk: Resonators — Pitch Deck (SALTLINE edition)

A cinematic pitch for *Chromopunk: Resonators, Book One: The Last Compact* — an unofficial,
fan-created alternate continuity inspired by the Cyberpunk universe (Mike Pondsmith · R. Talsorian
Games · CD PROJEKT RED). Built for three audiences at once: publishing professionals evaluating a
novel, studio-minded readers evaluating a universe, and fans or collaborators discovering the
project.

Two visually matched artifacts, one design system ("SALTLINE" — bone paper, ink, storm gold,
blood red, gulf teal, hurricane slate):

| File | What it is |
|---|---|
| `chromopunk_pitch.html` | Self-contained cinematic deck. Double-click to open — no server, no install, works offline. |
| `chromopunk_pitch.pptx` | 16:9 PowerPoint version, fully editable, speaker notes on every slide. |

Source of truth for all lore: the *Chromopunk: Resonators Cinematic World Bible* (REMASTERED v1.2,
archive CR-DOM-2084). Nothing in the deck is invented beyond it.

---

## Presenting the HTML deck

- **Open**: double-click `chromopunk_pitch.html`. It runs from `file://` with no dependencies.
  Online it loads the Fraunces / Public Sans / IBM Plex Mono webfonts; offline it falls back to
  Georgia / system sans / system mono and everything still works.
- **Navigate**: `→` `←` arrow keys (also `Space`, `PageUp/Down`, `Home`, `End`), the on-screen
  arrows bottom-right, or swipe on touch devices. `INDEX` (bottom-left) opens a collapsible
  table of contents. A thin gold progress bar runs along the top; a slide counter sits bottom-center.
- **Deep links**: every slide has a URL hash (`chromopunk_pitch.html#s11` opens the Vin slide).
- **The spoiler gate**: the deck shows 20 slides. Slide 20 is a sealed appendix gate — a real
  two-step interaction (button, then explicit confirm). Unlocking adds two appendix slides (the
  Book One ending and the mystery ledger) to the deck, the counter, and the index. Deep links into
  the appendix while it is locked land on the gate instead. There is no way to reach the ending by
  accident.
- **Motion**: slow parallax drift on section backgrounds only. `prefers-reduced-motion` disables
  all animation and transitions.
- **Depth on demand**: most slides have a collapsed "Notes for the room" expander with the lore
  depth that would otherwise clutter the slide face.

## Printing the HTML to PDF

1. Open the deck in a browser (Chrome/Edge recommended).
2. If the appendix should be included, unlock the spoiler gate first — the print stylesheet
   respects the gate and omits sealed appendix slides (the gate page notes this in the printout).
3. `Ctrl/Cmd+P` → destination **Save as PDF** → layout **Landscape** → enable
   **Background graphics** → default margins.
4. Result: a clean, light, one-slide-per-page PDF (20 pages sealed / 22 unlocked). Navigation
   chrome and the expandable notes are excluded automatically.

## Presenting the PPTX

- Opens in PowerPoint, Google Slides, Keynote, and LibreOffice. 16:9, 22 slides
  (19 main + spoiler divider + 2 appendix).
- **Every slide has speaker notes** written in a natural pitching voice — what to actually say,
  not a copy of the slide text. Present in Presenter View.
- The spoiler divider (slide 20, "SPOILERS — BOOK ONE ENDING") sits before the appendix. If the
  audience should not see the ending, end the deck there or delete slides 21–22 from your copy.
- **Fonts**: the PPTX intentionally uses widely available stand-ins so it opens without font
  substitution chaos — Georgia (for Fraunces), Arial (for Public Sans), Courier New (for IBM Plex
  Mono). If you have the Google fonts installed, you can swap them via the master for a closer
  match to the HTML.
- Layout is built on slide masters (`SALT_COVER`, `SALT_CONTENT`, `SALT_DIVIDER`) with editable
  title/kicker placeholders — retitling a slide won't break the design.

---

## Bracketed fields the creator still needs to fill in

| Field | Where |
|---|---|
| `[name / handle TBD]` | Creator slide (19), both files — the name/handle you want public |
| `[contact / links TBD]` | Creator slide (19), both files |
| `[artist credit TBD]` | Vin slide (11) caption + creator slide chip, both files. The concept art appears to be signed **"KM"** (visible near the shoulder) — confirm with your friend how they want to be credited |
| Comps slate | Slide 17 is marked "creator may edit" — swap comps freely |

## Judgment calls and deviations

1. **File placement.** The repo root already had a `README.md` (for the playable `index.html`
   game), so the three deliverables live in `pitch/` instead of the root, and this file is the
   deliverable README. A short pointer was added to the root README.
2. **Tomas's spectrum.** The brief's shorthand described Tomas as "Storm/war hero"; the bible has
   no Storm spectrum — Tomas is **Lightning** ("Boy Thunder"). The deck follows the bible.
3. **The clock number.** The clock device reads **214 days** — May 31, 23:48 (the Fourfold Fall)
   to midnight December 31 is 214 days. Counted from Vin's escape (June 1) it would be 213; the
   deck consistently counts from the Fall.
4. **Proper-noun budget (≤ 8 before slide 10).** Counted as the eight core lore nouns, each defined
   in plain language on first use: Chromopunk, Resonator/Resonance (one term family), Bloodline,
   Domingo City, the (Matagorda) Compact, BEA-V7, the Rot, Reprieve. Three things were treated as
   outside the budget but still anchored on first use: "Vin" (a character name, anchored as "the
   seventeen-year-old"), real-world geography (Matagorda Bay, Republic of Texas), and the six
   district names on slide 7, which appear only as self-defining map labels ("Liberty — the port
   engine"). Fifth Corporate War, CBE, Serpentine, Free Current, Fourfold Fall, TRINITY GLASS, and
   CITYHEART are all held back until slide 10 or later.
5. **Word budget.** Every slide's prose is ≤ 60 words. Small mono data labels (definition chips,
   timeline stops, district tiles) sit outside that count, matching the brief's "depth in notes"
   intent — without them the invented terms couldn't be defined on first use.
6. **The Vin art.** The bible embeds the same JPEG twice; it was extracted once, lightly cropped
   to the sketchbook page (removing the floor visible at the photo's edge), and downscaled for the
   HTML embed (~290 KB base64) with the full-resolution crop in the PPTX. No retouching of the
   artwork itself. No AI imagery was generated; no official art or logos appear anywhere.
7. **Nicole's visual.** No concept art exists for Nicole, so her slide uses a styled typographic
   card (monogram + vestment palette from the bible), explicitly labeled as such.
8. **Attribution placement.** The required attribution block appears on the creator slide in both
   files, in the persistent HTML footer line, and in small print on the PPTX cover.
9. **Print behavior.** The HTML print stylesheet omits the expandable notes (clean PDF) and honors
   the spoiler gate (see above).
10. **Ledger scope.** The appendix shows 4 of the bible's 10 mystery-ledger rows (Domingo's
    survival, White Mesa, the Fourfold Fall's origin, "Is Vin alive?") — chosen to demonstrate the
    lie → truth → cost structure across city, war, systems, and family scales.
11. **In-world flavor reused, not invented**: the archive ID `CR-DOM-2084` on the cover comes from
    the bible's own cover.

## Fact checklist (locked canon verified in both files)

Universe/story naming · divergence permanent 2045 · timeline 1967–2084 · Fourfold Fall 23:48
May 31, 2084 on Washington / Night City / Nova York / Texas · Vin crosses at 00:17 June 1 ·
Compact expires midnight Dec 31, 2084 · Domingo City on Matagorda Bay, Republic of Texas · six
districts (Liberty, Domingo Center, Suntown, Dorado, Little Antonio, Linewood) + unrecognized
South Columbia · Vin b. 18 Dec 2066, 17, CBE-03, full-spectrum · Elik CBE-01, Blood, d. 2083 at
16 · Tomas CBE-02, 18 · Nicole b. 16 Feb 2068, 16, latent, never activated · Jaylin 53, Bloodline
CEO, uncle · Bloodline independent, Caribbean-rooted, HQ Domingo, never an Arasaka subsidiary ·
referendum passes 56.2% · ending: The Distributed City, Jaylin survives · Resonance is
bio-cybernetic, never supernatural · Domingo survives through civic action, distributed systems,
South Columbia routes, workers, and Resonators — not one corporation's heroism.

---

## Appendix — full slide copy (content outline)

Visible copy only; each slide also carries expandable notes (HTML) / speaker notes (PPTX).

**1 · Cover** — PITCH DOCUMENT · FILE CR-DOM-2084 / **Chromopunk: Resonators** / *Book One: The
Last Compact* / "The person is the final colony." / ⏱ 214 DAYS ON THE CLOCK · THE COMPACT EXPIRES
MIDNIGHT, DEC 31, 2084 / An original continuity of the Cyberpunk universe — unofficial fan work.

**2 · Logline** — "Days after an orbital nuclear catastrophe, a seventeen-year-old full-spectrum
**Resonator** escapes **Bloodline**, carrying the partial consciousnesses of two dead boys. As
**Domingo City** moves toward independence and Bloodline's emergency charter runs out, every
government, corporation, religion, movement, and family tries to decide what the three boys are
*for*." · Defs: RESONATOR — implants that turn a person's own biology into elemental-scale power ·
BLOODLINE — the corporation that builds them · DOMINGO CITY — Gulf metropolis, sovereign Republic
of Texas.

**3 · The hook** — Three boys share one body. Two of them are dead. / Their city has 214 days to
decide who owns its future. / Every power on the Gulf wants the same seventeen-year-old — each for
a different reason.

**4 · What is Chromopunk** — "One trunk. One clean break." Chromopunk inherits Cyberpunk's
foundation whole — Night City, the Corporate Wars, the DataKrash. In 2045 the branch becomes
permanent: space can be owned, and chrome becomes living tissue. Same wounds, different future.
Nothing official is overwritten — it is inherited, then left behind. · Diagram: trunk (NIGHT CITY ·
CORPORATE WARS · DATAKRASH) → 2045 → CHROMOPUNK branch / official canon continues.

**5 · The governing question** — "Does creating, protecting, financing, or depending upon
something grant the right to own it?" NATIONS ask it about the heavens. TEXAS asks it about
Domingo City. DOMINGO asks it about the territory beneath it. BLOODLINE asks it about Resonators.
VIN — the seventeen-year-old — asks it about his own body. *Every empire in the setting answers
yes. The story tests the answer.*

**6 · The claimed heavens** — In 1967 the Outer Space Treaty fails: settlement creates ownership.
The Cold War turns four-sided and refuses to die. The Moon and Mars become territory, then
industry, then battlefields. And redesigning the worker's body proves cheaper than repairing the
world. · Timeline: 1967 space law fails · 1996 American Collapse · 2022 DataKrash · 2033 Cold War
ends in fire · **2045 the branch locks** · 2054 Bloodline founded · 2075 the Compact signed · 2084
story year. · Clock chip: THE COMPACT — BLOODLINE'S EMERGENCY CHARTER · EXPIRES DEC 31, 2084.

**7 · Domingo City** — "Not Night City with a Gulf accent." A crescent metropolis of 8.6 million
wrapped around Matagorda Bay, inside the sovereign Republic of Texas. Caribbean, Latin American,
Black Texan, Tejano, maritime, hurricane, and labor identities — a founder's corporate project that
its workers turned into their own city. Now it wants out. · LIBERTY — the port engine · DOMINGO
CENTER — the corporate mask · SUNTOWN — the technology corridor · DORADO — the chrome district ·
LITTLE ANTONIO — the capital · LINEWOOD — where the city stores consequences · + SOUTH COLUMBIA —
the unrecognized territory that refuses to be a district at all.

**8 · Resonance** — "Resonance is not magic." Bloodline's BEA-V7 system activates a dormant
genetic trait and shapes it through living chrome — cybernetics grown into tissue. The result:
seven spectra of elemental-like force. Every effect has a biological source, a mechanism, an
environmental requirement, and a physical cost. No exceptions. That discipline is the pitch. ·
FIRE — stored heat · WATER — moves existing liquid · EARTH — vibration & magnetism · WIND —
pressure & flow · ICE — moves heat away · LIGHTNING — stored charge · BLOOD — circulation itself.

**9 · The Rot & Reprieve** — "Power increases dependency." Activation starts a progressive
degeneration — the Rot. One drug manages it: Reprieve, Bloodline's dependency medicine, dosed every
seventy-two hours through Bloodline-authenticated hardware. The harder a Resonator burns, the
faster the Rot advances. Medicine becomes leash, payroll, border, and sentence. *The world's
cruelest business model — and its central metaphor.* · Loop: ACTIVATE → EMPLOY → DEPEND → DECLINE →
CUSTODY.

**10 · The Three Subjects** — "Three boys, denied separate futures." ELIK BAPTISTE · CBE-01 ·
Blood spectrum — "The Heart." Wanted to go home and run a neighborhood clinic. Died in the program,
2083 — at sixteen. → CARE. / TOMAS VEGA · CBE-02 · Lightning spectrum — "Boy Thunder." A war hero
at fourteen, a legend built from edited footage. Eighteen. → GLORY. / VICENTE "VIN" RODRÍGUEZ ·
CBE-03 · full-spectrum host — The vessel built to carry both. Seventeen, and done being useful. →
CHOICE. · Def: CBE — Confluence Bioelectric Enhancement: Bloodline's classified program to run
three boys as one system. · Before every test they said each other's names aloud — "Elik Baptiste.
Tomas Vega. Vicente Rodríguez." Names before numbers.

**11 · Vin** — (concept art) Dark brown skin. Gold curls — a CBE side effect, not a choice; his
hair was dark before. A lean seventeen-year-old frame under disproportionately heavy
black-and-green confluence hardware. The silhouette reads as a weapon. The face stays visibly
young. His want: *personhood without assigned purpose.* · BORN 18 DEC 2066 · CBE-03 · SEVEN
SPECTRA · CROSSED OUT OF CUSTODY 00:17, JUNE 1, 2084. · Caption: Concept art: [artist credit TBD].

**12 · Nicole** — Sixteen. Vin's sister. High Priestess of the Serpentine — the Resonator faith
and mutual-aid movement — and a public saint whose authority grew around a managed lie: she was
told her brother died in 2079. Now he is back. Brother, institution, symbol — *she can keep two.* ·
BORN 16 FEB 2068 · LATENT CARRIER · NEVER ACTIVATED · HIGH PRIESTESS, 2082.

**13 · The opposition** — "No cartoon villains. That is the point." JAYLIN RODRÍGUEZ — Bloodline
CEO · Vin and Nicole's uncle · 53. Most dangerous when he believes he is being merciful — and he is
partially correct: unmanaged Resonance really would cost lives. He loves them. That is the problem.
/ SABINE HARROW — THE LAW: never argues Vin is property — argues the implants inside him are
regulated corporate infrastructure. / GIDEON RUSK — THE FORCE: recover the asset when practical;
terminate when necessary. / DR. LUCIEN KADE — THE ARCHITECT: wants the three boys fused into one
system. "Individuality is an evolutionary inconvenience."

**14 · The engine** — "A six-month fuse." 23:48 · MAY 31, 2084 — The Fourfold Fall: orbital
nuclear strikes on Washington, Night City, Nova York, and Texas. Domingo survives — barely, and not
by one corporation's heroism. / MIDNIGHT · DEC 31, 2084 — The Compact expires: Bloodline's
emergency charter runs out as the city's independence referendum lands. Three legal orders collide
at midnight. · One boy. Six claims: INFRASTRUCTURE — Bloodline · EVIDENCE — Texas · LEVERAGE —
Domingo · TESTIMONY — Free Current, the Resonator rights movement · REVELATION — the Serpentine ·
FAMILY — the mothers of the dead.

**15 · Structure** — "Seven parts. One clock." I THE BREAK (May 31–Jun 10) · II SEVEN PASSPORTS
(Jun–Jul) · III REPRIEVE (Aug) · IV THE FOUNDER'S VAULT (Sep) · V MATAGORDA (Oct) · VI THE
REFERENDUM (Nov) · VII THE LAST COMPACT (Dec). A prologue at White Mesa, 2081. An epilogue on
January 1, 2085. Beneath the parts sits a complete fifty-chapter map — every chapter with a
viewpoint, a reversal, and a consequence. It exists. It is not in this deck.

**16 · Themes & mirrors** — "The politics are the person." Texas claims Domingo: it built the
city, and needs it ↔ Bloodline claims Vin: it built his body, and needs it. / Domingo claims South
Columbia to survive the storms ↔ Elik and Tomas seize Vin's controls to keep the body alive. /
TRINITY GLASS — the orbital deterrent — splits launch authority among three rivals ↔ CITYHEART —
the city's life-support architecture — splits command among three boys. · "Freedom is not the
absence of dependence. Freedom is the right to negotiate dependence without becoming property."

**17 · Tone & comps** — "Street-level intimacy inside continental-scale politics." Cyberpunk:
Edgerunners — warmth that makes the cost land · Arcane — institutions that love people badly · The
Expanse — politics that behave like weather · Fullmetal Alchemist: Brotherhood — two brothers, one
body's consequences. (Suggested comps — the creator may edit this slate.)

**18 · Beyond Book One** — "Built for more." The recognition crisis — three legal orders occupy
one coastline · The fight over Bloodline's fragments · Off-world Resonator programs · Hidden copies
of Elik and Tomas — somewhere, a defector kept unauthorized backups of two dead boys. · SEQUEL
CLOCKS: ALREADY WOUND.

**19 · Creator & attribution** — Created by [name / handle TBD] · Contact: [contact / links TBD] ·
WORLD BIBLE: 12 VOLUMES · 57 FILES · 1967–2084 · CONCEPT ART: [ARTIST CREDIT TBD] · full
attribution block (unofficial fan continuity; inspired by the Cyberpunk universe created by Mike
Pondsmith, published by R. Talsorian Games, with game-world development by CD PROJEKT RED; no
ownership claimed; non-commercial; no official logos or artwork reproduced).

**20 · Spoiler gate / divider** — "SPOILERS — BOOK ONE ENDING." Publishers and studio readers: the
ending is here, on purpose. Fans and collaborators: what follows reveals how Book One ends. Opt in,
or stop here. · T–0 · MIDNIGHT, DEC 31, 2084. (HTML: two-step button + confirm.)

**21 · Appendix A — The Distributed City** — Vin, Elik, and Tomas divide CITYHEART's authority
across district utilities, public hospitals, worker networks, Resonator cooperatives, and South
Columbia. No single institution can hold the city's life again. The referendum passes: 56.2%.
Independence is declared January 1, 2085. Jaylin survives to face consequence — still arguing the
city will prove him right. · THE PRICE: blackouts and medical failures in transition; some Grid
residents — terminal patients wired into Bloodline's deep infrastructure — die, because the system
was designed to punish removal. No clean victory: Jaylin's warnings were not entirely false.

**22 · Appendix B — The mystery ledger** — Public lie → hidden truth → cost of truth. WHY DID
DOMINGO SURVIVE? Bloodline's flawless defense → Jaylin aimed CITYHEART's protection at the
strategic core; poorer districts absorbed the rest → the city must admit survival was courage and
calculated sacrifice. / WHAT HAPPENED AT WHITE MESA? Boy Thunder's finest hour → the ordered
overload killed civilians, prisoners, and his own cadets; Bloodline edited his memory and the
footage → Tomas must own the act without carrying it alone. / WHO LAUNCHED THE FOURFOLD FALL? Each
corporation blames the others → the shared deterrent self-escalated after someone seeded authentic
launch authority across all three networks → no single enemy can absorb the blame. / IS VIN ALIVE?
Dead in gang territory, 2079 → his uncle held him for five years → Nicole's public sainthood stands
on a managed lie. · *Every answer changes a relationship or forces a decision. Answers are never
trivia.*

---

*Chromopunk: Resonators is an unofficial fan-created alternate continuity inspired by the
Cyberpunk universe created by Mike Pondsmith, published by R. Talsorian Games, with game-world
development by CD PROJEKT RED. No ownership is claimed over official names, settings, or
terminology. Non-commercial creative-development project.*
