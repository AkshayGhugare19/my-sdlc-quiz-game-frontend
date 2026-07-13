import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import BackButton from '../components/BackButton';
import { api } from '../services/api';

const KIND_EMOJI = {
  ACCESSORY: '🧰',
  COUPON: '🎟️',
  TITLE: '🏷️',
  COMPANY_REWARD: '🎁',
  BADGE: '🎖️',
  CUSTOM: '✨',
};

function priceLine(item) {
  const parts = [];
  if (item.priceCoins > 0) parts.push(`🪙 ${item.priceCoins}`);
  if (item.priceStars > 0) parts.push(`⭐ ${item.priceStars}`);
  return parts.length ? parts.join(' · ') : 'Free';
}

// Reward Shop — spend coins/stars on accessories, coupons and company rewards.
export default function Shop() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({}); // itemId → { kind: 'ok'|'err', text }

  const load = useCallback(async () => {
    try {
      const d = await api.shop();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buy = async (item) => {
    setBusyId(item.id);
    setNotes((n) => ({ ...n, [item.id]: null }));
    try {
      const res = await api.buyShopItem(item.id);
      // Wallet comes back on the order response — reflect it immediately.
      setData((d) => (d ? { ...d, wallet: res?.wallet ?? d.wallet } : d));
      setNotes((n) => ({
        ...n,
        [item.id]: {
          kind: 'ok',
          text:
            res?.status === 'FULFILLED'
              ? '✓ Purchased — added to your garage!'
              : '✓ Order placed — your admin will fulfil it.',
        },
      }));
      await load(); // refresh owned/stock/canAfford flags
    } catch (e) {
      setNotes((n) => ({ ...n, [item.id]: { kind: 'err', text: e.message } }));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="min-h-full grid place-items-center text-slate-500">Loading the shop…</div>;
  }

  const wallet = data?.wallet ?? {};
  const items = data?.items ?? [];

  return (
    <div className="min-h-full p-5 md:p-10 max-w-6xl mx-auto">
      <div className="mb-5">
        <BackButton to="/dashboard" />
      </div>

      {/* Header + wallet */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel rounded-3xl p-6 md:p-7 flex items-center justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="text-royal text-xs font-bold tracking-widest">SDLC QUEST</div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-royal leading-tight">🛒 Reward Shop</h1>
          <p className="text-slate-500 text-sm mt-1">Spend your hard-earned coins and stars on rewards.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill bg-amber-100 text-amber-700 font-extrabold">🪙 {wallet.coins ?? 0}</span>
          <span className="pill bg-royal/10 text-royal font-extrabold">⭐ {wallet.stars ?? 0}</span>
        </div>
      </motion.div>

      {/* Demo (guest) banner */}
      {data?.demo && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 px-5 py-3.5 mt-5 text-sm font-semibold">
          🎭 Demo account — you can browse the shop, but demo accounts can&apos;t buy.
        </div>
      )}

      {/* Items */}
      {!data ? (
        <p className="text-slate-400 text-sm mt-8 text-center">The shop couldn&apos;t be loaded. Try again later.</p>
      ) : items.length === 0 ? (
        <p className="text-slate-400 text-sm mt-8 text-center">Nothing on the shelves yet — check back soon!</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.04 } }}
              className="panel rounded-3xl p-5 flex flex-col"
            >
              <div className="flex items-start gap-3">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-2xl object-cover ring-1 ring-royal/10 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl grid place-items-center text-3xl bg-royal/5 shrink-0">
                    {KIND_EMOJI[item.kind] || '✨'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-extrabold text-royal leading-snug">{item.name}</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {String(item.kind || '').replace('_', ' ')}
                  </span>
                </div>
              </div>

              {item.description && <p className="text-sm text-slate-500 mt-3">{item.description}</p>}

              <div className="flex items-center justify-between gap-2 mt-auto pt-4">
                <div>
                  <div className="font-extrabold text-royal">{priceLine(item)}</div>
                  {item.stock != null && !item.soldOut && (
                    <div className="text-[11px] text-slate-400 font-semibold">{item.stock} left</div>
                  )}
                </div>
                <BuyButton item={item} busy={busyId === item.id} onBuy={() => buy(item)} />
              </div>

              {notes[item.id] && (
                <div className={`text-xs mt-2 font-semibold ${notes[item.id].kind === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {notes[item.id].text}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function BuyButton({ item, busy, onBuy }) {
  if (item.owned) {
    return <span className="pill bg-emerald-100 text-emerald-700 text-xs font-bold">Owned ✓</span>;
  }
  if (item.soldOut) {
    return (
      <button disabled className="pill bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed">
        Sold out
      </button>
    );
  }
  if (!item.canAfford) {
    // Still clickable — the server replies with a helpful "you need N more coins".
    return (
      <button
        onClick={onBuy}
        disabled={busy}
        className="pill bg-white border border-slate-200 text-slate-500 text-xs font-bold hover:text-royal disabled:opacity-50"
      >
        {busy ? 'Buying…' : 'Need more coins'}
      </button>
    );
  }
  return (
    <button onClick={onBuy} disabled={busy} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
      {busy ? 'Buying…' : 'Buy'}
    </button>
  );
}
