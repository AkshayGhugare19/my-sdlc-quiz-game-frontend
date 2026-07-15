# CLAUDE.md — SDLC Quest game frontend

Frontend-only racing **quiz game** for EMPLOYEE/GUEST players. React 18 + Vite 6 + Tailwind 3 +
**three.js** + zustand + react-router 6 + react-hook-form + framer-motion. No backend of its own —
it calls the Gamru API directly (sibling repo `my-sdlc-quiz-gamru-backend`, `:4000`).
Gameplay is **server-authoritative**: this client renders the question, posts which lane the player
steered into, and displays whatever the server returns. All art is **procedural** (SVG/canvas/three.js
geometry) — there are no image assets. `socket.io-client` is installed but UNUSED.

## Run

```bash
npm install
npm run dev       # vite on :5273
```

`.env`: `VITE_GAMRU_API_URL=http://localhost:4000` (axios appends `/api`), `VITE_APP_NAME`.
Start the backend first. Demo player login: `rambo@acme.com` / `Password123!`.

## Layout (`src/`)

- `main.jsx` → `<BrowserRouter><App/>`. `App.jsx` = all routes + guards `Protected`/`PublicOnly` +
  `<ThemeSwitcher/>`.
- `store/gameStore.js` — **zustand** global store. Keys: `token` (persisted in **sessionStorage
  `rq_token`**, not persist middleware), `player`, `avatar`, `pillars`, `activeMission`,
  `activeTournament` (armed → consumed by next race so exactly one race counts), `session`.
  Actions incl. `startRace(missionId, avatarId, missionBundleId, {quick})`. Listens for window
  `rq:unauthorized` → logout.
- `services/api.js` — the **single** axios client. Base `VITE_GAMRU_API_URL + /api`. Request
  interceptor injects `Authorization: Bearer rq_token`; response unwraps `{success,data}` and on 401
  clears token + dispatches `rq:unauthorized`. Functions: `login/register/organizations/me`,
  `profile/dashboard`, `garage/equipAccessory`, `avatars/pillars/courses/missionContent`,
  `startSession(missionId, avatarId, tournamentId, missionBundleId)`, `sessionState/submitAnswer/
  completeSession`, `joinTournament`, `team`, `shop/buyShopItem/accessoriesShop`.
- `game/` — **`ThreeRaceScene.js` (three.js) is the LIVE engine**; `ThreeGame.jsx` is the React↔scene
  bridge (tiny `createEmitter()` event bus, single `'setLane'` channel). **`PhaserGame.jsx` +
  `RaceScene.js` are LEGACY Phaser, not wired to any route — ignore/don't extend them.**
- `screens/` = pages. `components/` = shared widgets. `theme.js` + `index.css` = 5-theme system
  (CSS variables, `data-theme` on `<html>`, persisted in localStorage `rq_theme`).

## Routes (`App.jsx`)

`/login`, `/signup` (PublicOnly) · `/dashboard` (real landing, tabbed) · `/avatar` · `/hub`
(pick pillar) · `/learn/:missionId` · `/race/:missionId` · `/result` · `/champion` · `/shop` ·
`/accessories-shop` · `/garage` (all Protected). `/` and `*` → `/dashboard`.
**Special races:** `/race/quick` and `/race/tournament` (the `:missionId` param carries the literal
strings `"quick"`/`"tournament"`).

Flow: login → dashboard → avatar → hub → learn → race → result → hub or champion.

## The game (`screens/Race.jsx` + `game/ThreeRaceScene.js`)

**Answering = steering into a lane.** Each question's options map onto road lanes A/B/C[/D]. Answer
cards are an **HTML/framer-motion overlay** in `Race.jsx` (not drawn in WebGL); the scene projects each
lane's world position to screen every frame via `onLaneLayout(xs)` so cards pin over their lane.
Controls: ←/→ steer (`chooseLane` → emits `'setLane'` → `scene.steerTo`), Space/Enter commit; click a
card to select, click again to commit.

Loop: boot session → 3-2-1-GO countdown → `scene.startRacing()` → 1s timer counts down
`hud.timeRemainingSec` → hits 0 → `finishNow()`. **Scoring is entirely server-side** — the scene never
scores. `commit(lane)` → `api.submitAnswer(sid, { questionId, chosenLane })`; the response drives
everything (`isCorrect`, `correctLabel`, `bonusSec`, `accessoryUnlocked`, updated `hud`, then
`finished`+`result` or `nextQuestion`). On finish → `api.completeSession` → navigate `/result`
(`replace:true` so back can't restart a scored run). `scene.playFeedback({isCorrect})` = correct →
flame/hop/shake, wrong → smoke/heavier shake.

## Conventions

- Keep the client dumb — never compute scores/rewards here; trust the server response.
- When adding a screen: add the route + guard in `App.jsx`, add API calls to `services/api.js`
  (never call axios elsewhere), read/write global state through `gameStore.js`.
- Style with the `index.css` component classes (`.panel/.glass/.btn-*/.pill/.field`) and CSS-variable
  theme tokens so new UI themes correctly. Use framer-motion for entrances/feedback like existing screens.
