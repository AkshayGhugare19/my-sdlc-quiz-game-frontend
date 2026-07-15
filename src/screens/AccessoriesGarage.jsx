import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BackButton from '../components/BackButton';
import { api } from '../services/api';
import { useGameStore } from '../store/gameStore';
import { accessoryIcon } from '../accessoryIcons';

const RARITY_STYLE = {
  common: 'bg-slate-100 text-slate-500',
  rare: 'bg-sky-100 text-sky-600',
  epic: 'bg-violet-100 text-violet-600',
  legendary: 'bg-amber-100 text-amber-600',
};

// How the accessory was obtained → badge shown on the card.
const SOURCE_BADGE = {
  SHOP: { icon: '🛒', label: 'Purchased' },
  MISSION: { icon: '🏁', label: 'Reward' },
  SEED: { icon: '🎁', label: 'Reward' },
  DEFAULT: { icon: '🚗', label: 'Starter gear' },
};

// Accessories Garage — ONLY the accessories the player owns (purchased,
// rewarded or starter gear). Equip/unequip happens here; buying does NOT —
// that's the Accessories Shop's job.
export default function AccessoriesGarage() {
  const navigate = useNavigate();
  const refreshProfile = useGameStore((s) => s.refreshProfile);
  const [items, setItems] = useState(null); // null = loading
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null); // { text, isError }

  const load = useCallback(async () => {
    try {
      const res = await api.garage();
      // The garage page shows OWNED accessories only.
      setItems((res.items || []).filter((a) => a.unlocked));
    } catch (e) {
      setItems([]);
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

  if (items === null) {
    return <div className="min-h-full grid place-items-center text-slate-500">Opening your garage…</div>;
  }

  const equipped = items.filter((a) => a.isEquipped);
  const unequipped = items.filter((a) => !a.isEquipped);

  return (
    <div className="min-h-full p-5 md:p-10 max-w-6xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <BackButton />
        <button
          onClick={() => navigate('/accessories-shop')}
          className="pill bg-royal/10 text-royal text-xs font-bold hover:bg-royal/20"
        >
          🧰 Get more gear in the Accessories Shop →
        </button>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel rounded-3xl p-6 md:p-7 flex items-center justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="text-royal text-xs font-bold tracking-widest">SDLC QUEST</div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-royal leading-tight">🏠 Accessories Garage</h1>
          <p className="text-slate-500 text-sm mt-1">
            Your collection — purchased and rewarded accessories. Equip one per slot on your kart.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-royal">{items.length}</div>
          <div className="text-[10px] font-semibold tracking-widest text-slate-400">OWNED</div>
        </div>
      </motion.div>

      {notice && (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            notice.isError ? 'bg-red-500/10 text-red-500' : 'bg-neon/10 text-royal'
          }`}
        >
          {notice.text}
        </div>
      )}

      {items.length === 0 ? (
        <div className="panel rounded-3xl p-8 mt-5 text-center">
          <div className="text-5xl mb-2">🗄️</div>
          <p className="text-slate-500 font-semibold">Your garage is empty.</p>
          <p className="text-slate-400 text-sm mt-1">
            Buy accessories in the Accessories Shop, or win reward accessories by racing missions.
          </p>
          <button onClick={() => navigate('/accessories-shop')} className="btn-primary mt-4">
            🧰 Open Accessories Shop
          </button>
        </div>
      ) : (
        <>
          {/* Equipped on the kart */}
          <div className="mt-6">
            <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
              ✓ Equipped on your kart
            </div>
            {equipped.length === 0 ? (
              <div className="panel rounded-3xl p-5 text-sm text-slate-400">
                Nothing equipped — pick an accessory below and press Equip.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {equipped.map((a) => (
                  <GarageCard key={a.id} item={a} busy={busyId === a.id} onToggle={() => toggleEquip(a)} />
                ))}
              </div>
            )}
          </div>

          {/* The rest of the collection */}
          {unequipped.length > 0 && (
            <div className="mt-6">
              <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">Your collection</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {unequipped.map((a) => (
                  <GarageCard key={a.id} item={a} busy={busyId === a.id} onToggle={() => toggleEquip(a)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GarageCard({ item: a, busy, onToggle }) {
  const source = SOURCE_BADGE[a.source] || null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`panel rounded-3xl p-5 flex flex-col ${a.isEquipped ? 'ring-2 ring-neon/50 bg-neon/5' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-2xl grid place-items-center text-3xl bg-royal/5 shrink-0">
          {accessoryIcon(a)}
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-royal leading-snug">{a.name}</div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {a.slot && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{a.slot}</span>
            )}
            {a.rarity && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${RARITY_STYLE[a.rarity] || RARITY_STYLE.common}`}>
                {a.rarity}
              </span>
            )}
            {source && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-royal/10 text-royal">
                {source.icon} {source.label}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto pt-4">
        {a.isEquipped ? (
          <span className="text-xs font-bold text-cyan-600">✓ On your kart</span>
        ) : (
          <span className="text-xs font-semibold text-slate-400">In the garage</span>
        )}
        <button
          onClick={onToggle}
          disabled={busy}
          className={
            a.isEquipped
              ? 'pill bg-white border border-slate-200 text-slate-500 text-xs font-bold hover:text-royal disabled:opacity-50'
              : 'btn-primary text-sm px-4 py-2 disabled:opacity-50'
          }
        >
          {busy ? '…' : a.isEquipped ? 'Unequip' : 'Equip'}
        </button>
      </div>
    </motion.div>
  );
}
