import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { useGameStore } from '../store/gameStore';
import { accessoryIcon } from '../accessoryIcons';

const RATING_COLOR = {
  GOLD: '#f59e0b',
  SILVER: '#94a3b8',
  BRONZE: '#c2703d',
  NONE: '#94a3b8',
};

const STATUS_STYLE = {
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  PASSED: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-600',
  LOCKED: 'bg-slate-100 text-slate-500',
  AVAILABLE: 'bg-sky-100 text-sky-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SCHEDULED: 'bg-sky-100 text-sky-700',
};

const MISSION_CTA = {
  AVAILABLE: '▶ Play',
  IN_PROGRESS: 'Continue',
  COMPLETED: 'Replay',
};

const TABS = [
  { id: 'overview', label: '🏠 Overview' },
  { id: 'courses', label: '📚 Courses' },
  { id: 'missions', label: '🎯 Missions' },
  { id: 'bundles', label: '📦 Mission Bundles' },
  { id: 'tournaments', label: '🏆 Tournaments' },
  { id: 'team', label: '👥 My Team' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05 } }),
};

function StatusPill({ status }) {
  if (!status) return null;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-500'}`}>
      {String(status).replace('_', ' ')}
    </span>
  );
}

// Player hub — landing screen after auth. Hero + stat tiles + tabbed panels.
export default function Dashboard() {
  const navigate = useNavigate();
  const logout = useGameStore((s) => s.logout);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [garage, setGarage] = useState(null);
  const [courses, setCourses] = useState(null); // null = still loading / unavailable
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    let alive = true;
    api
      .dashboard()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    api
      .team()
      .then((t) => alive && setTeam(t))
      .catch(() => alive && setTeam(null));
    api
      .garage()
      .then((g) => alive && setGarage(g))
      .catch(() => alive && setGarage(null)); // graceful: garage card is simply hidden
    api
      .courses()
      .then((c) => alive && setCourses(Array.isArray(c) ? c : []))
      .catch(() => alive && setCourses([])); // graceful: tab just shows "no courses"
    return () => {
      alive = false;
    };
  }, []);

  const doLogout = () => {
    logout();
    navigate('/login');
  };

  const profile = data?.profile ?? {};
  const stats = data?.stats ?? {};
  const pillars = data?.pillars ?? [];
  const recent = data?.recentAttempts ?? [];
  const badges = data?.badges ?? [];
  const missions = data?.missions ?? [];
  const tournaments = data?.tournaments ?? [];
  const rank = profile.rank ?? {};
  const rankColor = rank.color || '#0B3D91';
  // Certificate title configured by the org admin; falls back to the classic label.
  const certificateName = data?.certificateName || 'SDLC Champion';

  const started = (stats.missionsCompleted ?? 0) > 0;

  // Group missions per bundle for the "Mission Bundles" tab; pillars carry the
  // per-bundle progress (completionPct / stars / status).
  const bundles = useMemo(() => {
    const grouped = new Map();
    const standalone = [];
    for (const m of missions) {
      const key = m.bundleId ?? m.bundleTitle;
      if (!key) {
        standalone.push(m);
        continue;
      }
      if (!grouped.has(key)) {
        const pillar = pillars.find((p) => p.id === m.bundleId || p.title === m.bundleTitle) || null;
        grouped.set(key, { key, title: m.bundleTitle || pillar?.title || 'Bundle', pillar, missions: [] });
      }
      grouped.get(key).missions.push(m);
    }
    return { grouped: [...grouped.values()], standalone };
  }, [missions, pillars]);

  if (loading) {
    return <div className="min-h-full grid place-items-center text-slate-500">Loading your dashboard…</div>;
  }

  const tiles = [
    { icon: '🎯', label: 'Missions Completed', value: `${stats.missionsCompleted ?? 0}/${stats.totalMissions ?? 0}` },
    { icon: '📊', label: 'Average Score', value: `${Math.round(stats.averageScore ?? 0)}%` },
    { icon: '🎖️', label: 'Badges', value: stats.badges ?? badges.length ?? 0 },
    { icon: '🧰', label: 'Accessories', value: stats.accessories ?? 0 },
    { icon: '🔁', label: 'Attempts', value: stats.attempts ?? 0 },
  ];

  return (
    <div className="min-h-full p-5 md:p-10 max-w-6xl mx-auto">
      {/* Demo (guest) banner */}
      {profile.demo && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 px-5 py-3.5 mb-5 text-sm font-semibold"
        >
          🎭 Demo account — you can play everything, but points and rewards are not credited. Sign up as an
          employee for the full experience.
        </motion.div>
      )}

      {/* Hero header */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6 md:p-7">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Avatar profile={profile} />
            <div>
              <div className="text-royal text-xs font-bold tracking-widest">SDLC QUEST</div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-royal leading-tight">
                Welcome back, {profile.displayName || 'Champion'}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="pill text-white text-xs"
                  style={{ background: rankColor, boxShadow: `0 6px 16px ${rankColor}44` }}
                >
                  🏅 {rank.name || 'Recruit'}{rank.tier ? ` · ${rank.tier}` : ''}
                </span>
                <span className="pill bg-royal/10 text-royal text-xs">Level {profile.level ?? 1}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Metric icon="⚡" value={`${profile.totalXp ?? 0}`} label="XP" />
              <Metric icon="⭐" value={`${profile.stars ?? 0}`} label="Stars" />
              <Metric icon="🪙" value={`${profile.coins ?? 0}`} label="Coins" />
            </div>
            <button onClick={doLogout} className="pill bg-white border border-slate-200 text-slate-500 hover:text-red-500 ml-1">
              ⎋ Logout
            </button>
          </div>
        </div>

        {/* Primary actions */}
        <div className="flex gap-3 mt-5 flex-wrap">
          <button onClick={() => navigate('/avatar')} className="btn-primary flex-1 min-w-[200px]">
            {started ? 'Continue →' : '▶ Start SDLC Quest'}
          </button>
          {/* Casual practice race — fresh random questions every run; doesn't
              touch mission, bundle or tournament progress. */}
          <button
            onClick={() => navigate('/race/quick')}
            className="pill bg-royal/10 text-royal font-extrabold px-6 hover:bg-royal/20 min-w-[160px]"
          >
            🏁 Quick Race
          </button>
          <button
            onClick={() => navigate('/shop')}
            className="pill bg-royal/10 text-royal font-extrabold px-6 hover:bg-royal/20 min-w-[160px]"
          >
            🛒 Reward Shop
          </button>
          <button
            onClick={() => navigate('/accessories-shop')}
            className="pill bg-royal/10 text-royal font-extrabold px-6 hover:bg-royal/20 min-w-[160px]"
          >
            🧰 Accessories Shop
          </button>
          <button
            onClick={() => navigate('/garage')}
            className="pill bg-royal/10 text-royal font-extrabold px-6 hover:bg-royal/20 min-w-[160px]"
          >
            🏠 Garage
          </button>
        </div>
      </motion.div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mt-5">
        {tiles.map((t, i) => (
          <motion.div key={t.label} custom={i + 1} variants={fadeUp} initial="hidden" animate="show" className="panel rounded-2xl p-4">
            <div className="text-2xl">{t.icon}</div>
            <div className="text-2xl font-extrabold text-royal mt-1">{t.value}</div>
            <div className="text-xs font-semibold text-slate-400 mt-0.5">{t.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tab bar (scrolls horizontally on small screens) */}
      <div className="flex gap-2 mt-6 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pill whitespace-nowrap shrink-0 text-sm font-bold transition-colors ${
              tab === t.id
                ? 'text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-royal'
            }`}
            style={tab === t.id ? { background: 'var(--btn-grad)' } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-5">
        {tab === 'overview' && (
          <div className="space-y-5">
            <RoadmapPanel data={data} garage={garage} navigate={navigate} />
            <div className="grid lg:grid-cols-2 gap-5 items-start">
              <div className="space-y-5">
                <PillarsPanel pillars={pillars} />
                <ChampionCard pillars={pillars} navigate={navigate} certificateName={certificateName} />
              </div>
              <div className="space-y-5">
                <RecentPanel recent={recent} />
                <BadgesPanel badges={badges} />
                <GarageCard garage={garage} navigate={navigate} />
              </div>
            </div>
          </div>
        )}

        {tab === 'courses' && <CoursesPanel courses={courses} navigate={navigate} />}

        {tab === 'missions' && <MissionsPanel missions={missions} navigate={navigate} />}

        {tab === 'bundles' && (
          <div className="space-y-5">
            {missions.length === 0 && (
              <div className="panel rounded-3xl p-6">
                <p className="text-slate-400 text-sm">No missions published yet.</p>
              </div>
            )}
            {bundles.grouped.map((b, i) => (
              <BundleCard key={b.key} bundle={b} index={i} navigate={navigate} />
            ))}
            {bundles.standalone.length > 0 && (
              <BundleCard
                bundle={{ title: 'Standalone missions', pillar: null, missions: bundles.standalone }}
                index={bundles.grouped.length}
                navigate={navigate}
              />
            )}
          </div>
        )}

        {tab === 'tournaments' && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
            <h2 className="text-lg font-extrabold text-royal mb-1">Tournaments</h2>
            <p className="text-xs text-slate-400 mb-3">
              Join a tournament, then press 🏎️ Race to play a tournament race — only tournament races
              count toward the standings. Rewards are paid out automatically when the tournament ends.
            </p>
            <div className="divide-y divide-slate-100">
              {tournaments.length === 0 && (
                <p className="text-slate-400 text-sm">No open tournaments right now.</p>
              )}
              {tournaments.map((t) => (
                <TournamentRow key={t.id} tournament={t} />
              ))}
            </div>
          </motion.div>
        )}

        {tab === 'team' && <TeamCard team={team} />}
      </div>
    </div>
  );
}

// ── Overview panels ──────────────────────────────────────────────────────────

// The player journey roadmap: every milestone from signup to completing the
// collection, with live done/current state, per-step progress and an overall
// percentage — so the player always knows where they are and what's next.
function RoadmapPanel({ data, garage, navigate }) {
  const stats = data?.stats ?? {};
  const pillars = data?.pillars ?? [];
  const tournaments = data?.tournaments ?? [];
  const pillarsDone = pillars.filter((p) => p.status === 'COMPLETED').length;
  const allPillarsDone = pillars.length > 0 && pillarsDone === pillars.length;
  const unlockedAcc = garage?.unlockedCount ?? 0;
  const totalAcc = garage?.totalCount ?? 0;
  // tournamentHistory covers finished tournaments too — participation stays
  // done permanently, even after the tournament leaves the open list.
  const history = data?.tournamentHistory ?? {};
  const joinedTournament = !!history.joinedAny || tournaments.some((t) => t.joined);
  const tournamentPoints = !!history.scoredAny || tournaments.some((t) => (t.myScore ?? 0) > 0);

  const steps = [
    { icon: '📝', title: 'Sign up', detail: 'Account created', done: true },
    {
      icon: '🏎️',
      title: 'Play your first race',
      detail: `${stats.attempts ?? 0} race${(stats.attempts ?? 0) === 1 ? '' : 's'} played`,
      done: (stats.attempts ?? 0) > 0,
      go: () => navigate('/avatar'),
    },
    {
      icon: '🎯',
      title: 'Complete a mission',
      detail: `${stats.missionsCompleted ?? 0}/${stats.totalMissions ?? 0} missions`,
      done: (stats.missionsCompleted ?? 0) > 0,
      go: () => navigate('/hub'),
    },
    {
      icon: '🏛️',
      title: 'Complete all pillars',
      detail: `${pillarsDone}/${pillars.length || 3} pillars`,
      done: allPillarsDone,
      go: () => navigate('/hub'),
    },
    {
      icon: '🧰',
      title: 'Unlock accessories',
      detail: totalAcc ? `${unlockedAcc}/${totalAcc} unlocked` : 'Win gear by racing',
      done: totalAcc > 0 && unlockedAcc > 0,
      go: () => navigate('/hub'),
    },
    {
      icon: '🏆',
      title: 'Join a tournament',
      detail: joinedTournament ? 'Joined' : 'Compete with colleagues',
      done: joinedTournament,
    },
    {
      icon: '📈',
      title: 'Earn tournament points',
      detail: tournamentPoints ? 'On the leaderboard!' : 'Race in your tournament',
      done: tournamentPoints,
    },
    {
      icon: '👑',
      title: 'Complete the collection',
      detail: totalAcc ? `${unlockedAcc}/${totalAcc} accessories` : 'Own every accessory',
      done: totalAcc > 0 && unlockedAcc === totalAcc,
      go: () => navigate('/accessories-shop'),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const currentIdx = steps.findIndex((s) => !s.done);

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="text-lg font-extrabold text-royal">🗺️ Your Road to {data?.certificateName || 'Champion'}</h2>
        <span className="text-sm font-extrabold text-royal">{pct}% complete</span>
      </div>
      <ProgressBar pct={pct} />
      <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const isCurrent = i === currentIdx;
          return (
            <button
              key={s.title}
              onClick={s.go}
              disabled={!s.go}
              className={`shrink-0 w-32 rounded-2xl px-3 py-3 text-center transition ${
                s.done
                  ? 'bg-emerald-50 ring-1 ring-emerald-200'
                  : isCurrent
                  ? 'bg-royal/5 ring-2 ring-royal/50'
                  : 'bg-slate-50 opacity-70'
              } ${s.go ? 'hover:ring-royal/60 cursor-pointer' : 'cursor-default'}`}
            >
              <div className="text-2xl">{s.done ? '✅' : s.icon}</div>
              <div className={`text-[11px] font-extrabold leading-tight mt-1 ${s.done ? 'text-emerald-700' : 'text-royal'}`}>
                {s.title}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-tight">{s.detail}</div>
              {isCurrent && (
                <div className="text-[9px] font-extrabold tracking-widest text-royal mt-1">◀ YOU ARE HERE</div>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function PillarsPanel({ pillars }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      <h2 className="text-lg font-extrabold text-royal mb-4">Your Pillars</h2>
      <div className="space-y-5">
        {pillars.length === 0 && <p className="text-slate-400 text-sm">No pillars yet — start your quest!</p>}
        {pillars.map((p) => (
          <div key={p.id}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-700">{p.title}</span>
              <span className="text-sm text-slate-400 font-semibold">
                ⭐ {p.starsEarned ?? 0}/{p.maxStars ?? 5}
              </span>
            </div>
            <ProgressBar pct={p.completionPct} />
            <div className="text-xs text-slate-400 mt-1">{Math.round(p.completionPct ?? 0)}% complete</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function RecentPanel({ recent }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      <h2 className="text-lg font-extrabold text-royal mb-4">Recent activity</h2>
      <div className="divide-y divide-slate-100">
        {recent.length === 0 && <p className="text-slate-400 text-sm">No attempts yet.</p>}
        {recent.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="font-semibold text-slate-700 truncate">{a.missionTitle}</div>
              <div className="text-xs text-slate-400">
                {'★'.repeat(Math.min(5, a.stars ?? 0))}
                {a.completedAt ? ` · ${new Date(a.completedAt).toLocaleDateString()}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-extrabold text-royal">{Math.round(a.scorePct ?? 0)}%</span>
              {a.rating && a.rating !== 'NONE' && (
                <span className="text-xs font-extrabold" style={{ color: RATING_COLOR[a.rating] || '#0B3D91' }}>
                  {a.rating}
                </span>
              )}
              <StatusPill status={a.status} />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function BadgesPanel({ badges }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      <h2 className="text-lg font-extrabold text-royal mb-4">Earned badges</h2>
      {badges.length === 0 ? (
        <p className="text-slate-400 text-sm">No badges yet — complete a mission to earn one!</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {badges.map((b, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-1">
              <div className="w-14 h-14 rounded-2xl grid place-items-center text-2xl bg-gradient-to-br from-amber-100 to-amber-200 ring-1 ring-amber-300">
                {b.iconUrl ? <img src={b.iconUrl} alt="" className="w-8 h-8" /> : '🎖️'}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 leading-tight">{b.name}</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Compact horizontal strip of the player's kart accessories. Hidden entirely
// when the garage endpoint fails or has nothing to show.
function GarageCard({ garage, navigate }) {
  const items = garage?.items ?? [];
  if (!garage || items.length === 0) return null;
  const unlocked = garage.unlockedCount ?? items.filter((a) => a.unlocked).length;
  const total = garage.totalCount ?? items.length;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-extrabold text-royal">Accessories Garage</h2>
        <span className="text-xs font-bold text-slate-400 whitespace-nowrap">{unlocked}/{total} unlocked</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((a) => (
          <div
            key={a.id}
            title={a.name}
            className={`relative w-12 h-12 rounded-xl grid place-items-center text-2xl shrink-0 bg-royal/5 ${
              a.isEquipped ? 'ring-2 ring-royal' : ''
            } ${a.unlocked ? '' : 'opacity-50'}`}
          >
            {accessoryIcon(a)}
            {!a.unlocked && (
              <span className="absolute -bottom-1 -right-1 text-xs drop-shadow">🔒</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <button onClick={() => navigate('/garage')} className="text-royal text-sm font-bold hover:underline">
          Open garage →
        </button>
        <button onClick={() => navigate('/accessories-shop')} className="text-royal text-sm font-bold hover:underline">
          Accessories Shop →
        </button>
      </div>
    </motion.div>
  );
}

// Champion progress — gold card once every pillar is COMPLETED. The title comes
// from the org's certificate template (certificateName), not a hardcoded label.
function ChampionCard({ pillars, navigate, certificateName = 'SDLC Champion' }) {
  if (pillars.length === 0) return null;
  const completed = pillars.filter((p) => p.status === 'COMPLETED');
  const isChampion = completed.length === pillars.length;

  if (isChampion) {
    return (
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="panel rounded-3xl p-6 text-center bg-gradient-to-b from-amber-50 to-white ring-1 ring-amber-300"
      >
        <div className="text-5xl mb-2">🏆</div>
        <h2 className="text-lg font-extrabold text-royal">You are a {certificateName}!</h2>
        <p className="text-slate-500 text-sm mt-1 mb-4">Every pillar completed — outstanding work.</p>
        <button onClick={() => navigate('/champion')} className="btn-primary w-full">
          View Champion screen →
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-lg font-extrabold text-royal">🏆 {certificateName}</h2>
        <span className="text-sm font-extrabold text-royal whitespace-nowrap">
          {completed.length}/{pillars.length}
        </span>
      </div>
      <p className="text-slate-500 text-sm mb-3">
        Complete all {pillars.length} pillars to become a {certificateName}.
      </p>
      <div className="space-y-1.5">
        {pillars.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span>{p.status === 'COMPLETED' ? '✅' : '⭕'}</span>
            <span className={p.status === 'COMPLETED' ? 'font-semibold text-slate-700' : 'text-slate-400'}>
              {p.title}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Courses (learning roadmaps) ──────────────────────────────────────────────
// One card per course. A course is a roadmap that REFERENCES missions, bundles
// and tournaments — each item shows its OWN progress (standalone mission,
// bundle flow, tournament entry) and the header shows the course rollup.
// Completing every item issues the course certificate automatically.
function CoursesPanel({ courses, navigate }) {
  if (courses === null) {
    return <div className="panel rounded-3xl p-6 text-slate-400 text-sm">Loading courses…</div>;
  }
  if (courses.length === 0) {
    return (
      <div className="panel rounded-3xl p-6">
        <h2 className="text-lg font-extrabold text-royal mb-1">Courses</h2>
        <p className="text-slate-400 text-sm">
          No courses published yet — your admin can build one from missions, bundles and tournaments.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {courses.map((c, i) => (
        <CourseCard key={c.id} course={c} index={i} navigate={navigate} />
      ))}
    </div>
  );
}

function CourseCard({ course: c, index, navigate }) {
  const done = !!c.completed;
  return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      {/* Header: title + meta + rollup */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {c.coverUrl ? (
            <img src={c.coverUrl} alt="" className="w-14 h-14 rounded-2xl object-cover ring-1 ring-royal/15 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-2xl grid place-items-center text-2xl bg-royal/5 shrink-0">📚</div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-royal leading-tight">{c.title}</h2>
            {c.summary && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{c.summary}</p>}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {c.difficulty && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {c.difficulty}
                </span>
              )}
              {c.estimatedMin != null && (
                <span className="text-xs text-slate-400 font-semibold">⏱ ~{c.estimatedMin} min</span>
              )}
              {done && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  COMPLETED
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-extrabold text-royal">{Math.round(c.completionPct ?? 0)}%</div>
          <div className="text-[10px] font-semibold tracking-widest text-slate-400">COURSE PROGRESS</div>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar pct={c.completionPct} />
      </div>

      {/* Certificate */}
      {c.certificateSerial ? (
        <div className="mt-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-4 py-2.5 text-sm font-bold text-amber-700">
          📜 Certificate earned — serial {c.certificateSerial}
        </div>
      ) : (
        c.hasCertificateTemplate && (
          <div className="mt-3 text-xs text-slate-400 font-semibold">
            📜 Finish every item below to earn this course&apos;s certificate.
          </div>
        )
      )}

      {/* Briefing — this course's attached learning path storyboard */}
      {c.learningPathId && (
        <button
          onClick={() => navigate(`/storyboard/${c.learningPathId}?back=/dashboard`)}
          className="mt-3 pill bg-royal/10 text-royal text-xs font-bold hover:bg-royal/20"
        >
          📖 View briefing
        </button>
      )}

      {/* Missions */}
      {c.missions?.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">🎯 Missions</div>
          <div className="divide-y divide-slate-100">
            {c.missions.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 font-semibold text-slate-700 text-sm truncate">{m.title}</div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400 font-semibold">
                    ⭐ {m.starsEarned ?? 0}/{m.maxStars ?? 5}
                  </span>
                  <StatusPill status={m.status} />
                  <button
                    onClick={() => navigate(`/learn/${m.id}?courseId=${c.id}`)}
                    className="pill bg-royal/10 text-royal text-xs font-bold hover:bg-royal/20"
                  >
                    {MISSION_CTA[m.status] || '▶ Play'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mission bundles */}
      {c.bundles?.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">📦 Mission Bundles</div>
          {c.bundles.map((b) => (
            <div key={b.id} className="rounded-2xl bg-royal/[0.03] ring-1 ring-royal/10 px-4 py-3 mb-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="font-bold text-slate-700 text-sm">{b.title}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">
                    ⭐ {b.starsEarned ?? 0}/{b.maxStars ?? 5}
                  </span>
                  <span className="text-xs text-slate-400">{Math.round(b.completionPct ?? 0)}%</span>
                  <StatusPill status={b.status} />
                </div>
              </div>
              <div className="divide-y divide-slate-100 mt-1">
                {(b.missions ?? []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0 text-sm font-semibold text-slate-600 truncate">{m.title}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400 font-semibold">
                        ⭐ {m.starsEarned ?? 0}/{m.maxStars ?? 5}
                      </span>
                      <StatusPill status={m.status} />
                      <button
                        onClick={() => navigate(`/learn/${m.id}?missionBundleId=${m.bundleId}&courseId=${c.id}`)}
                        className="pill bg-royal/10 text-royal text-xs font-bold hover:bg-royal/20"
                      >
                        {MISSION_CTA[m.status] || '▶ Play'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tournaments */}
      {c.tournaments?.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">🏆 Tournaments</div>
          <div className="divide-y divide-slate-100">
            {c.tournaments.map((t) => (
              <TournamentRow key={t.id} tournament={t} courseLearningPathId={c.learningPathId} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Missions ─────────────────────────────────────────────────────────────────

function MissionsPanel({ missions, navigate }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      <h2 className="text-lg font-extrabold text-royal mb-1">Missions</h2>
      <p className="text-xs text-slate-400 mb-4">
        Your individual mission progress — tracked separately from any bundle.
      </p>
      <div className="divide-y divide-slate-100">
        {missions.length === 0 && <p className="text-slate-400 text-sm">No missions published yet.</p>}
        {missions.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="font-semibold text-slate-700 truncate">{m.title}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {m.bundleTitle && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-royal/10 text-royal">
                    {m.bundleTitle}
                  </span>
                )}
                {m.difficulty && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {m.difficulty}
                  </span>
                )}
                <span className="text-xs text-slate-400 font-semibold">
                  ⭐ {m.starsEarned ?? 0}/{m.maxStars ?? 5}
                </span>
                <span className="text-xs text-slate-400">{Math.round(m.completionPct ?? 0)}%</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusPill status={m.status} />
              <button
                onClick={() => navigate(`/learn/${m.id}?missionId=${m.id}`)}
                className="pill bg-royal/10 text-royal text-xs font-bold hover:bg-royal/20"
              >
                {MISSION_CTA[m.status] || '▶ Play'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// One card per mission bundle: bundle-level progress + its missions as rows.
function BundleCard({ bundle, index, navigate }) {
  const p = bundle.pillar;
  return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <h2 className="text-lg font-extrabold text-royal">{bundle.title}</h2>
        <div className="flex items-center gap-2">
          {p?.status && <StatusPill status={p.status} />}
          {p && (
            <span className="text-sm text-slate-400 font-semibold">
              ⭐ {p.starsEarned ?? 0}/{p.maxStars ?? 5}
            </span>
          )}
        </div>
      </div>
      {p && (
        <>
          <ProgressBar pct={p.completionPct} />
          <div className="text-xs text-slate-400 mt-1">
            {Math.round(p.completionPct ?? 0)}% complete · counts races started from this bundle only
          </div>
        </>
      )}

      {/* Briefing — this bundle's attached learning path storyboard */}
      {bundle.pillar?.learningPathId && (
        <button
          onClick={() => navigate(`/storyboard/${bundle.pillar.learningPathId}?back=/dashboard`)}
          className="mt-2 pill bg-royal/10 text-royal text-xs font-bold hover:bg-royal/20"
        >
          📖 View briefing
        </button>
      )}

      <div className="divide-y divide-slate-100 mt-2">
        {/* Rows show the mission's BUNDLE-flow progress (races started from this
            bundle) — separate from its standalone progress on the Missions tab —
            and launch with the bundle context so it stays that way. */}
        {bundle.missions.map((m) => {
          const bp = m.bundleProgress || {};
          return (
            <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0 font-semibold text-slate-700 text-sm truncate">{m.title}</div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400 font-semibold">
                  ⭐ {bp.starsEarned ?? 0}/{m.maxStars ?? 5}
                </span>
                <StatusPill status={bp.status} />
                <button
                  onClick={() => navigate(`/learn/${m.id}${m.bundleId ? `?missionBundleId=${m.bundleId}` : ''}`)}
                  className="pill bg-royal/10 text-royal text-xs font-bold hover:bg-royal/20"
                >
                  {MISSION_CTA[bp.status] || '▶ Play'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Tournaments ──────────────────────────────────────────────────────────────

// Live countdown to a tournament's end — ticks every second so players see
// exactly how long they have left to climb the standings.
function EndsCountdown({ endsAt, status }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endsAt || status !== 'ACTIVE') return null;

  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
        🏁 Ended — final rankings & rewards on the way
      </span>
    );
  }
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const label = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  const urgent = ms < 3600000; // under an hour — make it pop
  return (
    <span
      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full tabular-nums ${
        urgent ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-amber-100 text-amber-700'
      }`}
    >
      ⏳ Ends in {label}
    </span>
  );
}

// "500 XP + 200 🪙 + 5 ⭐" from one placement's prize object.
function prizeText(p) {
  if (!p) return null;
  const parts = [p.xp ? `${p.xp} XP` : null, p.coins ? `${p.coins} 🪙` : null, p.stars ? `${p.stars} ⭐` : null].filter(Boolean);
  return parts.length ? parts.join(' + ') : null;
}

// The tournament's top-3 prize pool, paid automatically at the end.
function PrizePool({ prizes }) {
  const medals = ['🥇', '🥈', '🥉'];
  const rows = [1, 2, 3]
    .map((place, i) => ({ medal: medals[i], text: prizeText(prizes?.[String(place)]) }))
    .filter((r) => r.text);
  if (!rows.length) return null;
  return (
    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
      <span className="text-[10px] font-extrabold tracking-widest text-slate-400">PRIZE POOL</span>
      {rows.map((r) => (
        <span key={r.medal} className="text-xs font-bold text-slate-500">
          {r.medal} {r.text}
        </span>
      ))}
    </div>
  );
}

// Podium styling for the player's live placement chip.
function placementClass(place) {
  if (place === 1) return 'bg-amber-100 text-amber-700 ring-1 ring-amber-300';
  if (place === 2) return 'bg-slate-200 text-slate-600 ring-1 ring-slate-300';
  if (place === 3) return 'bg-orange-100 text-orange-700 ring-1 ring-orange-300';
  return 'bg-slate-100 text-slate-500';
}

// One tournament row with its own join state (success / error notes inline).
function TournamentRow({ tournament: t, courseLearningPathId }) {
  const navigate = useNavigate();
  const setActiveTournament = useGameStore((s) => s.setActiveTournament);
  const [joined, setJoined] = useState(!!t.joined);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { kind: 'ok'|'err', text }

  const join = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await api.joinTournament(t.id);
      setJoined(true);
      setNote({
        kind: 'ok',
        text: res?.alreadyJoined ? 'You had already joined this tournament.' : `You're in! Good luck in ${t.name}.`,
      });
    } catch (e) {
      setNote({ kind: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  // Start THIS tournament's own race — its questions come from the tournament's
  // configured pool, and only tournament races count. If a learning path is
  // attached, show its storyboard briefing first, then continue into the race.
  const raceNow = () => {
    setActiveTournament({ id: t.id, name: t.name, metric: t.metric });
    // Entered through a course that has its own learning path? That course path
    // overrides the tournament's own briefing (course > individual entity).
    const briefingLpId = courseLearningPathId || t.learningPathId;
    if (briefingLpId) {
      navigate(`/storyboard/${briefingLpId}?next=${encodeURIComponent('/race/tournament')}&back=/dashboard`);
    } else {
      navigate('/race/tournament');
    }
  };

  const dates = [t.startsAt, t.endsAt]
    .filter(Boolean)
    .map((d) => new Date(d).toLocaleDateString())
    .join(' → ');

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-700 truncate">{t.name}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {t.type && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {String(t.type).replace('_', ' ')}
              </span>
            )}
            {t.metric && <span className="text-xs text-slate-400 font-semibold">📈 {t.metric}</span>}
            {dates && <span className="text-xs text-slate-400">{dates}</span>}
            <EndsCountdown endsAt={t.endsAt} status={t.status} />
          </div>
          <PrizePool prizes={t.prizes} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Course-roadmap requirement: permanent once joined + played. */}
          {t.requirementMet && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              ✓ COMPLETED
            </span>
          )}
          <StatusPill status={t.status} />
          {joined ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                🏁 {t.myScore ?? 0} pts · ★ {t.myStars ?? 0}
              </span>
              {t.myPlacement != null && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${placementClass(t.myPlacement)}`}>
                  #{t.myPlacement}
                </span>
              )}
              {t.status === 'ACTIVE' && (
                <button
                  onClick={raceNow}
                  className="pill text-white text-xs font-bold"
                  style={{ background: 'var(--btn-grad)' }}
                >
                  🏎️ Race
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={join}
              disabled={busy}
              className="pill bg-royal/10 text-royal text-xs font-bold hover:bg-royal/20 disabled:opacity-50"
            >
              {busy ? 'Joining…' : 'Join'}
            </button>
          )}
        </div>
      </div>
      {note && (
        <div className={`text-xs mt-1.5 ${note.kind === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
          {note.text}
        </div>
      )}
    </div>
  );
}

// ── Team ─────────────────────────────────────────────────────────────────────

function TeamCard({ team }) {
  const groups = [
    { label: 'Admins', people: team?.admins ?? [] },
    { label: 'Managers', people: team?.managers ?? [] },
    { label: 'Trainers', people: team?.trainers ?? [] },
  ].filter((g) => g.people.length > 0);
  const reportsTo = team?.reportsTo ?? [];
  const empty = !team || (groups.length === 0 && reportsTo.length === 0 && !team.department);

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel rounded-3xl p-6">
      <h2 className="text-lg font-extrabold text-royal mb-1">Your Team</h2>
      {team?.department?.name && (
        <div className="text-xs font-semibold text-slate-400 mb-3">🏢 {team.department.name}</div>
      )}
      {empty ? (
        <p className="text-slate-400 text-sm mt-2">Team details aren&apos;t available yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 mt-2">
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">{g.label}</div>
                <div className="space-y-2">
                  {g.people.map((p) => (
                    <PersonRow key={p.id} person={p} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {reportsTo.length > 0 && (
            <div>
              <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
                Your progress reports to
              </div>
              <div className="space-y-2.5">
                {reportsTo.map((p) => (
                  <div key={p.id}>
                    <PersonRow person={p} />
                    {p.why && <div className="text-[11px] text-slate-400 mt-0.5 ml-11">{p.why}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function PersonRow({ person: p }) {
  const initials = (p.name || p.email || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 min-w-0">
      {p.avatarUrl ? (
        <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-royal/20 shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-extrabold bg-royal/10 text-royal shrink-0">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-700 truncate">{p.name || p.email}</div>
      </div>
      {p.role && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
          {String(p.role).replace('_', ' ')}
        </span>
      )}
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function ProgressBar({ pct }) {
  return (
    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct ?? 0)}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ background: 'var(--btn-grad)' }}
      />
    </div>
  );
}

function Metric({ icon, value, label }) {
  return (
    <div className="text-center rounded-2xl bg-royal/5 px-3 py-2 min-w-[64px]">
      <div className="text-lg font-extrabold text-royal leading-none">
        {icon} {value}
      </div>
      <div className="text-[10px] font-semibold tracking-widest text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function Avatar({ profile }) {
  if (profile.avatarUrl) {
    return <img src={profile.avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-royal/20" />;
  }
  return (
    <div className="w-16 h-16 rounded-2xl grid place-items-center text-3xl bg-gradient-to-br from-sky-400 to-blue-700 ring-2 ring-white shadow-lg">
      🧑‍🚀
    </div>
  );
}
