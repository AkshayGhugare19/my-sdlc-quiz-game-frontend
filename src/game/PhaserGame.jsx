import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import RaceScene from './RaceScene';

// Boots one Phaser game into a div and hands the live scene back to React via
// onReady, so the Race screen can push questions / feedback imperatively.
export default function PhaserGame({ emitter, laneCount, avatarKey, avatarName, firstQuestion, onReady }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    const parent = containerRef.current;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#0b1220',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 900,
        height: 560,
      },
      scene: RaceScene,
    });
    gameRef.current = game;

    game.scene.start('race', { emitter, laneCount, avatarKey, avatarName, question: firstQuestion });
    // Give React a handle to the running scene once it's created.
    const wait = setInterval(() => {
      const scene = game.scene.getScene('race');
      if (scene && scene.sys.isActive()) {
        clearInterval(wait);
        onReady?.(scene);
      }
    }, 50);

    return () => {
      clearInterval(wait);
      game.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
