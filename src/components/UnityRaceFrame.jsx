import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';

// The Racing game, played inside the externally-hosted Unity WebGL build rather
// than the in-repo three.js scene. Race.jsx routes here when USE_UNITY_RACE is
// on (see src/config/unityRace.js); the whole three.js path is still in place
// behind that flag as the backup.
//
// Auth handoff: our access token sits in sessionStorage, which a cross-origin
// iframe cannot read, and putting the token itself in the URL would leak it via
// Referer/history/server logs. So we mint a ONE-TIME code (POST /auth/handoff)
// the moment before the iframe mounts, pass it as ?code=…, and the Unity side
// exchanges it (POST /auth/handoff/exchange) for its own tokens. The code dies
// on first use, or ~2 minutes after minting — hence: mint, then immediately set
// src. Never hoist the mint to a parent that renders early.
//
// Deliberately NOT sandboxed: the Unity build needs same-origin access to its
// own localStorage/IndexedDB (that's where it keeps the exchanged token) and a
// `sandbox` attribute without `allow-same-origin` silently breaks both.

function Shell({ children }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-6 text-center"
      style={{ background: 'radial-gradient(1200px 800px at 50% -10%, #131c33 0%, #05070d 55%, #020306 100%)' }}
    >
      {children}
    </div>
  );
}

export default function UnityRaceFrame({ title = 'Racing', onQuit, onFallback, onFinish }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // StrictMode double-mounts effects in dev; without this we'd burn two codes
  // and swap iframe.src mid-boot.
  const mintedRef = useRef(false);

  const mint = useCallback(async () => {
    setError(null);
    setLoaded(false);
    try {
      const { code, gameUrl } = await api.createHandoff();
      // The API hands back a ready-built URL from its own GAME_CLIENT_URL; a
      // local override (VITE_UNITY_RACE_URL) wins, for pointing at a dev build.
      const u = new URL(import.meta.env.VITE_UNITY_RACE_URL || gameUrl, window.location.origin);
      u.searchParams.set('code', code);
      // Which backend MINTED this code. The Unity build has an API host compiled
      // in, so without being told otherwise a local site and a prod-built client
      // mint and redeem against different databases — and every code then looks
      // "invalid or expired". Unity should prefer this over its baked-in host.
      u.searchParams.set('api', api.baseUrl);
      setUrl(u.toString());
    } catch (e) {
      setUrl(null);
      setError(e.message || 'Could not start the race');
    }
  }, []);

  useEffect(() => {
    if (mintedRef.current) return;
    mintedRef.current = true;
    mint();
  }, [mint]);

  const retry = () => {
    mintedRef.current = true;
    mint();
  };

  if (error) {
    return (
      <Shell>
        <div className="max-w-md">
          <div className="text-5xl mb-3">🏁</div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wide">Couldn't reach the track</h2>
          <p className="text-white/50 font-medium mt-2">{error}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={retry}
              className="rounded-2xl px-6 py-3 font-black uppercase tracking-wide text-[#031018]"
              style={{ background: 'linear-gradient(135deg,#67e8f9,#22d3ee 55%,#0891b2)' }}
            >
              Try again
            </button>
            {onFallback && (
              <button
                type="button"
                onClick={onFallback}
                className="pill text-white/90 bg-white/10 border border-white/20 backdrop-blur"
              >
                Play the classic race
              </button>
            )}
            {onQuit && (
              <button type="button" onClick={onQuit} className="pill text-white/70 bg-white/5 border border-white/10">
                Quit
              </button>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  if (!url) {
    return (
      <Shell>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white/70 font-bold tracking-wide uppercase text-sm"
        >
          🏁 Warming up the grid…
        </motion.div>
      </Shell>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <iframe
        src={url}
        title={title}
        onLoad={() => setLoaded(true)}
        className="w-full h-full block border-0"
        // Unity WebGL wants pointer lock for mouse-look and fullscreen for the
        // expand button; autoplay lets engine audio start without a second gesture.
        allow="autoplay; fullscreen; gamepad; xr-spatial-tracking; pointer-lock"
        allowFullScreen
      />

      {!loaded && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none bg-[#05070d]">
          <div className="text-white/70 font-bold tracking-wide uppercase text-sm">🏁 Loading the track…</div>
        </div>
      )}

      {/* The iframe swallows keyboard events, so the only way out has to live
          outside it. Sits above the frame in its own stacking context. */}
      {onQuit && (
        <button
          type="button"
          onClick={onQuit}
          className="absolute top-4 left-4 z-10 pill text-white/90 hover:text-white bg-black/50 border border-white/20 backdrop-blur"
        >
          <span className="text-base leading-none">←</span>
          Quit
        </button>
      )}

      {/* The Unity build grades and completes its own session server-side but
          has no bridge back to this page to say "the race just ended" — so the
          player confirms it themselves once they see their in-game result. */}
      {onFinish && loaded && (
        <button
          type="button"
          onClick={onFinish}
          className="absolute top-4 right-4 z-10 pill text-[#031018] font-black uppercase tracking-wide"
          style={{ background: 'linear-gradient(135deg,#67e8f9,#22d3ee 55%,#0891b2)' }}
        >
          🏁 Finish Race
        </button>
      )}
    </div>
  );
}
