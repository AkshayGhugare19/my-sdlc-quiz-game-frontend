import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import ThreeGame, { createEmitter } from '../game/ThreeGame';
import { api } from '../services/api';
import { useGameStore } from '../store/gameStore';
import BackButton from '../components/BackButton';
import GameChoiceModal from '../components/GameChoiceModal';
import { accessoryIcon } from '../accessoryIcons';

const LANE_COLORS = ['#ef4444', '#14b8a6', '#f59e0b', '#8b5cf6'];
const LANE_ICONS = ['👥', '📁', '💬', '⭐'];
const LANE_LETTERS = ['A', 'B', 'C', 'D'];

function fmt(sec) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Pale wash of a lane color, used for card bodies and their bubble tails.
const laneTint = (color) => `color-mix(in srgb, ${color} 9%, white)`;

// Small checkered pennant at each end of the checkpoint track.
function CheckeredFlag({ flip }) {
  return (
    <div
      className="w-9 h-5 rounded-sm shadow"
      style={{
        backgroundImage:
          'conic-gradient(#0f1b33 90deg, #ffffff 90deg 180deg, #0f1b33 180deg 270deg, #ffffff 270deg)',
        backgroundSize: '9px 9px',
        border: '1px solid #0f1b33',
        transform: `rotate(${flip ? -6 : 6}deg)`,
      }}
    />
  );
}

