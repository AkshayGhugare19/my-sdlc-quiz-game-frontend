import Phaser from 'phaser';

// Pseudo-3D road + kart-with-driver, styled to match the "ANSWER BY RACING"
// reference art (kart seen from behind, name plate, neon wings, exhaust flames,
// city skyline). The answer cards + HUD are an HTML overlay (Race.jsx); this
// scene only renders the moving road and the kart, and steers it between lanes.
// Grading stays server-authoritative — the scene never scores anything.

const AVATAR_COLORS = {
  alex: { helmet: 0x1f2937, jacket: 0x111827, skin: 0xf1c9a5 },
  maya: { helmet: 0x7e22ce, jacket: 0x4c1d95, skin: 0xf1c9a5 },
  omar: { helmet: 0xb45309, jacket: 0x78350f, skin: 0xd9a066 },
  aya: { helmet: 0x0f766e, jacket: 0x134e4a, skin: 0xd9a066 },
  james: { helmet: 0x3730a3, jacket: 0x1e1b4b, skin: 0x8d5524 },
  ava: { helmet: 0x9f1239, jacket: 0x881337, skin: 0xf1c9a5 },
};

export default class RaceScene extends Phaser.Scene {
  constructor() {
    super('race');
  }

  init(data) {
    this.emitter = data.emitter;
    this.laneCount = data.laneCount || 3;
    this.avatarKey = data.avatarKey || 'alex';
    this.avatarName = (data.avatarName || 'ALEX').toUpperCase();
    this.locked = true;
    this.pos = 0;
    this.speed = 0;
    this.steerVisual = 0;
    this.currentLane = Math.floor(this.laneCount / 2);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W;
    this.H = H;
    this.horizon = Math.round(H * 0.4);

    // ── Sky gradient + sun + city skyline (drawn once) ──
    const sky = this.add.graphics();
    const top = Phaser.Display.Color.IntegerToColor(0x9fc6e8);
    const bot = Phaser.Display.Color.IntegerToColor(0xf3d9c0);
    for (let i = 0; i < this.horizon; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bot, this.horizon, i);
      sky.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      sky.fillRect(0, i, W, 1);
    }
    sky.fillStyle(0xffffff, 0.85);
    sky.fillCircle(W * 0.7, this.horizon - 60, 40);
    // City skyline silhouette
    sky.fillStyle(0x8fa9c4, 0.9);
    for (let i = 0; i < 26; i++) {
      const bw = 22 + (i % 5) * 12;
      const bh = 30 + ((i * 47) % 90);
      sky.fillRect(i * (W / 24) - 8, this.horizon - bh, bw, bh);
      sky.fillStyle(0x8fa9c4, 0.9);
    }
    // Roadside grass band just under horizon
    sky.fillStyle(0x3f7d3f, 1);
    sky.fillRect(0, this.horizon, W, 6);

    this.road = this.add.graphics();

    // ── Kart with driver (third-person, from behind) ──
    this.kart = this.add.container(this.laneX(this.currentLane), H - 92);
    this.buildKart(this.kart);

