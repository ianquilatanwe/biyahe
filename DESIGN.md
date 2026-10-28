---
name: Biyahe
description: Ian Quilatan's portfolio as a jeepney loop round a low-poly island, its HTML painted like route signage.
colors:
  ink: "#1d2433"
  sky: "#f6c9a1"
  sea: "#0f5560"
  red: "#c41e30"
  red-deep: "#9e1426"
  yellow: "#ffc93c"
  muted: "#4b3a2e"
  paper: "#fffaf2"
  roof-teal: "#2a9d8f"
typography:
  display:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3rem)"
    fontWeight: 600
    lineHeight: 1
  headline:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Rubik, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-lead:
    fontFamily: "Rubik, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  key: "4px"
  plate: "8px"
  card: "12px"
  round: "9999px"
spacing:
  plate-x: "16px"
  card: "20px"
  card-sm: "24px"
  gutter: "16px"
  gutter-sm: "32px"
  route-gap: "48px"
  route-gap-sm: "64px"
components:
  sign:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0 16px"
    height: "44px"
  sign-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0 16px"
    height: "44px"
  sign-red:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0 16px"
    height: "44px"
  plate:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
  plate-heading:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.red-deep}"
    typography: "{typography.headline}"
    rounded: "{rounded.plate}"
    padding: "6px 20px"
  stop-strip:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    padding: "0 20px"
    height: "44px"
  ticket:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  route-marker:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.round}"
    size: "44px"
---

# Design System: Biyahe

## Overview

**Creative North Star: "The Painted Route Board"**

Every piece of HTML on Biyahe is signage off a Filipino jeepney: yellow route plates with an ink rim, a solid ink ledge each plate stands on, red stop strips, an ink road with a yellow dashed centre line, and the jeepney's red-yellow-teal flank stripes where one part of the page meets the next. The HTML was brought into the island's world rather than laid over it, so its colours are the island's own (the sky, the jeepney's red, its route boards, the sea at the pier).

The surface is bold, flat and hand-painted. Colour is solid, never gradient or glass; depth is a printed ledge, never a blur. Labels are set in a round, friendly display face; reading text is a plain, sturdy sans. Density is low: one action per plate, short lines, large touch targets.

**Key Characteristics:**
- Yellow plates with a 2px ink rim and a 3px solid ink ledge; pressing a plate drops it into its ledge.
- Jeepney red for the one most important action on a screen and for the "Stop N · landmark" strip.
- Ink road with yellow 14/12 dashes as the page's connecting line, from the island down the route board to the pier.
- Fredoka for every label and heading, Rubik for reading text.
- Drawn SVG icons in one 2.25px round stroke; drawn SVG cursors in the plate colours.

## Colors

A sunset-island palette: peach ground, ink line work, signboard yellow, jeepney red, deep sea for the end of the route.