// Screen 4 (3-2-1-GO board) + Screen 5 (ANSWER BY RACING). Layout mirrors the
// reference art: header + TIME/STARS HUD, checkpoint flags, A/B/C speech-bubble
// answer cards over the kart, and corner feedback/accessory panels.
export default function Race() {
  const { missionId } = useParams();
  const [searchParams] = useSearchParams();
  // Present when the race was launched FROM a bundle (pillar) — the server then
  // records bundle progress, fully separate from standalone mission progress.
  const bundleId = searchParams.get('missionBundleId');
  const navigate = useNavigate();
  const { avatar } = useGameStore();
  const startRace = useGameStore((s) => s.startRace);
  const refreshProfile = useGameStore((s) => s.refreshProfile);
  const player = useGameStore((s) => s.player);
  // Which 3D game to play — chosen on the pre-race prompt below. Null until the
  // player picks; `gameType` from the store is only the remembered default.
  const gameType = useGameStore((s) => s.gameType);
  const setGameType = useGameStore((s) => s.setGameType);
  const [gameChoice, setGameChoice] = useState(null);
  // Every equipped accessory (one per slot) — all of them are shown on the kart.
  const equippedList = (player?.garage || [])
    .filter((g) => g.isEquipped)
    .map((g) => g.accessory)
    .filter(Boolean);

  const emitterRef = useRef(createEmitter());
  const sceneRef = useRef(null);
  const cardRowRef = useRef(null);

  // The 3D scene reports each lane's screen X (fraction of the viewport) every
  // frame; pin the answer bubbles over their own lanes via direct styles (no
  // per-frame re-render). Fractions are viewport-relative while the row is
  // inside a padded container, so convert to pixels against the row's rect.
  const onLaneLayout = useCallback((xs) => {
    const row = cardRowRef.current;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const els = Array.from(row.children);
    const cardW = els[0]?.offsetWidth || 160;
    const minSep = cardW + 12; // cards may never overlap
    let pos = xs.map((x) => x * window.innerWidth - rect.left);
    // keep every card fully inside the row…
    pos = pos.map((p) => Math.min(Math.max(p, cardW / 2), rect.width - cardW / 2));
    // …and enforce the minimum gap (push right, then settle back left)
    for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + minSep);
    for (let i = pos.length - 2; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - minSep);
    els.forEach((el, i) => {
      if (pos[i] != null) el.style.left = `${Math.round(pos[i])}px`;
    });
  }, []);
  const sessionRef = useRef(null);
  const lanesRef = useRef([]);
  const questionIdRef = useRef(null); // id of the question currently on screen

  const [boot, setBoot] = useState(null);
  const [hud, setHud] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [lanes, setLanes] = useState([]);
  const [selected, setSelected] = useState(1);
  const [countdown, setCountdown] = useState(3);
  const [racing, setRacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(0);
  const [feedback, setFeedback] = useState(null); // {isCorrect, correctLane, correctLabel, bonus}
  const [accessory, setAccessory] = useState(null); // full unlocked accessory {name, slot, message…}
  const [gear, setGear] = useState([]); // this mission's unlockable accessories (locked+unlocked)
  const [raceError, setRaceError] = useState(null);

  // 1. Start session. "/race/tournament" is a tournament race — no mission;
  // the server draws questions from the tournament's own configured pool.
  // "/race/quick" is a casual quick race — random questions on every attempt;
  // it earns XP/stars/coins but records no mission or bundle progress.
  // A "?missionBundleId=<id>" param marks a bundle-context race.
  const isTournamentRace = missionId === 'tournament';
  const isQuickRace = missionId === 'quick';
  useEffect(() => {
    // Wait for the game choice — the server session (and its mission clock)
    // shouldn't start ticking while the player is still on the choice screen.
    if (!gameChoice) return;
    startRace(isTournamentRace || isQuickRace ? null : missionId, avatar?.id, bundleId, { quick: isQuickRace })
      .then((s) => {
        sessionRef.current = s;
        setBoot(s);
        setHud(s.hud);
        setPrompt(s.question.prompt);
        setLanes(s.question.lanes);
        lanesRef.current = s.question.lanes;
        questionIdRef.current = s.question.id;
        setSelected(Math.floor((s.mission.laneCount || 3) / 2));
        setTimer(s.hud.timeRemainingSec);
        setGear(s.accessories || []);
      })
      // Send the reason back to the hub so the player knows what went wrong.
      // replace: the broken race must not stay in history (back would restart it).
      .catch((e) => navigate('/hub', { state: { error: e.message }, replace: true }));
  }, [missionId, bundleId, gameChoice]); // eslint-disable-line

  // 2. Countdown 3-2-1-GO — only after the player has chosen a game (the 3D
  // scene isn't mounted until then, so there's nothing to start before that).
  useEffect(() => {
    if (!boot || !gameChoice) return;
    if (countdown < 0) {
      setRacing(true);
      sceneRef.current?.startRacing();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [boot, gameChoice, countdown]);

  // 3. Mission timer.
  useEffect(() => {
    if (!racing) return;
    const id = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(id);
          finishNow();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [racing]); // eslint-disable-line

  const finishNow = useCallback(async () => {
    const sid = sessionRef.current?.session?.id;
    if (!sid) return;
    try {
      const result = await api.completeSession(sid);
      await refreshProfile();
      // Carry the race context so REPLAY keeps racing in the same flow.
      // replace: pressing browser-back on the result screen must never remount
      // the race route and silently start a brand-new scored session.
      navigate('/result', {
        state: { result, race: { bundleId, quick: isQuickRace, tournament: isTournamentRace } },
        replace: true,
      });
    } catch (e) {
      // Never leave the player stuck on a dead race — explain it back at the hub.
      navigate('/hub', { state: { error: `Couldn't finish the race: ${e.message}` }, replace: true });
    }
  }, [navigate, refreshProfile, bundleId, isQuickRace, isTournamentRace]);

  const chooseLane = useCallback((lane) => {
    if (!racing || busy) return;
    setSelected(lane);
    emitterRef.current.emit('setLane', lane);
  }, [racing, busy]);

  const commit = useCallback(async (lane) => {
    if (!racing || busy) return;
    const laneToSend = lane ?? selected;
    setBusy(true);
    setSelected(laneToSend);
    emitterRef.current.emit('setLane', laneToSend);

    const sid = sessionRef.current?.session?.id;
    let res;
    try {
      res = await api.submitAnswer(sid, {
        questionId: questionIdRef.current,
        chosenLane: laneToSend,
      });
    } catch (e) {
      // Surface the server's reason and let the player retry the same question.
      setRaceError(e.message);
      setTimeout(() => setRaceError(null), 4000);
      setBusy(false);
      return;
    }

    const correctLane = res.correctOptionId
      ? lanesRef.current.findIndex((l) => l.id === res.correctOptionId)
      : null;
    sceneRef.current?.playFeedback({ isCorrect: res.isCorrect });
    setFeedback({ isCorrect: res.isCorrect, correctLane, correctLabel: res.correctLabel, bonus: res.bonusSec });
    if (res.accessoryUnlocked) {
      setAccessory(res.accessoryUnlocked);
      // Light up the reward in the gear list.
      setGear((g) => g.map((x) => (x.accessoryId === res.accessoryUnlocked.accessoryId ? { ...x, unlocked: true } : x)));
    }
    setHud(res.hud);
    setTimer(res.hud.timeRemainingSec);

    setTimeout(() => {
      setFeedback(null);
      setBusy(false);
      if (res.finished) {
        refreshProfile();
        navigate('/result', {
          state: { result: res.result, race: { bundleId, quick: isQuickRace, tournament: isTournamentRace } },
          replace: true,
        });
      } else {
        sceneRef.current?.applyQuestion();
        setPrompt(res.nextQuestion.prompt);
        setLanes(res.nextQuestion.lanes);
        lanesRef.current = res.nextQuestion.lanes;
        questionIdRef.current = res.nextQuestion.id;
        const mid = Math.floor((boot.mission.laneCount || 3) / 2);
        setSelected(mid);
        emitterRef.current.emit('setLane', mid);
        setAccessory(null);
      }
    }, 1700);
  }, [racing, busy, selected, boot, navigate, refreshProfile, bundleId, isQuickRace, isTournamentRace]);

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e) => {
      if (!racing || busy) return;
      if (e.code === 'ArrowLeft') chooseLane(Math.max(0, selected - 1));
      else if (e.code === 'ArrowRight') chooseLane(Math.min(lanes.length - 1, selected + 1));
      else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        commit(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [racing, busy, selected, lanes, chooseLane, commit]);

  // Pre-race prompt: choose Racing or Subway Surfer before anything boots. This
  // gate sits ahead of every entry point (mission / course / bundle / quick /
  // tournament / replay) because they all funnel through this one screen.
  if (!gameChoice) {
    return (
      <GameChoiceModal
        defaultGame={gameType}
        onChoose={(g) => {
          setGameChoice(g);
          setGameType(g); // remember it as the default for next time
        }}
      />
    );
  }

  if (!boot) return <div className="min-h-full grid place-items-center">Warming up the grid…</div>;

  const isSubway = gameChoice === 'subway';
  const headerTitle = isSubway ? 'ANSWER BY RUNNING' : 'ANSWER BY RACING';
  const headerSub = isSubway
    ? 'Switch to the correct track to answer. Press the Spacebar or right-click twice to lock in.'
    : 'Steer into the correct lane to answer. Press the Spacebar or right-click twice to stop.';
  const steerHint = isSubway ? '← → switch track · Space / Enter to lock in' : '← → steer · Space / Enter to lock in';
  const total = hud?.questionTotal ?? 0;
  const idx = hud?.questionIndex ?? 0;

  return (
    <div className="relative h-screen overflow-hidden">
      {/* three.js circuit + car as the full background */}
      <div className="absolute inset-0">
        <ThreeGame
          emitter={emitterRef.current}
          laneCount={boot.mission.laneCount}
          avatarKey={avatar?.key}
          avatarName={avatar?.name}
          accessories={equippedList}
          gameType={gameChoice}
          onLaneLayout={onLaneLayout}
          onReady={(scene) => (sceneRef.current = scene)}
        />
      </div>

      {/* Overlay UI */}
      <div className="relative z-10 h-full flex flex-col p-4 md:p-6 pointer-events-none">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 pointer-events-auto">
            <BackButton
              dark
              label="Quit"
              onClick={() => {
                if (window.confirm('Quit this race? Your progress in this race will be lost.')) {
                  navigate(isTournamentRace || isQuickRace ? '/dashboard' : '/hub');
                }
              }}
            />
            <div className="flex items-center gap-3 bg-white/90 rounded-2xl px-4 py-2 shadow-lg">
              <div className="w-9 h-9 rounded-lg bg-royal text-white grid place-items-center font-extrabold shadow">
                {isSubway ? '🚇' : '5'}
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-extrabold text-royal leading-tight">{headerTitle}</h1>
                <p className="text-slate-500 text-xs md:text-sm font-medium">{headerSub}</p>
              </div>
            </div>
            {boot.tournament && (
              <div className="rounded-xl px-3 py-2 shadow-lg text-white text-xs font-extrabold tracking-wide bg-gradient-to-r from-amber-500 to-orange-500">
                🏆 TOURNAMENT RACE
                <div className="text-[10px] font-bold text-amber-100">{boot.tournament.name}</div>
              </div>
            )}
          </div>
          <div className="text-right space-y-1.5">
            <div className="bg-white/90 rounded-xl px-3.5 py-1.5 shadow-lg text-right">
              <div className="text-[9px] tracking-[0.2em] font-bold text-slate-500">TIME REMAINING</div>
              <div className={`text-xl font-extrabold ${timer <= 15 ? 'text-red-500' : 'text-[#0f1b33]'}`}>⏱ {fmt(timer)}</div>
            </div>
            <div className="bg-white/90 rounded-xl px-3.5 py-1.5 shadow-lg text-right">
              <div className="text-[9px] tracking-[0.2em] font-bold text-slate-500">STARS EARNED</div>
              <div className="text-lg font-extrabold text-[#0f1b33]">
                <span className="text-amber-400">⭐</span> {hud?.starsEarned ?? 0} / {hud?.maxStars ?? 5}
              </div>
            </div>
          </div>
        </div>

        {/* Checkpoint track with checkered flags */}
        <div className="flex items-center gap-2 mt-3 max-w-2xl mx-auto w-full">
          <CheckeredFlag flip />
          <div className="flex-1 flex items-center">
            {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
              <div key={i} className="flex-1 flex items-center">
                <div
                  className={`w-4 h-4 rounded-full border-2 shadow ${
                    i <= idx ? 'bg-teal-400 border-teal-500' : 'bg-white border-[#0f1b33]/70'
                  }`}
                />
                {i < total - 1 && <div className={`flex-1 h-[3px] rounded ${i < idx ? 'bg-teal-400' : 'bg-[#0f1b33]/55'}`} />}
              </div>
            ))}
          </div>
          <CheckeredFlag />
        </div>

        {/* Question banner */}
        <div className="mx-auto mt-3 max-w-2xl w-full">
          <div className="bg-white/95 rounded-2xl px-6 py-3 text-center border-2 border-[#0f1b33]/15 shadow-xl">
            <span className="font-bold text-[#0f1b33]">{prompt}</span>
          </div>
        </div>

        {/* Answer cards A/B/C — each pinned over its own lane (onLaneLayout) */}
        <div ref={cardRowRef} className="relative mt-4 md:mt-6 h-48 md:h-56 pointer-events-auto">
          {lanes.map((lane, i) => {
            const isSel = selected === i;
            const fbState = feedback
              ? feedback.correctLane === i
                ? 'correct'
                : feedback.isCorrect === false && selected === i
                ? 'wrong'
                : null
              : null;
            const color = LANE_COLORS[i % LANE_COLORS.length];
            const tint = laneTint(color);
            return (
              // wrapper carries the lane-anchored position; framer-motion owns
              // the button's own transform, so translateX(-50%) lives here
              <div
                key={lane.id}
                className="absolute top-0"
                style={{ left: `${(((i + 0.5) / lanes.length) * 100).toFixed(2)}%`, transform: 'translateX(-50%)' }}
              >
              <motion.button
                whileHover={{ y: -4 }}
                animate={{ scale: isSel ? 1.06 : 1, y: isSel ? -6 : 0 }}
                onClick={() => (isSel ? commit(i) : chooseLane(i))}
                className="relative w-28 sm:w-32 md:w-44"
              >
                {/* card body — pale wash of the lane color, speech-bubble shape */}
                <div
                  className="rounded-2xl pt-3 pb-4 px-3 border-2 transition"
                  style={{
                    background: tint,
                    borderColor:
                      fbState === 'correct' ? '#22c55e' : fbState === 'wrong' ? '#ef4444' : color,
                    boxShadow:
                      fbState === 'correct'
                        ? '0 0 0 4px rgba(34,197,94,0.4), 0 18px 34px rgba(2,8,20,0.3)'
                        : fbState === 'wrong'
                        ? '0 0 0 4px rgba(239,68,68,0.4), 0 18px 34px rgba(2,8,20,0.3)'
                        : isSel
                        ? `0 0 0 4px ${color}44, 0 18px 34px rgba(2,8,20,0.3)`
                        : '0 14px 28px rgba(2,8,20,0.22)',
                  }}
                >
                  {/* colored letter badge inside the bubble */}
                  <div
                    className="w-10 h-10 mx-auto rounded-full grid place-items-center text-white font-extrabold text-lg shadow-md"
                    style={{ background: color }}
                  >
                    {LANE_LETTERS[i]}
                  </div>
                  <div className="text-[#12213f] text-sm font-bold text-center leading-snug min-h-[2.5rem] mt-2">
                    {lane.label}
                  </div>
                  <div className="text-2xl text-center mt-1" style={{ color }}>
                    {LANE_ICONS[i % LANE_ICONS.length]}
                  </div>
                </div>
                {/* long speech-bubble tail pointing at the lane */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-[18px] w-0 h-0"
                  style={{
                    borderLeft: '13px solid transparent',
                    borderRight: '13px solid transparent',
                    borderTop: `20px solid ${tint}`,
                    filter: 'drop-shadow(0 3px 2px rgba(2,8,20,0.18))',
                  }}
                />
              </motion.button>
              </div>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Bottom corners: feedback (left) + accessory unlocked (right) */}
        <div className="flex items-end justify-between pointer-events-none">
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl px-5 py-3 shadow-2xl bg-[#0f1b33]/95 border border-white/15"
              >
                {feedback.isCorrect ? (
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-full bg-white grid place-items-center text-2xl shadow">😄</span>
                    <div>
                      <div className="text-white font-extrabold tracking-wide">CORRECT ANSWER!</div>
                      {feedback.bonus > 0 && <div className="text-teal-300 text-sm font-semibold">+{feedback.bonus} sec bonus</div>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-full bg-white grid place-items-center text-2xl shadow">💡</span>
                    <div className="text-white/90 text-sm">
                      The correct answer is <b className="text-white">{feedback.correctLabel}</b>.
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {accessory && (
              <motion.div
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl px-5 py-3 shadow-2xl border border-teal-300/40 text-right"
                style={{ background: 'linear-gradient(135deg,#0c3238 0%,#155e63 100%)' }}
              >
                <div className="text-[10px] tracking-[0.25em] font-bold text-teal-200/90">ACCESSORY UNLOCKED!</div>
                <div className="flex items-center gap-3 justify-end mt-1">
                  <span className="text-3xl drop-shadow">{accessoryIcon(accessory)}</span>
                  <span className="text-white text-xl font-extrabold uppercase tracking-wide">{accessory.name}</span>
                  <span className="w-6 h-6 rounded-full bg-teal-300 text-[#06282c] grid place-items-center font-black text-sm">✓</span>
                </div>
                <div className="text-[10px] text-teal-100/70 mt-0.5">Equip it from your garage after the race</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Current accessory + this mission's winnable gear, pinned to the right */}
      <div className="absolute right-4 top-[38%] z-10 w-40 rounded-2xl bg-[#0f1b33]/90 border border-white/15 shadow-2xl p-3 text-center pointer-events-none hidden md:block">
        <div className="text-[9px] tracking-[0.2em] font-bold text-white/70 mb-2">
          {equippedList.length > 1 ? 'EQUIPPED GEAR' : 'CURRENT ACCESSORY'}
        </div>
        <div className="rounded-xl bg-black/40 min-h-[5rem] grid place-items-center p-2">
          {equippedList.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {equippedList.map((a) => (
                <div key={a.id ?? a.key ?? a.slot} className="flex flex-col items-center w-[3.4rem]">
                  <span className="text-3xl leading-none drop-shadow">{accessoryIcon(a)}</span>
                  <span className="text-white/80 text-[8px] font-bold mt-0.5 truncate w-full">{a.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-white/30 text-sm font-semibold">None yet</span>
          )}
        </div>
        {gear.length > 0 && (
          <div className="flex justify-center gap-1.5 mt-2.5">
            {gear.map((g) => (
              <span
                key={g.accessoryId}
                title={g.name}
                className={`w-8 h-8 rounded-lg grid place-items-center text-base ${
                  g.unlocked ? 'bg-teal-400/20 ring-1 ring-teal-300/50' : 'bg-black/40'
                }`}
              >
                {g.unlocked ? accessoryIcon(g) : '🔒'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Server error toast (e.g. answer rejected) — tells the player exactly why. */}
      <AnimatePresence>
        {raceError && (
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-red-600/90 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg"
          >
            ⚠️ {raceError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown board (screen 4) */}
      <AnimatePresence>
        {!racing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 grid place-items-center bg-black/40">
            <div className="flex items-center gap-8">
              {/* overhead board */}
              <div className="bg-slate-900 rounded-2xl px-10 py-6 border-4 border-slate-700 text-center shadow-2xl">
                <div className="text-2xl text-white/70 mb-1">↑ ↑ ↑</div>
                <motion.div key={countdown} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-7xl font-black text-neon">
                  {countdown > 0 ? countdown : 'GO!'}
                </motion.div>
              </div>
              {/* mission HUD card */}
              <div className="glass rounded-2xl px-6 py-4 space-y-2">
                <div className="flex items-center justify-between gap-8"><span className="text-white/70">⚙️ Questions</span><b className="text-white">{idx}/{total}</b></div>
                <div className="flex items-center justify-between gap-8"><span className="text-white/70">⭐ Knowledge Stars</span><b className="text-white">{hud?.starsEarned ?? 0}/{hud?.maxStars ?? 5}</b></div>
                <div className="flex items-center justify-between gap-8"><span className="text-white/70">⏱ Mission Time</span><b className="text-neon">{fmt(timer)}</b></div>
                <div className="pt-1 border-t border-white/15 text-white/60 text-xs">{steerHint}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
