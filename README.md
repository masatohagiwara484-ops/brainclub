# BrainClub 🧠

A worldwide collection of brain & logic games, playable free in the browser
(PC & mobile). Think *Clubhouse Games × NYT Games*, on the web. The first
game is a polished **3D Rubik's Cube**; more are on the roadmap.

> Working brand name is **BrainClub** — change it freely in `index.html`,
> `vite.config.ts` (PWA manifest) and `src/i18n/*.json`.

## Tech stack
React + Vite + TypeScript + Tailwind CSS. Games render to `<canvas>`
(the cube uses Three.js). PWA-enabled (installable, offline). No backend yet —
everything is client-side, so it deploys as static files to Vercel.

## Run locally
```bash
npm install
npm run dev          # open the printed http://localhost:5173
```
For phones on the same Wi-Fi:
```bash
npm run dev -- --host    # then open http://<your-PC-IP>:5173 on the phone
```

## Build & preview production
```bash
npm run build
npm run preview
```

## Deploy to Vercel
1. Push this folder to a new GitHub repo.
2. On vercel.com → New Project → import the repo.
3. Framework preset: **Vite** (auto-detected). Build `npm run build`, output `dist`.
4. Deploy. Every push to `main` redeploys.

`vercel.json` already rewrites all routes to `/` for the SPA.

## Controls (Cube)
- **Drag the background** → rotate/tilt the whole cube.
- **Drag across a face** → turn that layer.
- **Wheel / pinch** → zoom.
- Sizes 2×2 / 3×3 / 4×4 / 5×5, shuffle, undo, reset, recenter, timer, move count, solve detection + share.

### Mobile vibration (haptics)
A tiny buzz on each turn and a pattern on solve, via the Web Vibration API.
✅ Works on **Android** (Chrome/Firefox). ❌ **iOS Safari does not support
`navigator.vibrate`**, so it is silently ignored on iPhone/iPad (no error).

## Project layout
```
src/
  games/registry.ts      game catalog (cube live; others "coming soon")
  games/cube/            cubeEngine.ts (Three.js + fixes) + CubeGame.tsx
  components/            Layout (universal chrome), GameCard
  pages/                 Home (hub grid), GamePage
  lib/                   haptics, storage (best/streak), daily (seeds), share
  i18n/                  en.json (default), ja.json
```

## Adding a game
1. Implement a component (canvas or DOM) under `src/games/<id>/`.
2. Add an entry to `GAMES` in `src/games/registry.ts` with `available: true`
   and a `component: lazy(() => import('./<id>/<Component>'))`.
3. Add its name/tagline keys to `src/i18n/*.json`.
