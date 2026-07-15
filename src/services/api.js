// ============================================================================
// The SINGLE place the racing game talks to Gamru .
// There is no learning-games backend — every endpoint below is served by the
// Gamru  API (VITE_GAMRU_API_URL). The game is "dumb": it renders whatever
// the engine returns and posts raw player moves; the engine owns all rules.
// ============================================================================
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_GAMRU_API_URL || 'http://localhost:4000';

const http = axios.create({ baseURL: `${BASE_URL}/api`, timeout: 20000 });

// Attach the player's access token to every request.
http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('rq_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap the { success, data } envelope; surface a clean error message.
http.interceptors.response.use(
  (res) => res.data?.data ?? res.data,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('rq_token');
      // Tell the store the session died so route guards send the player to
      // /login instead of rendering broken screens with a stale token.
      window.dispatchEvent(new Event('rq:unauthorized'));
    }
    const message = err.response?.data?.message || err.message || 'Request failed';
    return Promise.reject(new Error(message));
  },
);

export const api = {
  baseUrl: BASE_URL,

  // ── Auth (game-only endpoints: EMPLOYEE/GUEST can sign in here; staff
  //    roles are rejected and pointed to the admin console) ──
  login: (email, password) => http.post('/auth/game/login', { email, password }),
  register: (payload) => http.post('/auth/game/register', payload),
  organizations: () => http.get('/auth/game/organizations'), // public — for signup
  me: () => http.get('/auth/me'),

  // ── Player profile / HUD / dashboard ──
  profile: () => http.get('/play/me'),
  dashboard: () => http.get('/play/dashboard'),

  // ── Accessories garage (unlocked + still-locked catalog, equip on kart) ──
  garage: () => http.get('/play/garage'),
  equipAccessory: (accessoryId) => http.post(`/play/garage/${accessoryId}/equip`),

  // ── Flow: avatars → pillars/hub → learning content ──
  avatars: () => http.get('/play/avatars'),
  pillars: () => http.get('/play/pillars'),
  // Learning roadmaps: each course references missions/bundles/tournaments with
  // the player's own progress per item + course rollup + certificate.
  courses: () => http.get('/play/courses'),
  // params carry the entry context ({ missionBundleId?, courseId? }) so the API
  // resolves the right briefing: course path > bundle path > the mission's own.
  missionContent: (missionId, params) => http.get(`/play/missions/${missionId}/content`, { params }),
  // Storyboard "learning path" (its ordered points) attached to a mission bundle,
  // course or tournament — shown as a pre-play briefing, just like a mission's.
  learningPath: (id) => http.get(`/play/learning-paths/${id}`),

  // ── Gameplay session (server-authoritative) ──
  // Mission race: missionId set. Tournament race: tournamentId only — the
  // engine draws questions from the tournament's own configured pool.
  // Quick race: nothing set — random questions every attempt, nothing recorded.
  // missionBundleId marks a mission race launched FROM its bundle: only those
  // feed bundle progress; standalone mission races track separately.
  // Normal races never count toward tournament standings.
  startSession: (missionId, avatarId, tournamentId, missionBundleId) =>
    http.post('/play/sessions', {
      ...(missionId ? { missionId } : {}),
      ...(avatarId ? { avatarId } : {}),
      ...(tournamentId ? { tournamentId } : {}),
      ...(missionBundleId ? { missionBundleId } : {}),
    }),
  sessionState: (sessionId) => http.get(`/play/sessions/${sessionId}`),
  submitAnswer: (sessionId, payload) => http.post(`/play/sessions/${sessionId}/answer`, payload),
  completeSession: (sessionId) => http.post(`/play/sessions/${sessionId}/complete`),

  // ── Competition ──
  leaderboardRankings: (leaderboardId) => http.get(`/leaderboards/${leaderboardId}/rankings`),
  joinTournament: (id) => http.post(`/play/tournaments/${id}/join`),

  // ── Team / reporting lines ──
  team: () => http.get('/play/team'),

  // ── Reward shop (coupons/titles/company rewards — no accessories) ──
  shop: () => http.get('/play/shop'),
  buyShopItem: (id) => http.post(`/play/shop/${id}/buy`),

  // ── Accessories shop (purchasable kart accessories only; bought items land
  //    straight in the Accessories Garage) ──
  accessoriesShop: () => http.get('/play/accessories-shop'),
};

export function setToken(token) {
  if (token) sessionStorage.setItem('rq_token', token);
  else sessionStorage.removeItem('rq_token');
}

export function getToken() {
  return sessionStorage.getItem('rq_token');
}
