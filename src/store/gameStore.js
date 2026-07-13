import { create } from 'zustand';
import { api, setToken, getToken } from '../services/api';

// Drives the whole learning flow:
// login → avatar → hub(pillars) → learn → race → result → hub → champion.
export const useGameStore = create((set, get) => ({
  // auth
  token: getToken(),
  player: null,

  // selections
  avatar: null,
  pillars: [],
  activeMission: null,
  // Armed from the dashboard's "Race" button on a joined tournament; consumed
  // by the NEXT race start so exactly one race counts for the tournament.
  activeTournament: null,

  // live session
  session: null, // { sessionToken, session, mission, hud, question }

  loading: false,
  error: null,

  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const { accessToken, user } = await api.login(email, password);
      setToken(accessToken);
      set({ token: accessToken, player: user });
      await get().refreshProfile();
      return true;
    } catch (e) {
      set({ error: e.message });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  async signup(payload) {
    set({ loading: true, error: null });
    try {
      const { accessToken, user } = await api.register(payload);
     if(accessToken){
       return true;
     }else{
      return false
     }
    } catch (e) {
      set({ error: e.message });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  logout() {
    setToken(null);
    set({ token: null, player: null, avatar: null, session: null });
  },

  async refreshProfile() {
    try {
      const profile = await api.profile();
      set({ player: profile });
    } catch {
      /* ignore */
    }
  },

  async loadPillars() {
    set({ loading: true });
    try {
      const pillars = await api.pillars();
      set({ pillars });
    } finally {
      set({ loading: false });
    }
  },

  chooseAvatar(avatar) {
    set({ avatar });
  },

  chooseMission(mission) {
    set({ activeMission: mission });
  },

  // Arm the next race as a tournament race (or pass null to disarm).
  setActiveTournament(tournament) {
    set({ activeTournament: tournament });
  },

  // missionBundleId: set when the race is launched FROM a bundle (pillar) so it
  // feeds bundle progress; omitted for standalone mission races. quick: true
  // starts a casual quick race — never attached to an armed tournament.
  async startRace(missionId, avatarId, missionBundleId, { quick = false } = {}) {
    set({ loading: true, error: null });
    const tournament = quick ? null : get().activeTournament;
    try {
      const session = await api.startSession(missionId, avatarId, tournament?.id, missionBundleId);
      // The armed tournament is consumed by this race — later normal races
      // must never accidentally count toward it.
      set({ session, ...(quick ? {} : { activeTournament: null }) });
      return session;
    } catch (e) {
      set({ error: e.message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  clearSession() {
    set({ session: null });
  },
}));
