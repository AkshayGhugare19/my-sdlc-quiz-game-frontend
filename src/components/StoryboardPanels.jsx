import { motion } from 'framer-motion';

// A learning-path storyboard: an ordered grid of "point" panels, each with an
// image banner, a numbered badge, title, description and an instruction beat
// (the 6-panel chapter layout). Shared by the mission "Learn first" screen and
// the standalone Storyboard briefing screen so a mission bundle / course /
// tournament shows exactly the same panels as a mission.
export default function StoryboardPanels({ points = [] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 relative">
      {points.map((p, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col"
        >
          {p.imageUrl ? (
            <div className="h-28 w-full bg-slate-100 overflow-hidden">
              <img
                src={p.imageUrl}
                alt={p.title || `Point ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.parentElement.style.display = 'none';
                }}
              />
            </div>
          ) : null}
          <div className="p-5 flex flex-col gap-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-royal text-white grid place-items-center font-extrabold">
              {i + 1}
            </div>
            {p.title && <h3 className="font-extrabold text-royal leading-tight">{p.title}</h3>}
            {p.description && <p className="text-slate-500 text-sm">{p.description}</p>}
            {p.instructions && (
              <div className="mt-auto pt-2">
                <div className="rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold px-3 py-2">
                  {p.instructions}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
