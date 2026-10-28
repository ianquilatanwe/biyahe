---
target: Biyahe non-3D UI
total_score: 23
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Zetha\\upwork\\portfolio\\biyahe\\src\\app\\page.tsx"
target_fingerprint: "sha256:ba2e7b6f5c653f84daff8f7f0267be737a92cc9c9e2b733ccf53ce59bbda69db"
target_path: "C:\\Users\\Zetha\\upwork\\portfolio\\biyahe\\src\\app\\page.tsx"
timestamp: 2026-10-28T06-09-28Z
slug: src-app-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | No tap destination marker; drive to a stop announced only to screen readers |
| 2 | Match system / real world | 3 | Jeepney/route-plate metaphor strong; "Skip the island" reads like "skip ad"; "Pier" hides "About" |
| 3 | User control and freedom | 3 | Esc/×/backdrop + skip link; no visible cancel for a drive |
| 4 | Consistency and standards | 2 | Three dialects: glass panel, red SaaS pill, yellow signboard; links differ list vs card |
| 5 | Error prevention | 3 | Little to get wrong |
| 6 | Recognition rather than recall | 2 | Landmarks unlabeled in-world; mobile stop row clipped, Pier off-screen |
| 7 | Flexibility and efficiency | 3 | Keys, click, E, buttons, skip |
| 8 | Aesthetic and minimalist design | 2 | Loudest element is the exit; permanent hint pill; empty grass on mobile |
| 9 | Error recovery | 3 | NoIsland message clear |
| 10 | Help and documentation | n/a | Experience surface |
| Total | | 23/36 | Acceptable |

## Design Specificity Verdict
About 40% specific. The signboard buttons, loader and the dialog's "Stop ·" strip belong to Biyahe; the frosted header panel, red pill skip link, glass hint pill and the whole Projects card grid are category template. Detector: CLI 0 findings; browser overlay flagged body-level overused-font (Inter ~60%), cream-palette (sand #f8eedb), and two false positives (loader road stripes, sr-only spans in the scrolled stop strip).

## Priority Issues
- [P1] No way to hire Ian: no Upwork or LinkedIn link anywhere. Fix: permanent contact in header plate and a closing "last stop" block, plus on the Pier card.
- [P1] Header and skip link generic and loud: glass card + red pill; skip outshines the name. Fix: single-line route-plate header in the signboard dialect; skip demoted to a quiet signboard; retire .panel and .btn-primary from the overlay.
- [P1] Interactables not marked in the world: names only in the bottom bar. Fix: in-world signboards over each landmark and an in-world Open prompt above the parked jeepney.
- [P2] No tap feedback, no custom pointer: add destination chevrons and a canvas-only custom cursor.
- [P2] Projects section is a template and a hard cut: restyle as the island's route board using the dialog's card design, screenshots, sign links; About pulled into a closing Pier block with Upwork/LinkedIn.

## Persona Red Flags
Upwork client on a phone: clipped stop row, About hidden off-screen, list has no screenshots, no Upwork link. Recruiter on laptop: name is 14px muted text, three UI dialects read as unresolved taste, list looks like a starter template, no LinkedIn.

## Minor Observations
Hint pill permanent; yellow Open prompt merges with yellow stop row on mobile; Lumenfold shows no "coming soon" in the list; list links vs dialog links differ in new-tab behaviour; sea-teal H2 used nowhere else; "×" glyph close; no footer.

## Questions
If the island is the proof, why is the brightest button the one that leaves? Should Projects be the island's terminal route board instead of a separate grid?
