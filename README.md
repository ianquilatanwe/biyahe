# Biyahe

My portfolio home page. *Biyahe* is Tagalog for "trip": you drive a jeepney around a small island and stop at six
landmarks, each one a project. Prefer not to drive? "Skip the island" jumps straight to a plain list of the same projects.

| Stop | Landmark | Project |
| --- | --- | --- |
| FashionHub | Sari-sari store | Product listing page in Next.js |
| Sprig & Stone | Plant nursery | Landing page in Next.js |
| Lumenfold | Lighthouse | Scroll-driven motion demo |
| Bagyo | Weather station | Scroll-driven WebGL typhoon |
| Recipe Finder | Carinderia | Flutter app, also on the web |
| Pier | Pier with a bangka | About me and links |

## How to drive

- **Keyboard:** W A S D or the arrow keys. Park next to a landmark and press **E** (or the "Open" button) to see its project.
- **Mouse or touch:** click or tap the ground and the jeepney drives itself there. Click a landmark to drive to it and open its card.
- **Horn:** **H** honks. The jeepney also beeps twice when it arrives at a stop.
- **No driving at all:** the stop buttons along the bottom drive you to each stop and open its card.

## How it's built

Next.js 15, React 19, Tailwind CSS 4, and three.js through React Three Fiber. I didn't use any 3D models: every building,
palm tree and the jeepney itself are built in code from boxes, cylinders, cones and side-view outlines (the jeepney's curved fenders).

- **The page works without the 3D part.** The name, the skip link and the project list are plain HTML that shows first. The 3D
  island loads after it. If a browser can't run it (no WebGL, or the code fails to download), a short message replaces the
  island and the project list still works.
- **Phones first.** About 30 draw calls per frame, because all the static parts are merged into one mesh, with each part's colour (and baked shading) stored in its corners. Sharpness is
  capped on high-density screens and drops one step if a phone can't keep up. Nothing renders while the island is scrolled out of view.
- **Accessible.** The 3D canvas is hidden from screen readers, and everything on it is also a real button or link. The project cards
  are native `<dialog>` elements. With "reduce motion" turned on, the bouncing, camera sway, wind and water animation stop.
- **Shaders for the weather, not extra objects.** The sea is one shader (shallows, foam, sun glints). Palms, grass and
  flags sway in the wind, and cloud shadows drift over everything, by adding a few lines to the shaders of the existing
  materials, so they cost no extra draw calls (`src/components/world/weather.ts`). The lighthouse beam is a soft shader cone.
  Surfaces get detail the same way, drawn in the shader with no image files (`surfaces.ts`): wood grain, ridged zinc
  roofs, brushed steel, plaster speckle, rock, leaves, cloth, and sand, grass and gravel on the ground.
  Edges are bevelled, round parts have twice the sides, rocks are chipped and palms have arching fronds with leaflets:
  about 113,000 triangles, still one mesh, so still ~30 draw calls.
- **Sound made in code.** A diesel engine that idles, pulls through three gears and chugs harder when you press on, the sea getting louder near the shore, and the horn,
  all generated with the Web Audio API (`src/lib/sound.ts`), so there are no audio files. It's on by default but only
  starts after your first click, tap or key press, and the header button turns it off.
- **Game rules are plain functions.** Driving, the coastline, the stops and the autopilot live in `src/lib` with no 3D code, and
  `node src/lib/driving.check.ts` tests them (including an autopilot run to each stop from 200 random spots).

| Folder | What's in it |
| --- | --- |
| `src/lib` | Game rules: driving, island shape and colliders, stop data (`stops.ts`), feel numbers (`tuning.ts`) |
| `src/components/world` | The 3D scene: island, water, landmarks, jeepney |
| `src/components/ui` | HTML on top of the island: loading screen, project card, fallback message |
| `public/shots` | Project screenshots for the cards |

## Run it

Needs Node 22.18 or newer (the `*.check.ts` files run as TypeScript straight from Node).

```bash
npm install
npm run dev
```

Open http://localhost:3000. In dev mode a small Leva panel lets you tune how the driving and the camera feel; it isn't included in the live site.

Other commands:

- `npm run lint`: check the code style.
- `node src/lib/driving.check.ts`: test the driving rules.
- `npm run build`, then `npm start`: the production build. If `npm run dev` is still running, use `npm run build:test` and
  `npm run start:test` instead (port 3310). They build into their own folder, so they don't break the dev server.

### Try it on your phone

Run `npm run build:test` and then `npm run start:test`. Next prints a "Network" address (like `http://192.168.1.20:3310`); open it on a
phone on the same Wi-Fi. If the page doesn't load, allow Node through the Windows firewall for private networks.

## Deploy

It's a standard Next.js app with no environment variables or backend, so on Vercel you just import the repo with the default settings.
Vercel's production address is also used for the social preview image.

## Credits

Inspired by Bruno Simon's driving portfolio. All the code, the models and the island here are my own.
