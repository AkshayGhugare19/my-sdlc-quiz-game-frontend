import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { THEMES, getTheme, applyTheme } from '../theme.js';

// Floating theme picker, present on every screen (bottom-right so it never
// collides with back buttons or the race HUD).
export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(getTheme);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pick = (key) => {
    applyTheme(key);
    setTheme(key);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="panel rounded-2xl p-2 w-44"
          >
            <div className="px-2 pt-1 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Theme</div>
            {THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => pick(t.key)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition hover:bg-slate-100 ${
                  theme === t.key ? 'text-royal' : 'text-slate-500'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full shrink-0 ring-1 ring-black/10"
                  style={{ background: `linear-gradient(120deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
                />
                <span className="flex-1 text-left">{t.label}</span>
                {theme === t.key && <span className="text-neon">✓</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
        className="w-11 h-11 rounded-full panel grid place-items-center text-xl shadow-lg transition active:scale-90"
      >
        🎨
      </button>
    </div>
  );
}
