import { motion, AnimatePresence } from 'framer-motion';
import gameBg from '../assets/game/game_bg.png';

// The Emergency Management pillar's "watch, then return" gate — shown by
// Hub.jsx in place of navigating into that pillar's mission (see the
// videoGateMission overlay there). Embeds the external pillar quiz/video; the
// primary button always stays enabled — kpmg-quiz.netlify.app is a different
// origin, so there's no postMessage/shared code to detect in-content
// completion from here. The player clicks through themselves once they're done.
export default function PillarQuizGate({ onNext, onBack, ctaLabel = 'Next →', showBack = true }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-y-auto grid place-items-center p-4"
        style={{
          backgroundColor: '#05070d',
          backgroundImage: `url(${gameBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(1200px 800px at 50% -10%, rgba(19,28,51,0.72) 0%, rgba(5,7,13,0.86) 55%, rgba(2,3,6,0.94) 100%)' }}
        />

        <motion.div
          initial={{ scale: 0.94, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="relative z-10 w-full max-w-5xl my-6 rounded-3xl p-6 md:p-8 border border-white/10 bg-black/10 backdrop-blur-[2px] shadow-2xl"
        >
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 text-cyan-300 font-semibold text-md tracking-[0.3em] mb-2">
              Emergency Management (OSH)
            </div>
            
          </div>

          {/* Responsive iframe frame — fills the available width, holds a 4:3-ish
              aspect ratio so it never balloons to fill a tall viewport. */}
          <div
            className="w-full rounded-2xl overflow-hidden border border-white/15 bg-black/40 shadow-xl"
            style={{ aspectRatio: '4 / 3', maxHeight: '65vh' }}
          >
            <iframe
              src="https://kpmg-quiz.netlify.app/"
              title="Iframe Example"
              className="w-full h-full border-0"
              allow="fullscreen"
            />
          </div>

          <div className={`flex items-center gap-3 mt-6 ${showBack ? 'justify-between' : 'justify-center'}`}>
            {showBack && (
              <button
                onClick={onBack}
                className="rounded-2xl px-5 py-3 text-sm font-bold uppercase tracking-wide text-white/70 border border-white/15 hover:bg-white/5 transition"
              >
                ← Back
              </button>
            )}
            <motion.button
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              onClick={onNext}
              className="rounded-2xl px-8 py-3 text-lg font-black uppercase tracking-wide text-[#031018]"
              style={{
                background: 'linear-gradient(135deg,#67e8f9,#22d3ee 55%,#0891b2)',
                boxShadow: '0 0 0 1px rgba(103,232,249,0.5), 0 18px 40px rgba(34,211,238,0.35)',
              }}
            >
              {ctaLabel}
            </motion.button>
          </div>
          <p className="text-center text-white/35 text-xs mt-3 font-medium">
            Done whenever you are.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
