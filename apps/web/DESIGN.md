---
name: Cadastre
description: The Register — a Swiss International Typographic system for government document verification.
colors:
  paper: "oklch(0.988 0.0015 250)"
  ink: "oklch(0.235 0.012 262)"
  signal-blue: "oklch(0.455 0.135 256)"
  muted-ink: "oklch(0.505 0.014 262)"
  rule: "oklch(0.905 0.004 262)"
  rule-strong: "oklch(0.82 0.006 262)"
  selection-tint: "oklch(0.945 0.006 256)"
  ok: "oklch(0.55 0.11 158)"
  ok-ink: "oklch(0.44 0.10 158)"
  issues: "oklch(0.62 0.12 72)"
  issues-ink: "oklch(0.475 0.10 66)"
  incomplete: "oklch(0.55 0.15 30)"
  incomplete-ink: "oklch(0.455 0.145 30)"
  failed: "oklch(0.50 0.185 25)"
  failed-ink: "oklch(0.44 0.175 25)"
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
  all: "0rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.all}"
    padding: "0 14px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.all}"
    padding: "0 14px"
    height: "32px"
  disposition-chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.all}"
    padding: "2px 0"
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
**visible modular grid drawn in hairline rules**, not from cards or shadow. Type
does the composing: a single objective grotesk (Geist) for language, a
monospace (Geist Mono) for every machine-read value, and one federal-blue signal
reserved for selection and the primary action. Depth is flat at rest; the page
reads like paper under office light. Numbers are always tabular, because this is
a document of record and columns must align down the page.

Because the instrument backs a human decision, the world never dramatizes a
verdict. Disposition is stated in ink-toned, stamp-like marks paired with words —
never celebrated, never color alone.

**Key Characteristics:**

- The page is a ruled register, not a deck of cards.
- Hairline rules are the grid; they are structure, not decoration.
- Tabular monospace for every ID, date, count, and confidence value.
- One signal color; disposition ink is desaturated and always labelled.
- Flat at rest; light ground forced by the desk-and-daylight use scene.
- Trilingual by construction (RU / EN / AZ), including Cyrillic.

## Colors

A near-monochrome paper-and-ink field, disciplined by one signal blue and a
narrow band of official disposition inks.

### Primary

- **Federal Registry Blue** (`oklch(0.455 0.135 256)`): the single signal.
  Selection, primary action, focus ring, active nav. Kept scarce — it means
  "this, now," and its rarity is the point.

### Neutral

- **Unprinted Paper** (`oklch(0.988 0.0015 250)`): the ground of every surface.
- **Ink** (`oklch(0.235 0.012 262)`): primary text and markers.
- **Muted Ink** (`oklch(0.505 0.014 262)`): secondary text, column labels,
  metadata. Tuned to clear 4.5:1 on paper.
- **Rule** (`oklch(0.905 0.004 262)`) / **Rule Strong** (`oklch(0.82 0.006 262)`):
  the hairline grid — row dividers and structural/header rules respectively.
- **Selection Tint** (`oklch(0.945 0.006 256)`): the blue-cast wash on a
  selected or hovered register row.

### Disposition (semantic, ink-toned)

- **OK** (`oklch(0.55 0.11 158)`, ink `oklch(0.44 0.10 158)`): package clears.
- **Issues Found** (`oklch(0.62 0.12 72)`, ink `oklch(0.475 0.10 66)`): ochre.
- **Incomplete Package** (`oklch(0.55 0.15 30)`, ink `oklch(0.455 0.145 30)`): clay.
- **In Progress** (uses Registry Blue): the pipeline is still running.
- **Failed** (`oklch(0.50 0.185 25)`, ink `oklch(0.44 0.175 25)`): pipeline error.

### Named Rules

**The One Signal Rule.** Registry Blue appears on selection, the primary action,
and focus — nowhere else. If two blue things compete on a screen, one is wrong.

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

**Flat by default.** Surfaces sit on the page; separation is drawn with hairline
rules and tonal shifts, never resting shadow. The only shadow in the system is
on transient overlays that genuinely leave the page — dropdown menus, the mobile
sheet, popovers — and it is real (offset + soft blur), never a zero-offset halo.

### Shadow Vocabulary

- **Overlay** (`0 1px 2px oklch(0.235 0.012 262 / 0.08), 0 12px 28px -8px oklch(0.235 0.012 262 / 0.18)`):
  the single lift, for menus/sheets/popovers only.

### Named Rules

**The Flat-Page Rule.** If it is part of the register, it casts no shadow. If it
casts a shadow, it has left the register (a menu, a sheet) and will return.

## Shapes

**The Square Rule.** Radius is `0` everywhere — buttons, inputs, chips, avatars,
the table. The register is ruled, not rounded. Corners are honest right angles;
borders are 1px hairlines in `rule` / `rule-strong`. The only non-rectangular
marks are the small filled disposition squares and functional iconography drawn
in a thin, grotesk-matched line.

## Components

### Buttons

- **Shape:** square (0 radius), 1px border where outlined.
- **Primary:** Registry Blue ground, paper text, `0 14px` / 32px tall. The one
  blue element in a region.
- **Outline / Ghost:** paper ground, ink text, hairline border; hover fills with
  `muted`. Used for everything that is not _the_ action.
- **Hover / Focus:** hover shifts ground tonally; focus draws a 2px Registry Blue
  ring flush to the square edge.

### Disposition Chip (signature)

A 7px filled square in the disposition color + the status word in disposition
ink + optional tabular count. No pill, no background fill, no rounded badge. This
is the register's stamp.

### Register Table

- Hairline row dividers (`rule`); a heavier `rule-strong` under the header.
- Header cells use the uppercase **Label** style; data cells use **Data** (mono)
  for IDs/dates/counts and **Body** (sans) for names.
- Row hover and selection wash in `selection-tint`; the active row carries a 2px
  Registry Blue marker on its leading edge (a functional rule, not decorative
  border-left kitsch).
- **Stage bar:** in-progress packages show a segmented 6-cell bar (one cell per
  pipeline stage: OCR, Classify, Extract, Completeness, Rules, Report), filled
  cells in ink, current cell in Registry Blue — square segments, never a ring.

### Inputs / Search

- Paper ground, hairline border, square. Focus draws the Registry Blue ring.
  Search pairs a thin leading glyph with mono input for IDs.

### Navigation (register cover)

- Flush-left list, Body type, square hit areas. Active item: paper ground, ink
  text, a 2px Registry Blue leading rule. Inactive: muted ink, hover fills
  `sidebar-accent`.

## Do's and Don'ts

### Do:

- **Do** draw structure with hairline rules and the module; let the grid show.
- **Do** set every ID, date, count, and confidence in tabular Geist Mono.
- **Do** keep Registry Blue scarce — selection, primary action, and focus only.
- **Do** pair every disposition color with a marker and a word.
- **Do** keep the page flat; reserve the one overlay shadow for menus and sheets.
- **Do** design every string to translate across RU / EN / AZ and re-flow.

### Don't:

- **Don't** introduce rounded corners, resting shadows, or floating cards.
- **Don't** add a second accent, a gradient, or a decorative chart.
- **Don't** phrase or style any output as an approval, verdict, or recommendation
  to act — the register reports; the inspector decides.
- **Don't** convey status by color alone, or with a candy-colored pill.
- **Don't** bring in a display serif or a third type voice; two voices only.
