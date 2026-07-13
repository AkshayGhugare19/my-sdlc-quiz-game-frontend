// Lightweight avatar illustration (no image assets required). Deterministic
// gradient + emoji driver per avatar key.
const FACE = {
  alex: '🧑🏻', maya: '👩🏻', omar: '🧔🏽', aya: '🧕🏽', james: '🧑🏿', ava: '👩🏼',
};
const GRAD = {
  alex: 'from-sky-500 to-blue-700', maya: 'from-fuchsia-500 to-purple-700',
  omar: 'from-amber-500 to-orange-700', aya: 'from-emerald-500 to-teal-700',
  james: 'from-indigo-500 to-violet-700', ava: 'from-rose-500 to-pink-700',
};

export default function AvatarBadge({ avatarKey = 'alex', size = 96, selected = false }) {
  return (
    <div
      className={`rounded-2xl grid place-items-center bg-gradient-to-br ${GRAD[avatarKey] || GRAD.alex} ${
        selected ? 'ring-4 ring-neon' : 'ring-1 ring-white/10'
      }`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      <span>{FACE[avatarKey] || '🏎️'}</span>
    </div>
  );
}
