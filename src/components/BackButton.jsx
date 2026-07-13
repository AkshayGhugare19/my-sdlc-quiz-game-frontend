import { useNavigate } from 'react-router-dom';

// Small pill back-control shown at the top-left of a flow screen.
// Navigates to `to` if provided, otherwise steps back in history.
// `dark` styles it for the dark Phaser race canvas.
export default function BackButton({ to, label = 'Back', onClick, dark = false }) {
  const navigate = useNavigate();

  const handle = () => {
    if (onClick) return onClick();
    if (to) navigate(to);
    else navigate(-1);
  };

  return (
    <button
      type="button"
      onClick={handle}
      className={
        dark
          ? 'pill text-white/90 hover:text-white bg-white/10 border border-white/20 backdrop-blur'
          : 'pill text-royal bg-white border border-royal/15 hover:border-royal/40 shadow-sm'
      }
    >
      <span className="text-base leading-none">←</span>
      {label}
    </button>
  );
}