    if (this.emitter) {
      // React drives selection; scene reacts to lane changes.
      this.emitter.on('setLane', (lane) => this.steerTo(lane));
    }
  }

  buildKart(container) {
    const col = AVATAR_COLORS[this.avatarKey] || AVATAR_COLORS.alex;

    const g = this.add.graphics();
    // Shadow
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(0, 62, 150, 30);

    // Neon wings (equipped accessory) behind the driver
    g.fillStyle(0x22d3ee, 0.55);
    g.beginPath();
    g.moveTo(-24, -16);
    g.lineTo(-96, -40);
    g.lineTo(-90, -20);
    g.lineTo(-24, 2);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(24, -16);
    g.lineTo(96, -40);
    g.lineTo(90, -20);
    g.lineTo(24, 2);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x67e8f9, 0.5);
    g.fillTriangle(-30, -14, -70, -30, -34, -4);
    g.fillTriangle(30, -14, 70, -30, 34, -4);

    // Rear wing bar
    g.fillStyle(0x0f172a, 1);
    g.fillRoundedRect(-58, 8, 116, 12, 4);
    // Fat rear wheels
    g.fillStyle(0x0b0f17, 1);
    g.fillRoundedRect(-74, 16, 30, 46, 8);
    g.fillRoundedRect(44, 16, 30, 46, 8);
    g.fillStyle(0x374151, 1);
    g.fillRoundedRect(-69, 28, 20, 22, 5);
    g.fillRoundedRect(49, 28, 20, 22, 5);

    // Kart body (dark, tapered)
    g.fillStyle(0x1b2430, 1);
    g.beginPath();
    g.moveTo(-34, -26);
    g.lineTo(34, -26);
    g.lineTo(52, 44);
    g.lineTo(-52, 44);
    g.closePath();
    g.fillPath();
    // Cyan under-glow strips
    g.fillStyle(0x22d3ee, 0.7);
    g.fillRoundedRect(-52, 40, 14, 8, 3);
    g.fillRoundedRect(38, 40, 14, 8, 3);
    container.add(g);

    // Name plate (like "ALEX" on the seat back)
    const plate = this.add.graphics();
    plate.fillStyle(0x0b1220, 1);
    plate.fillRoundedRect(-30, -8, 60, 22, 5);
    container.add(plate);
    const nameText = this.add.text(0, 3, this.avatarName, {
      fontFamily: 'Poppins', fontSize: '14px', color: '#e6eefc', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(nameText);

    // Driver seen from behind: shoulders + back of helmet
    const d = this.add.graphics();
    d.fillStyle(col.jacket, 1);
    d.fillRoundedRect(-22, -30, 44, 26, 10); // shoulders/back
    d.fillStyle(col.skin, 1);
    d.fillRoundedRect(-6, -40, 12, 8, 3); // neck
    d.fillStyle(col.helmet, 1);
    d.fillCircle(0, -44, 15); // helmet back
    d.fillStyle(0xffffff, 0.85);
    d.fillRect(-2, -58, 4, 12); // helmet stripe
    d.fillStyle(0x0b1220, 0.4);
    d.fillEllipse(0, -40, 22, 10); // helmet base shade
    container.add(d);

    // Exhaust flames (shown on correct / turbo)
    this.flames = this.add.container(0, 58);
    const f1 = this.add.triangle(-20, 0, 0, 0, 16, 0, 8, 30, 0xf59e0b).setAlpha(0);
    const f2 = this.add.triangle(20, 0, 0, 0, 16, 0, 8, 30, 0xf59e0b).setAlpha(0);
    const f3 = this.add.triangle(0, 6, 0, 0, 18, 0, 9, 40, 0xfbbf24).setAlpha(0);
    this.flames.add([f1, f2, f3]);
    this.flameParts = [f1, f2, f3];
    container.add(this.flames);

    // Smoke (shown on wrong answers)
    this.smoke = this.add.container(0, 40);
    const s1 = this.add.circle(0, 0, 16, 0x6b7280, 0).setAlpha(0);
    const s2 = this.add.circle(-10, -14, 12, 0x9ca3af, 0).setAlpha(0);
    this.smoke.add([s1, s2]);
    this.smokeParts = [s1, s2];
    container.add(this.smoke);
  }

  setFlames(on) {
    this.flameParts?.forEach((p) => p.setAlpha(on ? 0.9 : 0));
  }
  setSmoke(on) {
    this.smokeParts?.forEach((p) => p.setAlpha(on ? 0.7 : 0));
  }

  laneX(i) {
    const spread = this.W * 0.2;
    const mid = (this.laneCount - 1) / 2;
    return this.W / 2 + (i - mid) * spread;
  }

  update(_time, delta) {
    const target = this.locked ? 0.3 : 1;
    this.speed += (target - this.speed) * 0.05;
    this.pos += this.speed * delta * 0.02;

    const { W, H, horizon } = this;
    const g = this.road;
    g.clear();

    const bottom = H;
    const step = 6;
    const nearHalf = W * 0.42;
    const farHalf = W * 0.028;
    const cx = W / 2; // STRAIGHT track — no curve

    for (let y = horizon; y < bottom; y += step) {
      const p = (y - horizon) / (bottom - horizon);
      const persp = p * p;
      const half = Phaser.Math.Linear(farHalf, nearHalf, persp);
      const band = Math.floor((1 - p) * 46 + this.pos);
      const even = band % 2 === 0;
      const barrierW = Math.max(2, persp * W * 0.05);
      const curbW = Math.max(2, half * 0.07);

      // Grass verges
      g.fillStyle(even ? 0x3f8a3a : 0x469a40, 1);
      g.fillRect(0, y, W, step + 1);
      // Silver highway guardrails just outside the track
      g.fillStyle(even ? 0x9aa7b8 : 0xcdd6e2, 1);
      g.fillRect(cx - half - barrierW, y, barrierW, step + 1);
      g.fillRect(cx + half, y, barrierW, step + 1);
      // Asphalt
      g.fillStyle(even ? 0x444a56 : 0x4c525f, 1);
      g.fillRect(cx - half, y, half * 2, step + 1);
      // White edge lines
      g.fillStyle(even ? 0xe5e7eb : 0xf8fafc, 1);
      g.fillRect(cx - half, y, curbW, step + 1);
      g.fillRect(cx + half - curbW, y, curbW, step + 1);
      // Straight white lane dashes
      if (even) {
        g.fillStyle(0xf8fafc, 0.95);
        for (let l = 1; l < this.laneCount; l++) {
          const lx = cx - half + (half * 2 * l) / this.laneCount;
          g.fillRect(lx - half * 0.025, y, Math.max(2, half * 0.05), step + 1);
        }
      }
    }

    // Motion streaks near the kart for speed feel.
    if (!this.locked && this.speed > 0.7) {
      g.fillStyle(0xffffff, 0.1);
      for (let s = 0; s < 5; s++) {
        const sx = W / 2 + (Math.sin(this.pos + s * 1.3) * W) / 3.5;
        const sy = H * 0.6 + ((this.pos * 46 + s * 70) % (H * 0.36));
        g.fillRect(sx, sy, 2, 20);
      }
    }

    this.steerVisual *= 0.9;
    if (this.kart) this.kart.rotation = this.steerVisual * 0.09;
  }

  steerTo(lane) {
    this.currentLane = Phaser.Math.Clamp(lane, 0, this.laneCount - 1);
    this.steerVisual = Phaser.Math.Clamp(this.steerVisual + 0.6, -1, 1);
    this.tweens.add({ targets: this.kart, x: this.laneX(this.currentLane), duration: 160, ease: 'Quad.out' });
  }

  startRacing() {
    this.locked = false;
    this.setFlames(false);
  }

  applyQuestion() {
    this.locked = false;
    this.setFlames(false);
    this.setSmoke(false);
    this.currentLane = Math.floor(this.laneCount / 2);
    this.tweens.add({ targets: this.kart, x: this.laneX(this.currentLane), duration: 140 });
  }

  playFeedback({ isCorrect }) {
    this.locked = true;
    if (isCorrect) {
      this.setFlames(true);
      this.tweens.add({ targets: this.kart, y: this.kart.y - 18, yoyo: true, duration: 200 });
    } else {
      this.setSmoke(true);
    }
    this.cameras.main.flash(220, isCorrect ? 20 : 130, isCorrect ? 200 : 20, 40);
    this.cameras.main.shake(180, isCorrect ? 0.002 : 0.006);
  }

  resetSigns() {
    this.setFlames(false);
    this.setSmoke(false);
  }
}
