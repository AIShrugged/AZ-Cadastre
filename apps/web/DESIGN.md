---
name: Cadastre
description: The Register, refreshed — a Swiss International Typographic system for government document verification, softened toward a contemporary product surface.
colors:
  paper: "oklch(0.984 0.003 260)"
  surface-raised: "oklch(1 0 0)"
  ink: "oklch(0.235 0.014 264)"
  signal-indigo: "oklch(0.505 0.185 266)"
  accent-2: "oklch(0.62 0.115 214)"
  accent-2-ink: "oklch(0.47 0.09 216)"
  muted-ink: "oklch(0.505 0.016 264)"
  rule: "oklch(0.922 0.004 264)"
  rule-strong: "oklch(0.868 0.006 264)"
  selection-tint: "oklch(0.955 0.017 266)"
  ok: "oklch(0.60 0.13 160)"
  ok-ink: "oklch(0.45 0.10 160)"
  issues: "oklch(0.68 0.14 74)"
  issues-ink: "oklch(0.475 0.10 66)"
  incomplete: "oklch(0.60 0.16 32)"
  incomplete-ink: "oklch(0.465 0.145 30)"
  failed: "oklch(0.55 0.20 26)"
  failed-ink: "oklch(0.46 0.185 25)"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.1rem + 1.4vw, 2rem)"
    fontWeight: 560
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, sans-serif"
    fontSize: "1rem"
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0em"
  data:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 450
    lineHeight: 1.3
    letterSpacing: "0em"
  label:
    fontFamily: "Geist Variable, ui-sans-serif, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.09em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-indigo}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.signal-indigo}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "32px"
  input-search:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px 0 32px"
    height: "32px"
  badge-demo:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
---

# Design System: AZ-Cadastre

## Overview

**Creative North Star: "The Register."**

AZ-Cadastre is an official register rendered as software. Every verification
package is an entry; the interface is the ruled page it is written on. The world
is the Swiss International Typographic tradition — the identity-program language
of credible public institutions — chosen because it is what a legally
accountable government instrument should look like, and because it refuses the
generic SaaS-admin dashboard (Inter on floating white cards over gray, candy
status pills, a decorative chart) outright.

The system is objective, quiet, and dense-by-consent. Structure comes from a
**visible modular grid drawn in hairline rules**, not from a deck of cards. Type
does the composing: a single objective grotesk (Geist) for language, a
monospace (Geist Mono) for every machine-read value, and one indigo signal
reserved for selection and the primary action — answered, sparingly, by a quiet
teal second accent that never carries status. Depth is calm: flat panels, a
measured offset-and-blur lift on what genuinely rises (the primary action,
overlays), and corners softened to a gentle 8px so the page reads current rather
than severe. Numbers are always tabular, because this is a document of record and
columns must align down the page.

Because the instrument backs a human decision, the world never dramatizes a
verdict. Disposition is stated in ink-toned status dots paired with words —
never celebrated, never color alone.

**Key Characteristics:**

- The page is a ruled register, not a deck of cards.
- Hairline rules are the grid; they are structure, not decoration.
- Tabular monospace for every ID, date, count, and confidence value.
- One indigo signal + a quiet teal accent; disposition ink is always labelled.
- Gently rounded, calmly elevated; light ground under the desk-and-daylight scene.
- Trilingual by construction (RU / EN / AZ), including Cyrillic.

## Colors

A near-monochrome paper-and-ink field, disciplined by one indigo signal, a quiet
teal second accent, and a narrow band of official disposition inks.

### Primary

- **Registry Indigo** (`oklch(0.505 0.185 266)`): the primary signal.
  Selection, primary action, focus ring, active nav. Kept scarce — it means
  "this, now," and its rarity is the point.
- **Teal Accent** (`oklch(0.62 0.115 214)`, ink `oklch(0.47 0.09 216)`): the quiet
  second accent. Supporting emphasis, provenance highlights, and the brand
  gradient on the wordmark — never disposition, never competing with indigo.

### Neutral

