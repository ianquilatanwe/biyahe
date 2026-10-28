# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Two audiences, equal priority:
- Upwork clients who followed the link in Ian's profile or proposal and are deciding whether to hire him for a small, fixed-price frontend task.
- Recruiters and agencies skimming for skill and taste before a conversation.

Both arrive cold, often on a phone, and give the page well under a minute before they decide.

## Product Purpose
Biyahe is Ian Quilatan's portfolio home. Visitors drive a jeepney around a small low-poly island to five stops, each opening a project card, or skip straight to a plain project list. Success: the visitor sees real shipped work fast, remembers Ian, and reaches him on Upwork or LinkedIn.

## Positioning
The island is itself the proof: a frontend developer showing craft, performance discipline and accessibility in a playful, Filipino-rooted piece (jeepney, sari-sari store, carinderia, bangka) rather than a template grid.

## Operating Context
- Opened from Upwork and LinkedIn, on phones and laptops, sometimes on weak connections.
- The 3D island is optional: every stop is also a button, and every project is in the HTML list that works without WebGL or JS.

## Capabilities and Constraints
- Next.js 15, React 19, Tailwind 4, three.js via React Three Fiber; everything 3D is built in code (no model files).
- Five stops: FashionHub (sari-sari store), Sprig & Stone (plant nursery), Lumenfold (lighthouse, no live link yet), Recipe Finder (carinderia), Pier (about Ian).
- No new dependencies without telling Ian; phones first (draw-call and asset budgets in CLAUDE.md).

## Brand Commitments
- Site name "Biyahe" (Tagalog for "trip") leads the header; Ian's name and role sit under it.
- Contact routes: Upwork profile https://www.upwork.com/freelancers/ianquilatan and LinkedIn https://www.linkedin.com/in/ianquilatan, plus GitHub https://github.com/ianquilatanwe.

## Evidence on Hand
- Project screenshots in `public/shots` (FashionHub, Sprig & Stone, Lumenfold, Recipe Finder).
- Live links and repos for FashionHub, Sprig & Stone and Recipe Finder (in `src/lib/stops.ts`).
- No testimonials, client logos or ratings on the site; don't invent any.

## Product Principles
- The work first: any visitor reaches a real project within seconds, with or without driving.
- Play never blocks: every playful interaction has a plain, accessible equivalent.
- Fast on a mid-range phone, or it doesn't ship.
- Honest: only real projects, real links, real claims.

## Accessibility & Inclusion
WCAG 2.2 AA. Keyboard-complete, reduced motion respected, 3D canvas aria-hidden with every action mirrored in HTML.
