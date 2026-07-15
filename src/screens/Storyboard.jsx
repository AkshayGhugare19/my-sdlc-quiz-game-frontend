import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import BackButton from '../components/BackButton';
import StoryboardPanels from '../components/StoryboardPanels';

// Reusable pre-play briefing for a mission bundle / course / tournament. Renders
// the attached learning path's storyboard points exactly like a mission's "Learn
// first" screen. A "?next=<url>" param lets a caller continue into a race (e.g. a
// tournament) after the briefing; otherwise the button just returns.
export default function Storyboard() {
  const { learningPathId } = useParams();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const backTo = searchParams.get('back') || '/dashboard';
  const navigate = useNavigate();
  const [path, setPath] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.learningPath(learningPathId).then(setPath).catch((e) => setError(e.message));
  }, [learningPathId]);

  if (error) {
    return (
      <div className="min-h-full grid place-items-center p-6 text-center">
        <div>
          <p className="text-slate-500 font-semibold mb-4">Couldn&apos;t load this briefing — {error}</p>
          <button onClick={() => navigate(backTo)} className="btn-primary">Go back</button>
        </div>
      </div>
    );
  }
  if (!path) return <div className="min-h-full grid place-items-center text-slate-500">Loading briefing…</div>;

  const points = Array.isArray(path.points) ? path.points : [];
  const proceed = () => (next ? navigate(next) : navigate(backTo));

  return (
    <div className="min-h-full p-5 md:p-10 max-w-6xl mx-auto">
      <div className="mb-5">
        <BackButton to={backTo} />
      </div>

      <div className="flex items-center gap-3 mb-1">
        <div className="num-badge">★</div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-royal">{path.title || 'Briefing'}</h1>
      </div>
      <p className="text-slate-500 font-medium mb-6 ml-14">
        {path.description || 'Read the briefing before you begin.'}
      </p>

      {/* Monitor / screen panel with a dark bezel — same look as the mission Learn screen */}
      <div className="relative rounded-[2rem] p-3 md:p-4 bg-slate-900 shadow-2xl">
        <div className="rounded-[1.4rem] bg-slate-800/60 p-5 md:p-8 relative overflow-hidden">
          <div className="text-cyan-300 text-xs font-bold tracking-widest mb-1">Learning Path</div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white mb-5">{path.title}</h2>

          {points.length > 0 ? (
            <StoryboardPanels points={points} />
          ) : (
            <div className="rounded-2xl bg-white/10 border border-white/15 p-8 text-center text-white/70 font-semibold">
              This learning path has no briefing points yet.
            </div>
          )}
        </div>
      </div>

      {/* Coach + continue */}
      <div className="flex items-end justify-between gap-4 mt-6 flex-wrap">
        <button onClick={proceed} className="btn-primary text-lg">
          {next ? 'START RACE →' : 'DONE'}
        </button>
        <div className="flex items-end gap-3">
          <div className="panel rounded-2xl rounded-br-none px-4 py-3">
            <span className="font-semibold text-royal">You&apos;ve got this!</span>
          </div>
          <div className="text-6xl leading-none">🧑‍🏫</div>
        </div>
      </div>
    </div>
  );
}
