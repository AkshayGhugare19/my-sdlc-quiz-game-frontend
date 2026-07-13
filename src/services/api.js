// ============================================================================
// The SINGLE place the racing game talks to GamifiedLearning .
// There is no learning-games backend — every endpoint below is served by the
// GamifiedLearning  API (VITE_GAMRU_API_URL). The game is "dumb": it renders whatever
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
    if (err.response?.status === 401) sessionStorage.removeItem('rq_token');
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
  missionContent: (missionId) => http.get(`/play/missions/${missionId}/content`),

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

  // ── Reward shop (spend coins/stars; accessories fulfil instantly) ──
  shop: () => http.get('/play/shop'),
  buyShopItem: (id) => http.post(`/play/shop/${id}/buy`),
};

export function setToken(token) {
  if (token) sessionStorage.setItem('rq_token', token);
  else sessionStorage.removeItem('rq_token');
}

export function getToken() {
  return sessionStorage.getItem('rq_token');
}