### Primary
- **Route-Board Yellow** (`yellow`): every plate and sign face, the road's dashes, the in-world tap chevrons, the focus halo, text selection. Ink on it is 10.1:1.
- **Jeepney Red** (`red`): the one action that matters most on a screen (Hire me, Open), stop strips, the end-of-route flag marker. White on it is 5.9:1. Never as text on yellow (3.8:1).
- **Sign-Writer Red** (`red-deep`): red lettering on a yellow plate (the "Biyahe" title, the "Projects" heading, the loader's plate). 5.3:1 on yellow.

### Secondary
- **Pier Sea** (`sea`): the footer, the last stop. White on it is 8.4:1; white at 75% (fine print) is about 5.5:1.
- **Roof Teal** (`roof-teal`): the jeepney's roof; in the HTML only as the third band of the flank stripes. Decorative only, never text or a surface carrying text.

### Neutral
- **Asphalt Ink** (`ink`): all text on light grounds, every rim and ledge, the road, the dialog backdrop (at 50%), the focus outline. 10.2:1 on sky, 14.9:1 on paper.
- **Sunset Sky** (`sky`): the island's sky and the page ground below it; also the browser theme colour.
- **Ticket Paper** (`paper`): card faces, quiet signs (Project list, LinkedIn, GitHub), off-screen edge markers, the driving hint.
- **Sunset Brown** (`muted`): secondary text (stack lines, "Live link coming soon"). 7.1:1 on sky, 10.4:1 on paper.

### Named Rules
**The Island Palette Rule.** Every colour comes from the island or the jeepney. A new colour needs a source in `src/components/world` first.

**The Red Lettering Rule.** Red text on yellow is always `red-deep`; plain `red` is a fill, never lettering on a plate.

**The One Red Plate Rule.** A screen region has at most one red sign: the action that matters most there. Everything else is yellow or paper.

## Typography

**Display Font:** Fredoka (next/font, `--font-display`)
**Body Font:** Rubik (next/font, `--font-sans`, the page default)

**Character:** Fredoka's rounded, heavy forms read like sign-writer lettering on a route board; Rubik is a plain, slightly rounded sans that stays out of the way for reading.

### Hierarchy
- **Display** (Fredoka 600, 36px to 48px, tight): the Pier's "About Ian" heading, white on sea.
- **Headline** (Fredoka 600, 30px to 36px): the "Projects" plate heading, red-deep on yellow.
- **Title** (Fredoka 600, 24px to 30px, line-height 1.25, balanced): project titles on tickets.
- **Body** (Rubik 400, 16px; lead 18px): blurbs and intros, capped at about 65ch (`max-w-prose`/`max-w-xl`), pretty-wrapped.
- **Label** (Fredoka 600, 14px; stop buttons 15px; header title 20px): every sign, plate, strip and key cap. Sentence case, no uppercase.
- **Fine print** (Rubik 400, 14px, `muted` or white at 75%): stack lines and the footer note.

### Named Rules
**The Sign-Writer Rule.** Anything you click, or that names a place, is Fredoka. Anything you read in sentences is Rubik.

## Layout

The first screen is the island, full-bleed at `100svh`, with HTML pinned to its edges: the route plate top-left and two signs top-right (header z 20), the driving hint and the stop strip bottom-centre (z 10, respecting the safe-area inset), in-world signs between (z 1 to 8), loader at z 9. In-world signs are clamped inside the uncovered band (below about 124 to 130px, above the bottom 120 to 190px, 64 to 90px off the sides).

Below it, the route board is a single column in a 64rem container (16px gutters, 32px from 640px). A two-column grid puts the stop number on a vertical road (44px column, 52px from 640px) beside each ticket, 48px apart (64px from 640px). From 768px the ticket puts its screenshot beside its text. The road runs on past the last ticket, through the stripes, and ends at the pier's flag.

Short labels swap in on phones ("List", "Hire me") rather than wrapping.

## Elevation & Depth

Depth is printed, not lit. Every raised piece sits on a solid ink ledge directly below it: a hard vertical offset with no blur and no sideways shift. The ledge is the world's own device, the same ink underside the in-world tap chevrons carry in 3D and the cursor carries as its drop. The only translucency is the dialog's 50% ink backdrop; there is no blur anywhere.

### Shadow Vocabulary
- **Sign ledge** (`box-shadow: 0 3px 0 var(--color-ink)`): signs, the header route plate, route markers, the loader's plate.
- **Heading ledge** (`box-shadow: 0 4px 0 var(--color-ink)`): the "Projects" plate heading.
- **Ticket ledge** (`box-shadow: 0 6px 0 var(--color-ink)`): tickets, the stop dialog, the no-WebGL message.

### Named Rules
**The Ledge Rule.** Ledges are solid ink, straight down, sized by importance (3, 4, 6px). Signs press down into theirs (move 3px, ledge disappears); plates that only label keep the ledge but never move. No soft shadows, no coloured ledges, no sideways offsets.

## Shapes

Plates are gently rounded rectangles (8px) with a 2px ink rim; tickets are a little rounder (12px) with a heavier 3px rim. Stop numbers and the end flag sit in ink-rimmed circles. Key caps are 4px. Inside a ticket, the screenshot is separated by a 3px ink rule, not a gap. In-world signs grow a triangular tail in the plate's own fill and rim that points at the landmark.

## Components

### Signs (buttons and links)
Tactile and pressable, like a painted board you push.
- **Shape:** 8px corners, 2px ink rim, 3px ink ledge, at least 44px tall (40px in the header row, 36px in-world).
- **Yellow sign:** default for links and stop buttons; ink Fredoka 600 label, 16px side padding, drawn icon after the text with a 6px gap.
- **Paper sign:** the quiet variant (Project list, secondary contacts, off-screen markers).
- **Red sign:** the one important action; white label.
- **Hover / Active:** lifts 1px on hover; on press drops 3px and the ledge vanishes (transform transition only).
- **Focus:** the global ring, 3px ink outline at 2px offset plus a 6px yellow halo, so it shows on red, on sky and on the island.

### Plates (labels)
Same face and rim as a sign, no press: the header route plate ("Biyahe | Ian Quilatan, frontend developer", split by a 2px ink rule), the "Projects" heading, the driving hint (paper), key caps and the route-board stop numbers.

### Ticket (project card)
One component for the island's dialog and the route board, so they can't drift.
- **Corner Style:** 12px, clipped.
- **Background:** paper, ink text, 3px ink rim, 6px ink ledge.
- **Header:** a red "Stop N · landmark" strip, 44px tall, white Fredoka label; the dialog's close button sits at its right.
- **Internal Padding:** 20px (24px from 640px). Links in a wrapping row, 12px gaps; a missing link shows as a dashed 50%-ink outline, not a disabled sign.
- **Dialog:** native modal, up to 34rem wide, scrolls inside when taller than the screen.

### Navigation (the stop strip)
A row of yellow signs strung along a short ink road with yellow dashes; wraps to two rows on a phone with the road between them.

### In-world stop signs
Yellow signs floating over each landmark with a tail pointing down at it, bobbing 4px. Parked at a stop the sign turns red and reads "Open …" with an E key cap. A landmark out of frame keeps its sign at the screen edge, turned paper, its tail aimed off-screen at the landmark. Signs shrink to 85% with distance.

### Road paint
The ink road with a 3px yellow dash (14 on, 12 off) runs horizontally under the island and vertically down the route board. The flank stripes (red 10px, yellow 6px, teal 10px on ink, 3px gaps) mark each seam between island, board and pier.

### Cursor and tap marker
The cursor is a drawn arrow: a yellow face with ink rim and ink drop by default, red with a white rim over anything clickable; hotspot at the tip (3, 2). A tap drops four yellow chevrons with an ink ledge on the ground, which land oversized, settle, then pulse inward until the jeepney arrives.

### Motion
- Press: transform transition on signs (1px lift, 3px press).
- Bob: in-world signs, 4px, 1.4s ease-in-out, looping.
- Drive: the loader's jeepney crosses its dashed road, 2.4s linear, looping.
- Fade: loader and driving hint fade out over 500ms.
- Tap marker: lands at 1.9x, settles with exponential decay, then pulses ±14%.
- Reduced motion: no bob, no drive (the jeepney parks centred), no fades, no landing or pulse, no smooth scroll.

## Do's and Don'ts

### Do:
- **Do** build every new control from the sign family: yellow by default, paper when quiet, red for the single most important action.
- **Do** put red lettering on yellow only in `red-deep`.
- **Do** give raised pieces an ink ledge sized 3, 4 or 6px, straight down, and make only pressable signs move.
- **Do** set labels and place names in Fredoka 600 and sentences in Rubik.
- **Do** draw icons as inline SVG in the 2.25px round stroke and let the text beside them carry the meaning.
- **Do** connect sections with the ink road and mark seams with the flank stripes.
- **Do** give every animation a still version under reduced motion.

### Don't:
- **Don't** use frosted or blurred glass panels, soft or blurred shadows, or gradients on HTML surfaces.
- **Don't** make pill-shaped buttons or chips; signs are 8px plates. Circles are for route markers only.
- **Don't** lay projects out as a card grid; they are stops on one route.
- **Don't** use plain `red` for text on yellow, or teal for anything but the stripes.
- **Don't** introduce a colour that isn't on the island or the jeepney.
