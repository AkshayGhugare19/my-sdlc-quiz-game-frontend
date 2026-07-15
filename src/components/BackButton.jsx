import { useNavigate } from 'react-router-dom';

// Small pill back-control shown at the top-left of a flow screen.
// Steps back in real history when there is any (so "back" always returns to
// the screen the player actually came from — hub, dashboard, garage, …);
// `to` (or the dashboard) is only the fallback for deep links with no history.
// `dark` styles it for the dark Phaser race canvas.
export default function BackButton({ to, label = 'Back', onClick, dark = false }) {
  const navigate = useNavigate();

  const handle = () => {
    if (onClick) return onClick();
    if (window.history.state?.idx > 0) return navigate(-1);
    navigate(to || '/dashboard');
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
