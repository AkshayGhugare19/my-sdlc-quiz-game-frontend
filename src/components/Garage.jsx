import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../services/api';
import { useGameStore } from '../store/gameStore';
import { accessoryIcon } from '../accessoryIcons';

const RARITY_STYLE = {
  common: 'bg-slate-100 text-slate-500',
  rare: 'bg-sky-100 text-sky-600',
  epic: 'bg-violet-100 text-violet-600',
  legendary: 'bg-amber-100 text-amber-600',
};

// Accessories Garage — the FULL catalog from GamifiedLearning : unlocked items can be
// equipped on the kart, locked ones stay visible with a padlock badge. Clicking
// a locked item opens the unlock modal: why it's locked, every requirement with
// the player's live progress, and where to go next.
export default function Garage() {
  const refreshProfile = useGameStore((s) => s.refreshProfile);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ unlocked: 0, total: 0 });
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null); // { text, isError }
  const [inspecting, setInspecting] = useState(null); // locked accessory shown in the modal

  const load = useCallback(async () => {
    try {
      const res = await api.garage();
      setItems(res.items || []);
      setCounts({ unlocked: res.unlockedCount ?? 0, total: res.totalCount ?? 0 });
    } catch (e) {
      setNotice({ text: e.message, isError: true });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const say = (text, isError = false) => {
    setNotice({ text, isError });
    setTimeout(() => setNotice(null), 3500);
  };

  const toggleEquip = async (item) => {
    if (!item.unlocked) {
      setInspecting(item); // locked → show the unlock plan instead of a toast
      return;
    }
    setBusyId(item.id);
    try {
      const res = await api.equipAccessory(item.id);
      say(res.isEquipped ? `"${item.name}" equipped on your kart 🏎️` : `"${item.name}" removed from your kart`);
      await load();
      refreshProfile(); // keep the HUD's equipped accessory in sync
    } catch (e) {
      say(e.message, true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="panel rounded-3xl p-4 w-full">
      <div className="text-center mb-1">
        <div className="text-royal text-xs font-extrabold tracking-[0.2em]">ACCESSORIES GARAGE</div>
        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
          {counts.unlocked}/{counts.total} unlocked · tap a locked item to see how to win it
        </div>
      </div>

      {notice && (
        <div
          className={`my-2 rounded-xl px-3 py-2 text-xs font-semibold ${
            notice.isError ? 'bg-red-500/10 text-red-500' : 'bg-neon/10 text-royal'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="mt-2 space-y-1.5">
        {items.length === 0 && <div className="text-sm text-slate-400 text-center">No accessories yet — check back soon!</div>}
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => toggleEquip(a)}
            disabled={busyId === a.id}
            className={`relative w-full rounded-2xl px-3 pt-3 pb-2 flex flex-col items-center text-center transition active:scale-95 ${
              a.isEquipped
                ? 'bg-neon/15 ring-2 ring-neon/50'
                : a.unlocked
                  ? 'bg-neon/5 ring-1 ring-neon/30 hover:bg-neon/10'
                  : 'bg-slate-50 hover:bg-slate-100'
            }`}
            title={a.unlocked ? a.slot : 'See how to unlock'}
          >
            <span className="absolute right-2 top-2">
              {a.unlocked ? (
                <span
                  className={`grid place-items-center min-w-[1.75rem] h-7 px-1.5 rounded-lg text-[9px] font-extrabold ${
                    a.isEquipped ? 'bg-neon text-white shadow' : 'bg-white text-cyan-600 ring-1 ring-neon/40'
                  }`}
                >
                  {busyId === a.id ? '…' : a.isEquipped ? '✓' : 'USE'}
                </span>
              ) : (
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-slate-700 text-white text-xs shadow">
                  🔒
                </span>
              )}
            </span>
            <span className={`text-4xl leading-none drop-shadow ${a.unlocked ? '' : 'opacity-80'}`}>
              {accessoryIcon(a)}
            </span>
            <span
              className={`mt-1.5 text-[10px] font-extrabold tracking-wider uppercase ${
                a.unlocked ? 'text-royal' : 'text-slate-500'
              }`}
            >
              {a.name}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {inspecting && <UnlockModal accessory={inspecting} onClose={() => setInspecting(null)} />}
      </AnimatePresence>
    </div>
  );
}

// "How do I get this?" — the unlock plan for one locked accessory: status,
// every requirement with the player's current progress, and the next action.
function UnlockModal({ accessory: a, onClose }) {
  const navigate = useNavigate();
  const unlock = a.unlock ?? { requirements: [], hint: null };
  const requirements = unlock.requirements ?? [];
  const doneCount = requirements.filter((r) => r.done).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="panel rounded-3xl p-6 w-full max-w-sm"
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl grid place-items-center text-4xl bg-slate-100 shrink-0">
            {accessoryIcon(a)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-extrabold text-royal leading-tight">{a.name}</h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-500">🔒 LOCKED</span>
              {a.slot && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{a.slot}</span>
              )}
              {a.rarity && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${RARITY_STYLE[a.rarity] || RARITY_STYLE.common}`}>
                  {a.rarity}
                </span>
              )}
            </div>
          </div>
        </div>

        {unlock.hint && (
          <p className="text-sm text-slate-500 font-medium mt-4">💡 {unlock.hint}</p>
        )}

        {requirements.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-extrabold tracking-widest text-slate-400">UNLOCK REQUIREMENTS</div>
              <div className="text-[10px] font-bold text-slate-400">{doneCount}/{requirements.length} met</div>
            </div>
            <div className="space-y-3">
              {requirements.map((r, i) => (
                <div key={i}>
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <span className={`font-semibold leading-snug ${r.done ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {r.done ? '✅' : '⭕'} {r.label}
                    </span>
                    <span className="font-extrabold text-royal whitespace-nowrap">
                      {r.current}/{r.target}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full ${r.done ? 'bg-emerald-400' : 'bg-neon'}`}
                      style={{ width: `${Math.min(100, Math.round(((r.current ?? 0) / (r.target || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reward preview — what equipping it means for the kart */}
        <div className="mt-4 rounded-2xl bg-royal/5 px-4 py-3">
          <div className="text-[10px] font-extrabold tracking-widest text-slate-400 mb-1">REWARD PREVIEW</div>
          <div className="text-sm font-semibold text-royal">
            {accessoryIcon(a)} Equips on your kart&apos;s <b>{a.slot ?? 'SPECIAL'}</b> slot — visible in every race.
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          {unlock.shopItemId ? (
            <button onClick={() => navigate('/accessories-shop')} className="btn-primary flex-1 !py-2.5 text-sm">
              🧰 Open Accessories Shop
            </button>
          ) : (
            <button onClick={onClose} className="btn-primary flex-1 !py-2.5 text-sm">
              🏎️ Race to win it
            </button>
          )}
          <button onClick={onClose} className="btn-ghost !py-2.5 text-sm">Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