- **Paper Canvas** (`oklch(0.984 0.003 260)`): the ground of every surface.
- **Raised Surface** (`oklch(1 0 0)`): pure white for lifted media and overlays.
- **Ink** (`oklch(0.235 0.014 264)`): primary text and markers.
- **Muted Ink** (`oklch(0.505 0.016 264)`): secondary text, column labels,
  metadata. Tuned to clear 4.5:1 on canvas.
- **Rule** (`oklch(0.922 0.004 264)`) / **Rule Strong** (`oklch(0.868 0.006 264)`):
  the hairline grid — row dividers and structural/header rules respectively.
- **Selection Tint** (`oklch(0.955 0.017 266)`): the indigo-cast wash on a
  selected or hovered register row.

### Disposition (semantic, ink-toned)

- **OK** (`oklch(0.60 0.13 160)`, ink `oklch(0.45 0.10 160)`): package clears.
- **Issues Found** (`oklch(0.68 0.14 74)`, ink `oklch(0.475 0.10 66)`): amber.
- **Incomplete Package** (`oklch(0.60 0.16 32)`, ink `oklch(0.465 0.145 30)`): clay.
- **In Progress** (uses Registry Indigo): the pipeline is still running.
- **Failed** (`oklch(0.55 0.20 26)`, ink `oklch(0.46 0.185 25)`): pipeline error.

### Named Rules

**The One Signal Rule.** Registry Indigo carries selection, the primary action,
and focus — nowhere else. The teal accent is the only other brand hue, used
sparingly for support; disposition inks are their own reserved band. If two
indigo things compete for "the action" on a screen, one is wrong.

**The Status-Never-Alone Rule.** A disposition is always a marker **plus** a
word. Color never carries meaning by itself — required for the colorblind, and
for a document that must survive being printed in grayscale.

## Typography

**Display / Body Font:** Geist Variable (with ui-sans-serif, system-ui fallback)
**Data / Measure Font:** Geist Mono Variable (with ui-monospace fallback)

**Character:** One objective grotesk carries all language; its monospace sibling
carries all machine-read data. Geist is chosen for its neutral grotesk voice,
its true tabular figures, and its full Cyrillic coverage — a hard requirement of
the trilingual RU/EN/AZ interface. No display serif, no second personality face.

### Hierarchy

- **Display** (560, clamp(1.5–2rem), -0.02em): page title in the header strip.
- **Title** (550, 1rem, -0.01em): section and panel headings.
- **Body** (400, 0.875rem, 1.45): labels, descriptions, cell text.
- **Data** (450, 0.8125rem, mono, tabular): IDs, dates, counts, confidence.
- **Label** (500, 0.6875rem, +0.09em, uppercase): column headers and section
  markers only.

### Named Rules

**The Tabular Rule.** Every number a reader might scan or compare down a column —
IDs, dates, counts, confidence — is set in Geist Mono with `tabular-nums`. Prose
numbers may stay in the sans.

**The Two-Voice Rule.** Sans for language, mono for data. A third face is a
defect, not a decision.

## Layout

A fixed left **register cover** (sidebar: wordmark, navigation, locale, inspector)
meets a main column composed on a strict module. The main column is a header
strip (page title, search, primary action) over a **filter/segment rail** over
the **register table** over pagination. Content aligns to a single spacing
rhythm (4/8/12/16/24px); there is always more space above a heading than below
it. Density is adaptive: a comfortable default row height with a compact toggle,
scaling from dozens to hundreds of entries via pagination. On narrow screens the
register re-lays from ruled columns to a single-column stack of entries and the
cover collapses into a sheet.

## Elevation & Depth

**Flat panels, measured lift.** The register itself stays flat — separation
inside it is drawn with hairline rules and tonal shifts, not resting shadow. What
genuinely rises off the page earns a real, offset-and-blur elevation: the primary
action (a soft indigo-tinted lift), lifted media, and transient overlays —
dropdown menus, the mobile sheet, popovers. No zero-offset colored halos.

### Shadow Vocabulary

- **sm** (`0 1px 2px …/0.06, 0 2px 6px -2px …/0.08`): quiet lift for small raised
  media (empty-state tile, avatars that rise).
