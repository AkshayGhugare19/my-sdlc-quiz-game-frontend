import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { useGameStore } from '../store/gameStore';
import AvatarBadge from '../components/AvatarBadge';
import BackButton from '../components/BackButton';

// Screen 1 — Choose your avatar.
export default function ChooseAvatar() {
  const [avatars, setAvatars] = useState([]);
  const [selected, setSelected] = useState(null);
  const chooseAvatar = useGameStore((s) => s.chooseAvatar);
  const navigate = useNavigate();

  useEffect(() => {
    api.avatars().then((list) => {
      setAvatars(list);
      if (list[0]) setSelected(list.find((a) => a.isDefault) || list[0]);
    });
  }, []);

  const start = () => {
    chooseAvatar(selected);
    navigate('/hub');
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
      <p className="text-slate-500 font-medium mb-8 ml-14">Pick your driver and start your SDLC journey!</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {avatars.map((a) => {
          const isSel = selected?.id === a.id;
          return (
            <motion.button
              key={a.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelected(a)}
              className={`panel rounded-3xl overflow-hidden flex flex-col items-center transition ${
                isSel ? 'ring-4 ring-neon shadow-[0_0_28px_rgba(34,211,238,0.45)]' : ''
              }`}
            >
              <div className="pt-6 pb-4 grid place-items-center w-full">
                <AvatarBadge avatarKey={a.key} selected={isSel} size={112} />
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

      <button disabled={!selected} onClick={start} className="btn-primary w-full mt-10 text-lg">
        START SDLC QUEST →
      </button>
    </div>
  );
}
