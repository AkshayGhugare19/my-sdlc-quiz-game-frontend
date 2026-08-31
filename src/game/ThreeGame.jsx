import { useEffect, useRef } from 'react';
import ThreeRaceScene from './ThreeRaceScene';
import ThreeSubwayScene from './ThreeSubwayScene';
import ThreeCarPreviewScene from './ThreeCarPreviewScene';

// All three scenes implement the identical imperative contract (constructor
// shape, onLaneLayout, setLane, startRacing/applyQuestion/playFeedback/
// resetSigns/destroy — the preview scene's are no-ops), so the Race/CarPreview
// screens drive whichever one they're given interchangeably. 'racing-car' (the
// "2D Games" section's car game) reuses the same three.js circuit as 'racing'
// — it just never goes through the Unity iframe (see config/unityRace.js).
const SCENES = {
  racing: ThreeRaceScene,
  'racing-car': ThreeRaceScene,
  subway: ThreeSubwayScene,
  preview: ThreeCarPreviewScene,
};

// Minimal event emitter — replaces Phaser.Events.EventEmitter for the one
// 'setLane' channel the Race screen uses, without pulling Phaser in.
export function createEmitter() {
  const handlers = {};
  return {
    on(event, fn) {
      (handlers[event] ??= []).push(fn);
    },
    off(event, fn) {
      handlers[event] = (handlers[event] || []).filter((h) => h !== fn);
    },
    emit(event, ...args) {
      (handlers[event] || []).forEach((fn) => fn(...args));
    },
  };
}

// Boots the three.js race scene into a div and hands the live scene back to
// React via onReady — the same contract PhaserGame.jsx had, so the Race screen
// can keep pushing questions / feedback imperatively.
export default function ThreeGame({ emitter, laneCount, avatarKey, avatarName, accessories, gameType, carDesignId, onLaneLayout, onTelemetry, onReady }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const SceneClass = SCENES[gameType] || ThreeRaceScene;
    const scene = new SceneClass({
      container: containerRef.current,
      emitter,
      laneCount,
      avatarKey,
      avatarName,
      accessorySlots: (accessories || []).map((a) => a?.slot).filter(Boolean),
      carDesignId,
    });
    scene.onLaneLayout = onLaneLayout;
    scene.onTelemetry = onTelemetry;
    onReady?.(scene);
    return () => scene.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