- **lift** (`0 1px 3px …/0.07, 0 8px 22px -8px …/0.16`): the primary action on
  hover, and mid-weight raised surfaces.
- **primary** (`0 1px 2px oklch(.30 .18 266/.30), 0 8px 18px -8px oklch(.40 .18 266/.45)`):
  the indigo-tinted lift under the primary button and the wordmark mark.
- **overlay** (`0 1px 2px …/0.08, 0 14px 32px -10px …/0.20`): menus, sheets,
  popovers that leave the page.

### Named Rules

**The Earned-Lift Rule.** Rows, cells, and rails of the register cast no shadow —
they are the flat page. A shadow means the element has risen above the page (the
primary action, a menu, a sheet); it is always offset + soft blur, never a flat
halo.

## Shapes

**The Gentle-Radius Rule.** An 8px base radius runs through the interactive layer
— buttons, inputs, toggles, the sidebar trigger, raised media (4/6/8/12px by
scale; badges are pills). The register table stays edge-to-edge and ruled: rows
and cells are not boxed. Borders are 1px hairlines in `rule` / `rule-strong`.
Status is a round dot; iconography is a thin, grotesk-matched line. Rounded just
enough to read current — never a bubbly, over-rounded consumer look.

## Components

### Buttons

- **Shape:** 8px radius (`rounded-lg`), 1px border where outlined.
- **Primary:** Registry Indigo ground, paper text, `0 14px` / 32px tall, carrying
  the soft **primary** lift (deepening to **lift** on hover). The one indigo
  element in a region.
- **Outline / Ghost:** surface ground, ink text, hairline border; hover fills
  with `muted`. Used for everything that is not _the_ action.
- **Hover / Focus:** hover shifts ground tonally; focus draws a 3px Registry
  Indigo ring on the rounded edge.

### Disposition Mark (signature)

An 8px round dot in the disposition color + the status word in disposition ink +
optional tabular count. No background fill, no candy pill. The in-progress dot
pulses. Marker + word always travel together — this is the register's stamp.

### Register Table

- Hairline row dividers (`rule`); a heavier `rule-strong` under the header.
- Header cells use the uppercase **Label** style; data cells use **Data** (mono)
  for IDs/dates/counts and **Body** (sans) for names.
- Row hover and selection wash in `selection-tint`; the active row carries a 2px
  Registry Indigo marker on its leading edge (a functional rule, not decorative
  border-left kitsch).
- **Stage bar:** in-progress packages show a segmented 6-cell bar (one cell per
  pipeline stage: OCR, Classify, Extract, Completeness, Rules, Report), filled
  cells in ink, current cell in Registry Indigo — rounded pill segments, never a
  single ring.

### Inputs / Search

- Surface ground, hairline border, 6px radius. Focus draws the Registry Indigo
  ring. Search pairs a thin leading glyph with mono input for IDs.

### Navigation (register cover)

- Flush-left list, Body type, rounded hit areas. Active item: `sidebar-accent`
  ground, ink text, a rounded Registry Indigo leading pill. Inactive: muted ink,
  hover fills `sidebar-accent`.

## Do's and Don'ts

### Do:

- **Do** draw structure with hairline rules and the module; let the grid show.
- **Do** set every ID, date, count, and confidence in tabular Geist Mono.
- **Do** keep Registry Indigo scarce — selection, primary action, and focus only.
- **Do** pair every disposition color with a round dot and a word.
- **Do** keep the register flat; reserve real offset+blur lift for the primary
  action, raised media, and overlays.
- **Do** round the interactive layer gently (4/6/8/12px); keep the table ruled.
- **Do** design every string to translate across RU / EN / AZ and re-flow.

### Don't:

- **Don't** box register rows into floating cards, or over-round toward a bubbly
  consumer look — the table stays ruled and edge-to-edge.
- **Don't** let the teal accent carry status or crowd the indigo signal, and no
  decorative chart.
- **Don't** phrase or style any output as an approval, verdict, or recommendation
  to act — the register reports; the inspector decides.
- **Don't** convey status by color alone, or with a candy-colored pill.
- **Don't** bring in a display serif or a third type voice; two voices only.
