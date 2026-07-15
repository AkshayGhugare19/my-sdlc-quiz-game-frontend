import { useNavigate } from 'react-router-dom';

// Small pill back-control shown at the top-left of a flow screen, paired with a
// Home shortcut. Back steps through real history when there is any (so it always
// returns to the screen the player actually came from — hub, dashboard, garage,
// …); `to` (or the dashboard) is only the fallback for deep links with no
// history. Home always jumps straight to the dashboard. `dark` styles both for
// the dark race canvas.
// Props: `home` (show the Home button, default true), `homeTo` (Home
// destination, default /dashboard), `onHome` (override Home behaviour — e.g. the
// race confirms before abandoning).
export default function BackButton({
  to,
  label = 'Back',
  onClick,
  onHome,
  home = true,
  homeTo = '/dashboard',
  dark = false,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) return onClick();
    if (window.history.state?.idx > 0) return navigate(-1);
    navigate(to || '/dashboard');
  };

  const handleHome = () => {
    if (onHome) return onHome();
    navigate(homeTo);
  };

  const cls = dark
    ? 'pill text-white/90 hover:text-white bg-white/10 border border-white/20 backdrop-blur'
    : 'pill text-royal bg-white border border-royal/15 hover:border-royal/40 shadow-sm';

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={handleBack} className={cls}>
        <span className="text-base leading-none">←</span>
        {label}
      </button>
      {home && (
        <button type="button" onClick={handleHome} className={cls} aria-label="Home">
          <span className="text-base leading-none">🏠</span>
          Home
        </button>
      )}
    </span>
  );
}
