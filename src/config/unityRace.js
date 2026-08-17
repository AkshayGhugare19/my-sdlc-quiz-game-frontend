// Which engine the "Racing" choice plays in.
//
//   true  → the externally-hosted Unity WebGL build, embedded in an iframe
//           (src/components/UnityRaceFrame.jsx), authed via the one-time
//           handoff code from POST /auth/handoff.
//   false → the original in-repo three.js circuit (CarPreview → ThreeGame in
//           screens/Race.jsx), which is left fully intact as the backup.
//
// Flip it here, or per-environment with VITE_USE_UNITY_RACE=false in .env.
// "Subway Surfer" is unaffected either way — it always runs the three.js scene.
export const USE_UNITY_RACE = import.meta.env.VITE_USE_UNITY_RACE !== 'false';
