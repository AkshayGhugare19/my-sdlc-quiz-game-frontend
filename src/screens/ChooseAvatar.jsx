import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { useGameStore } from '../store/gameStore';
import AvatarBadge from '../components/AvatarBadge';
import BackButton from '../components/BackButton';
import { avatarImage } from '../avatarImages';

// Screen 1 — Choose your avatar.
export default function ChooseAvatar() {
  const [avatars, setAvatars] = useState([]);
  const [selected, setSelected] = useState(null);
  const chooseAvatar = useGameStore((s) => s.chooseAvatar);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Where to go after picking an avatar. Defaults to the pillar hub (the full
  // "avatar → pillar" quest flow). A standalone mission launched from the
  // Missions tab passes `?next=/learn/<id>?missionId=<id>` so it skips the pillar
  // step; a bundle launched from the Mission Bundles tab passes `?next=/hub?...`.
  const next = searchParams.get('next') || '/hub';

  useEffect(() => {
    api.avatars().then((list) => {
      setAvatars(list);
      if (list[0]) setSelected(list.find((a) => a.isDefault) || list[0]);
    });
  }, []);

  const start = () => {
    chooseAvatar(selected);
    navigate(next);
  };

  return (
    <div className="min-h-full p-5 md:p-10 max-w-5xl mx-auto">
      <div className="mb-5">
        <BackButton to="/dashboard" />
      </div>

      <div className="flex items-center gap-3 mb-1">
        <div className="num-badge">1</div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-royal">CHOOSE YOUR AVATAR</h1>
      </div>
      <p className="text-slate-500 font-medium mb-8 ml-14">Pick your driver and start your resilience journey!</p>

      <div className="grid grid-cols-3 gap-3 md:gap-6 max-w-xl mx-auto">
        {avatars.map((a) => {
          const isSel = selected?.id === a.id;
          const img = avatarImage(a.key);
          return (
            <motion.button
              key={a.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              animate={{ scale: isSel ? 1.06 : 1 }}
              onClick={() => setSelected(a)}
              // Highlight the selected card with an OUTLINE (+ scale + glow), not
              // a ring/box-shadow: the `.panel` class sets its own box-shadow that
              // would override Tailwind's ring, and `overflow-hidden` would clip
              // it — outline is immune to both.
              className={`panel rounded-3xl overflow-hidden flex flex-col items-center transition ${isSel
                  ? 'outline outline-2 outline-offset-2 outline-neon drop-shadow-[0_0_16px_rgba(34,211,238,0.65)]'
                  : ''
                }`}
            >
              {/* Portrait photo (falls back to the procedural badge for any
                  avatar key without a bundled image). The portraits are
                  transparent cut-outs, so the box background shows behind them —
                  tint it with the accent (neon) colour when selected instead of
                  the neutral light wash. */}
              <div
                className="w-full aspect-[6/7] grid place-items-center overflow-hidden"
                style={{
                  background: isSel
                    ? 'linear-gradient(135deg, rgb(var(--c-neon) / 0.28), rgb(var(--c-neon) / 0.12))'
                    : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                }}
              >
                {img ? (
                  <img src={img} alt={a.name} className="w-full h-full object-cover" draggable="false" />
                ) : (
                  <AvatarBadge avatarKey={a.key} selected={isSel} size={112} />
                )}
              </div>
              {/* dark teal label bar */}
              <div
                className="w-full text-center py-2.5 font-extrabold uppercase tracking-wide text-white"
                style={{ background: isSel ? '#0e7490' : '#155e63' }}
              >
                {a.name}
              </div>
            </motion.button>
          );
        })}
      </div>
      <div className='w-full flex justify-center'>
        <button disabled={!selected} onClick={start} className="btn-primary w-2/3 mt-10 text-lg">
          START RESILIENCE QUEST →
        </button>
      </div>
    </div>
  );
}
