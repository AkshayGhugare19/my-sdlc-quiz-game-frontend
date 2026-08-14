import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThreeGame, { createEmitter } from '../game/ThreeGame';
import BackButton from '../components/BackButton';
import { accessoryIcon } from '../accessoryIcons';
import { CAR_DESIGNS } from '../game/carBuilder';

// NFS-style showroom screen shown after the player picks "Racing" and before
// the mission actually boots — a rotating 3D preview of their car (same mesh
// the live race uses, via ThreeCarPreviewScene), a car picker to choose which
// design to race, driver/gear details, and a big START RACE button. Purely
// presentational: the session has already started loading behind the scenes
// (Race.jsx keeps its existing boot effect running), this screen just delays
// showing the countdown/race UI.
export default function CarPreview({ avatarKey, avatarName, missionName, equippedList = [], carDesignId, onCarDesignChange, onStart, onBack }) {
  const sceneRef = useRef(null);
  const idx = Math.max(0, CAR_DESIGNS.findIndex((d) => d.id === carDesignId));
  const design = CAR_DESIGNS[idx] || CAR_DESIGNS[0];

  const cycle = (dir) => {
    const next = CAR_DESIGNS[(idx + dir + CAR_DESIGNS.length) % CAR_DESIGNS.length];
    onCarDesignChange?.(next.id);
    sceneRef.current?.setCarDesign?.(next.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: 'radial-gradient(1200px 800px at 50% -10%, #131c33 0%, #05070d 55%, #020306 100%)' }}
    >
      {/* faint carbon-fiber weave + sweeping light streak, purely CSS */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 6px)',
        }}
      />
      <motion.div
        className="absolute inset-y-0 w-1/3 pointer-events-none"
        style={{ background: 'linear-gradient(100deg, transparent, rgba(103,232,249,0.08), transparent)' }}
        initial={{ x: '-40vw' }}
        animate={{ x: '140vw' }}
        transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
      />

      {/* 3D turntable */}
      <div className="absolute inset-0">
        <ThreeGame
          emitter={createEmitter()}
          laneCount={3}
          avatarKey={avatarKey}
          avatarName={avatarName}
          accessories={equippedList}
          gameType="preview"
          carDesignId={carDesignId}
          onReady={(scene) => (sceneRef.current = scene)}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-start justify-between p-4 md:p-6 pointer-events-none">
        <div className="pointer-events-auto">
          <BackButton dark label="Back" onClick={onBack} />
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 text-cyan-300 font-bold text-xs tracking-[0.25em]">
            🏁 CAR SHOWCASE
          </div>
          {missionName && <div className="text-white/70 text-sm font-semibold mt-1">{missionName}</div>}
        </div>
      </div>

      {/* Car picker — prev/next through CAR_DESIGNS, centered up top */}
      <div className="absolute top-20 md:top-24 inset-x-0 z-10 flex flex-col items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-3 md:gap-5 pointer-events-auto">
          <button
            onClick={() => cycle(-1)}
            aria-label="Previous car"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-lg grid place-items-center transition"
          >
            ‹
          </button>
          <AnimatePresence mode="wait">
            <motion.div
              key={design.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="text-center min-w-[13rem]"
            >
              <div className="text-white text-xl md:text-2xl font-extrabold uppercase tracking-wide drop-shadow">{design.name}</div>
              <div className="text-cyan-300/90 text-[11px] font-bold tracking-[0.15em] uppercase mt-0.5">{design.brand}</div>
              <div className="text-white/50 text-xs font-medium mt-0.5">{design.tagline}</div>
            </motion.div>
          </AnimatePresence>
          <button
            onClick={() => cycle(1)}
            aria-label="Next car"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-lg grid place-items-center transition"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {CAR_DESIGNS.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                onCarDesignChange?.(d.id);
                sceneRef.current?.setCarDesign?.(d.id);
              }}
              aria-label={`Choose ${d.name}`}
              className="w-2 h-2 rounded-full transition"
              style={{ background: d.id === design.id ? '#22d3ee' : 'rgba(255,255,255,0.25)' }}
            />
          ))}
        </div>
      </div>

      {/* Driver / car HUD card, bottom-left */}
      <div className="absolute left-4 md:left-8 bottom-28 md:bottom-32 z-10 pointer-events-none">
        <motion.div
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl px-5 py-4 bg-black/40 border border-white/10 backdrop-blur-sm shadow-2xl max-w-xs"
        >
          <div className="text-[10px] tracking-[0.25em] font-bold text-cyan-300/90">DRIVER</div>
          <div className="text-white text-2xl font-extrabold uppercase tracking-wide mt-0.5">
            {avatarName || 'Racer'}
          </div>
          {equippedList.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {equippedList.map((a) => (
                <div
                  key={a.id ?? a.key ?? a.slot}
                  className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full pl-1.5 pr-3 py-1"
                >
                  <span className="text-lg leading-none">{accessoryIcon(a)}</span>
                  <span className="text-white/80 text-[11px] font-bold">{a.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/40 text-xs font-semibold mt-3">No gear equipped yet</div>
          )}
        </motion.div>
      </div>

      {/* Flavor stat gauges, bottom-right — cosmetic, not gameplay-affecting */}
      <div className="hidden md:block absolute right-8 bottom-32 z-10 pointer-events-none">
        <motion.div
          key={design.id}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl px-5 py-4 bg-black/40 border border-white/10 backdrop-blur-sm shadow-2xl w-52"
        >
          <div className="text-[10px] tracking-[0.25em] font-bold text-cyan-300/90 mb-2.5">PERFORMANCE</div>
          {[
            ['SPEED', (design.spoiler ? 78 : 62) + equippedList.length * 6],
            ['HANDLING', (design.roofRack ? 50 : 66) + equippedList.length * 5],
            ['BOOST', (design.glow ? 82 : 55) + equippedList.length * 8],
          ].map(([label, pct]) => (
            <div key={label} className="mb-2 last:mb-0">
              <div className="flex justify-between text-[10px] font-bold text-white/60 mb-1">
                <span>{label}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg,#22d3ee,#818cf8)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, pct)}%` }}
                  transition={{ duration: 0.9, delay: 0.4 }}
                />
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Start Race button */}
      <div className="absolute inset-x-0 bottom-8 md:bottom-10 z-10 flex flex-col items-center gap-2 pointer-events-none">
        <motion.button
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          whileHover={{ scale: 1.035 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="pointer-events-auto rounded-2xl px-12 py-4 text-lg md:text-xl font-black tracking-wide text-[#031018] uppercase"
          style={{
            background: 'linear-gradient(135deg,#67e8f9,#22d3ee 55%,#0891b2)',
            boxShadow: '0 0 0 1px rgba(103,232,249,0.5), 0 18px 40px rgba(34,211,238,0.35)',
          }}
        >
          🏁 Start Race
        </motion.button>
        <span className="text-white/35 text-[11px] font-semibold pointer-events-none">Drag the car to spin it · ‹ › to change car</span>
      </div>
    </motion.div>
  );
}
