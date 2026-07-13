import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import BackButton from '../components/BackButton';

// Screen 3 — Learn first. Renders the storyboard beats on a "monitor" panel; any
// block flagged with config.interaction === 'CPR' shows the SPACE ×3 mini-beat.
export default function Learn() {
  const { missionId } = useParams();
  const [searchParams] = useSearchParams();
  // Present when this mission was opened FROM its bundle — carried through to
  // the race so bundle and standalone progress stay separate.
  const bundleId = searchParams.get('missionBundleId');
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [presses, setPresses] = useState(0);

  useEffect(() => {
    api.missionContent(missionId).then(setContent);
  }, [missionId]);

  const cprBlock = content?.contentBlocks?.find((b) => b.config?.interaction === 'CPR');
  const cprTarget = cprBlock?.config?.presses ?? 3;

  const onKey = useCallback(
    (e) => {
      if (e.code === 'Space' && cprBlock) {
        e.preventDefault();
        setPresses((p) => Math.min(cprTarget, p + 1));
      }
    },
    [cprBlock, cprTarget],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (!content) return <div className="min-h-full grid place-items-center text-slate-500">Loading briefing…</div>;

  const blocks = content.contentBlocks ?? [];

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

          <div className="text-cyan-300 text-xs font-bold tracking-widest mb-1">
            {content.course?.category}
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white mb-5">{content.course?.title}</h2>

          <div className="grid sm:grid-cols-3 gap-4 relative">
            {blocks.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white rounded-2xl p-5 shadow-lg"
              >
                <div className="w-8 h-8 rounded-full bg-royal text-white grid place-items-center font-extrabold mb-3">
                  {i + 1}
                </div>
                <h3 className="font-extrabold text-royal leading-tight">{b.title}</h3>
                <p className="text-slate-500 text-sm mt-2">{b.body}</p>

                {b.config?.interaction === 'CPR' && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-slate-400 mb-1">Press SPACE ×{cprTarget}</div>
                    <div className="flex gap-1">
                      {Array.from({ length: cprTarget }).map((_, k) => (
                        <div key={k} className={`h-2 flex-1 rounded ${k < presses ? 'bg-neon' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    {presses >= cprTarget && <div className="text-cyan-600 text-xs font-semibold mt-2">Great compressions! ✓</div>}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Coach + START */}
      <div className="flex items-end justify-between gap-4 mt-6 flex-wrap">
        <button onClick={() => navigate(`/race/${missionId}${bundleId ? `?missionBundleId=${bundleId}` : `?missionId=${missionId}`}`)} className="btn-primary text-lg">
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
