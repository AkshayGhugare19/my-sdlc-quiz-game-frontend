import { useEffect, useRef } from 'react';
import ThreeRaceScene from './ThreeRaceScene';
import ThreeSubwayScene from './ThreeSubwayScene';

// Both scenes implement the identical imperative contract (constructor shape,
// onLaneLayout, setLane, startRacing/applyQuestion/playFeedback/resetSigns/
// destroy), so the Race screen drives whichever one it's given interchangeably.
const SCENES = { racing: ThreeRaceScene, subway: ThreeSubwayScene };

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
export default function ThreeGame({ emitter, laneCount, avatarKey, avatarName, accessories, gameType, onLaneLayout, onReady }) {
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
    });
    scene.onLaneLayout = onLaneLayout;
    onReady?.(scene);
    return () => scene.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
