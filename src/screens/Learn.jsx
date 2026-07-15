import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import BackButton from '../components/BackButton';
import StoryboardPanels from '../components/StoryboardPanels';

// Screen 3 — Learn first. The pre-race briefing is driven ONLY by an attached
// learning path: its ordered points render as the storyboard. A mission with no
// learning path has no briefing, so the player is sent straight to the race.
export default function Learn() {
  const { missionId } = useParams();
  const [searchParams] = useSearchParams();
  // Entry context. `missionBundleId` = opened FROM its bundle (kept through to the
  // race so bundle vs standalone progress stay separate). `courseId` = opened from
  // a course roadmap. Both decide which briefing shows (course > bundle > mission).
  const bundleId = searchParams.get('missionBundleId');
  const courseId = searchParams.get('courseId');
  const navigate = useNavigate();
  const [content, setContent] = useState(null);

  const raceUrl = `/race/${missionId}${bundleId ? `?missionBundleId=${bundleId}` : `?missionId=${missionId}`}`;

  useEffect(() => {
    api
      .missionContent(missionId, {
        ...(bundleId ? { missionBundleId: bundleId } : {}),
        ...(courseId ? { courseId } : {}),
      })
      .then(setContent);
  }, [missionId, bundleId, courseId]);

  const learningPath = content?.learningPath;
  const points = Array.isArray(learningPath?.points) ? learningPath.points : [];
  const showPoints = points.length > 0;

  // No learning path attached → nothing to brief, so skip straight to the race.
  // replace: this screen must not linger in history and bounce the player back.
  useEffect(() => {
    if (content && !showPoints) navigate(raceUrl, { replace: true });
  }, [content, showPoints, raceUrl, navigate]);

  if (!content) return <div className="min-h-full grid place-items-center text-slate-500">Loading briefing…</div>;
  if (!showPoints) return <div className="min-h-full grid place-items-center text-slate-500">Starting race…</div>;

  const heading = learningPath?.title || content.mission?.title || 'Briefing';

  return (
    <div className="min-h-full p-5 md:p-10 max-w-6xl mx-auto">
      <div className="mb-5">
        <BackButton to="/hub" />
      </div>

      <div className="flex items-center gap-3 mb-1">
        <div className="num-badge">3</div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-royal">LEARN FIRST</h1>
      </div>
      <p className="text-slate-500 font-medium mb-6 ml-14">Drive in and learn the key knowledge.</p>

      {/* Monitor / screen panel with a dark bezel */}
      <div className="relative rounded-[2rem] p-3 md:p-4 bg-slate-900 shadow-2xl">
        <div className="rounded-[1.4rem] bg-slate-800/60 p-5 md:p-8 relative overflow-hidden">
          {/* central play-button overlay */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur grid place-items-center ring-2 ring-white/40">
              <span className="text-white text-3xl ml-1">▶</span>
            </div>
          </div>

          <div className="text-cyan-300 text-xs font-bold tracking-widest mb-1">Learning Path</div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white mb-5">{heading}</h2>

          <StoryboardPanels points={points} />
        </div>
      </div>

      {/* Coach + START */}
      <div className="flex items-end justify-between gap-4 mt-6 flex-wrap">
        <button onClick={() => navigate(raceUrl)} className="btn-primary text-lg">
          START →
        </button>
        <div className="flex items-end gap-3">
          <div className="panel rounded-2xl rounded-br-none px-4 py-3">
            <span className="font-semibold text-royal">Let&apos;s get started!</span>
          </div>
          <div className="text-6xl leading-none">🧑‍🏫</div>
        </div>
      </div>
    </div>
  );
}
