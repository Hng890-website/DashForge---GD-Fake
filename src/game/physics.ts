import { CEILING_HEIGHT, FIXED_DT, GRID_SIZE, PHYSICS, SPEED_VALUES } from './constants';
import { GameMode, LevelData, LevelObject, SpeedTier } from '../types/game';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface SpiderBeam {
  x: number;
  y1: number;
  y2: number;
  life: number;
  color: string;
}

export interface CheckpointState {
  id: string;
  x: number;
  cy: number;
  vy: number;
  mode: GameMode;
  speed: SpeedTier;
  gravityDir: 1 | -1;
  isMini: boolean;
  rotation: number;
  songTime: number;
  collectedCoins: number[];
}

export interface PlayerState {
  x: number;
  cy: number;
  vy: number;
  mode: GameMode;
  speed: SpeedTier;
  gravityDir: 1 | -1;
  isMini: boolean;
  grounded: boolean;
  rotation: number;
  robotHoldTime: number;
  isHoldingJump: boolean;
  dashing: boolean;
  dead: boolean;
  deathTimer: number;
  won: boolean;
  winTimer: number;
  trail: { x: number; cy: number; mode: GameMode }[];
  particles: Particle[];
  spiderBeams: SpiderBeam[];
  activatedObjects: Set<string>;
  collectedCoins: number[];
  jumpsThisAttempt: number;
  songTime: number;
  screenShake: number;
  flashAlpha: number;
}

export interface HitboxDebug {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'player' | 'solid' | 'hazard' | 'orb' | 'portal' | 'coin';
}

export interface SoundCallbacks {
  onJump: () => void;
  onOrb: () => void;
  onPad: () => void;
  onPortal: () => void;
  onCoin: () => void;
  onDeath: () => void;
  onWin: () => void;
}

export function getLevelLengthX(level: LevelData): number {
  let maxX = 40 * GRID_SIZE;
  for (const obj of level.objects) {
    if (obj.type === 'end_wall') {
      return obj.x * GRID_SIZE;
    }
    if ((obj.x + 1) * GRID_SIZE > maxX) {
      maxX = (obj.x + 1) * GRID_SIZE;
    }
  }
  return maxX + 6 * GRID_SIZE;
}

export function createInitialPlayerState(level: LevelData, checkpoint?: CheckpointState | null): PlayerState {
  if (checkpoint) {
    return {
      x: checkpoint.x,
      cy: checkpoint.cy,
      vy: checkpoint.vy,
      mode: checkpoint.mode,
      speed: checkpoint.speed,
      gravityDir: checkpoint.gravityDir,
      isMini: checkpoint.isMini,
      grounded: false,
      rotation: checkpoint.rotation,
      robotHoldTime: 0,
      isHoldingJump: false,
      dashing: false,
      dead: false,
      deathTimer: 0,
      won: false,
      winTimer: 0,
      trail: [],
      particles: [],
      spiderBeams: [],
      activatedObjects: new Set<string>(),
      collectedCoins: [...checkpoint.collectedCoins],
      jumpsThisAttempt: 0,
      songTime: checkpoint.songTime,
      screenShake: 0,
      flashAlpha: 0,
    };
  }

  return {
    x: 0,
    cy: level.startGravity === 1 ? GRID_SIZE / 2 : CEILING_HEIGHT - GRID_SIZE / 2,
    vy: 0,
    mode: level.startMode,
    speed: level.startSpeed,
    gravityDir: level.startGravity,
    isMini: false,
    grounded: true,
    rotation: 0,
    robotHoldTime: 0,
    isHoldingJump: false,
    dashing: false,
    dead: false,
    deathTimer: 0,
    won: false,
    winTimer: 0,
    trail: [],
    particles: [],
    spiderBeams: [],
    activatedObjects: new Set<string>(),
    collectedCoins: [],
    jumpsThisAttempt: 0,
    songTime: 0,
    screenShake: 0,
    flashAlpha: 0,
  };
}

export function createCheckpointFromPlayer(player: PlayerState): CheckpointState {
  return {
    id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    x: player.x,
    cy: player.cy,
    vy: player.vy,
    mode: player.mode,
    speed: player.speed,
    gravityDir: player.gravityDir,
    isMini: player.isMini,
    rotation: player.rotation,
    songTime: player.songTime,
    collectedCoins: [...player.collectedCoins],
  };
}

function isBoundedMode(mode: GameMode): boolean {
  return mode === 'ship' || mode === 'ball' || mode === 'ufo' || mode === 'wave' || mode === 'spider';
}

function getPlayerHalf(isMini: boolean): number {
  return isMini ? 9 : 15;
}

function aabbOverlap(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number
): boolean {
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

function circleRectOverlap(cx: number, cy: number, r: number, rx1: number, ry1: number, rx2: number, ry2: number): boolean {
  const closestX = Math.max(rx1, Math.min(cx, rx2));
  const closestY = Math.max(ry1, Math.min(cy, ry2));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

export class GeometryDashSimulation {
  public level: LevelData;
  public player: PlayerState;
  public checkpoints: CheckpointState[] = [];
  public attempt = 1;
  public levelEndX: number;
  public isPractice = false;
  public autoCheckpoints = true;

  private accumulator = 0;
  private jumpBufferTimer = 0;
  private prevInputHeld = false;
  private autoCpTimer = 0;
  private coinIndexMap = new Map<string, number>();

  // Spatial bucket index by grid X for O(1) collision lookups
  private buckets = new Map<number, LevelObject[]>();

  constructor(level: LevelData, isPractice = false, autoCheckpoints = true) {
    this.level = level;
    this.isPractice = isPractice;
    this.autoCheckpoints = autoCheckpoints;
    this.levelEndX = getLevelLengthX(level);
    this.player = createInitialPlayerState(level);
    this.buildSpatialIndex();
  }

  public buildSpatialIndex() {
    this.buckets.clear();
    this.coinIndexMap.clear();
    let coinIdx = 0;
    const sorted = [...this.level.objects].sort((a, b) => a.x - b.x);
    for (const obj of sorted) {
      if (obj.type === 'coin') {
        this.coinIndexMap.set(obj.id, coinIdx++);
      }
      const gx = Math.floor(obj.x);
      for (let b = gx - 2; b <= gx + 2; b++) {
        let arr = this.buckets.get(b);
        if (!arr) {
          arr = [];
          this.buckets.set(b, arr);
        }
        arr.push(obj);
      }
    }
    this.levelEndX = getLevelLengthX(this.level);
  }

  private getNearbyObjects(x: number): LevelObject[] {
    const gx = Math.floor(x / GRID_SIZE);
    return this.buckets.get(gx) || [];
  }

  public restart(keepCheckpoints: boolean) {
    if (!keepCheckpoints) {
      this.checkpoints = [];
    }
    const lastCp = this.isPractice && this.checkpoints.length > 0
      ? this.checkpoints[this.checkpoints.length - 1]
      : null;
    this.player = createInitialPlayerState(this.level, lastCp);
    this.accumulator = 0;
    this.jumpBufferTimer = 0;
    this.prevInputHeld = false;
    this.autoCpTimer = 0;
  }

  public placeCheckpoint() {
    if (!this.isPractice || this.player.dead || this.player.won) return;
    this.checkpoints.push(createCheckpointFromPlayer(this.player));
  }

  public removeLastCheckpoint() {
    if (!this.isPractice || this.checkpoints.length === 0) return;
    this.checkpoints.pop();
  }

  public step(frameDt: number, inputHeld: boolean, sfx: SoundCallbacks): {
    justRespawned: boolean;
  } {
    const clampedDt = Math.min(frameDt, 0.05);
    const justPressed = inputHeld && !this.prevInputHeld;
    this.prevInputHeld = inputHeld;

    if (justPressed) {
      this.jumpBufferTimer = 0.095; // ~95ms GD input buffer
    }

    // Update particles & visual timers even during death/win
    this.updateParticles(clampedDt);

    if (this.player.dead) {
      this.player.deathTimer += clampedDt;
      this.player.screenShake = Math.max(0, this.player.screenShake - clampedDt * 24);
      this.player.flashAlpha = Math.max(0, this.player.flashAlpha - clampedDt * 3.5);
      if (this.player.deathTimer >= 0.52) {
        this.attempt += 1;
        this.restart(this.isPractice);
        return { justRespawned: true };
      }
      return { justRespawned: false };
    }

    if (this.player.won) {
      this.player.winTimer += clampedDt;
      return { justRespawned: false };
    }

    this.accumulator += clampedDt;
    let bufferedPress = justPressed;

    while (this.accumulator >= FIXED_DT) {
      this.fixedTick(FIXED_DT, inputHeld, bufferedPress, sfx);
      bufferedPress = false; // consume edge trigger once
      this.accumulator -= FIXED_DT;
      if (this.player.dead || this.player.won) break;
    }

    // Practice auto-checkpoint every 2.0s when safe
    if (this.isPractice && this.autoCheckpoints && !this.player.dead && !this.player.won) {
      this.autoCpTimer += clampedDt;
      if (this.autoCpTimer >= 2.0 && (this.player.grounded || isBoundedMode(this.player.mode))) {
        this.autoCpTimer = 0;
        this.placeCheckpoint();
      }
    }

    return { justRespawned: false };
  }

  private fixedTick(dt: number, inputHeld: boolean, justPressed: boolean, sfx: SoundCallbacks) {
    const p = this.player;
    p.songTime += dt;
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }
    if (p.screenShake > 0) {
      p.screenShake = Math.max(0, p.screenShake - dt * 20);
    }

    const vx = SPEED_VALUES[p.speed];
    const half = getPlayerHalf(p.isMini);
    const scale = p.isMini ? 0.72 : 1;

    // 1. Check dashing release
    if (p.dashing && !inputHeld) {
      p.dashing = false;
    }

    // 2. Horizontal movement
    p.x += vx * dt;

    // 3. Apply mode physics if not dashing
    if (p.dashing) {
      p.vy = 0;
      p.rotation += 720 * dt;
      if (Math.random() < 0.45) {
        p.particles.push({
          x: p.x - half,
          y: p.cy + (Math.random() - 0.5) * 14,
          vx: -120,
          vy: (Math.random() - 0.5) * 60,
          life: 0.25,
          maxLife: 0.25,
          size: 4,
          color: '#4ADE80',
        });
      }
    } else {
      switch (p.mode) {
        case 'cube': {
          const g = PHYSICS.CUBE_GRAVITY * (p.isMini ? 1.18 : 1);
          p.vy -= g * p.gravityDir * dt;
          if (Math.abs(p.vy) > PHYSICS.CUBE_MAX_FALL) {
            p.vy = Math.sign(p.vy) * PHYSICS.CUBE_MAX_FALL;
          }
          if (p.grounded && (inputHeld || this.jumpBufferTimer > 0)) {
            const jumpVy = p.isMini ? PHYSICS.CUBE_MINI_JUMP_VY : PHYSICS.CUBE_JUMP_VY;
            p.vy = jumpVy * p.gravityDir;
            p.grounded = false;
            this.jumpBufferTimer = 0;
            p.jumpsThisAttempt += 1;
            sfx.onJump();
          }
          break;
        }
        case 'robot': {
          const g = PHYSICS.ROBOT_GRAVITY * (p.isMini ? 1.15 : 1);
          if (p.grounded && (inputHeld || this.jumpBufferTimer > 0)) {
            p.vy = PHYSICS.ROBOT_MIN_VY * p.gravityDir * scale;
            p.grounded = false;
            p.robotHoldTime = 0;
            p.isHoldingJump = true;
            this.jumpBufferTimer = 0;
            p.jumpsThisAttempt += 1;
            sfx.onJump();
          } else if (p.isHoldingJump && inputHeld && p.robotHoldTime < PHYSICS.ROBOT_MAX_HOLD_TIME) {
            p.robotHoldTime += dt;
            p.vy += (PHYSICS.ROBOT_HOLD_ACCEL - g * 0.25) * p.gravityDir * dt;
          } else {
            p.isHoldingJump = false;
            p.vy -= g * p.gravityDir * dt;
          }
          if (Math.abs(p.vy) > PHYSICS.CUBE_MAX_FALL) {
            p.vy = Math.sign(p.vy) * PHYSICS.CUBE_MAX_FALL;
          }
          break;
        }
        case 'ship': {
          const accel = inputHeld ? PHYSICS.SHIP_THRUST - PHYSICS.SHIP_GRAVITY : -PHYSICS.SHIP_GRAVITY;
          p.vy += accel * (p.isMini ? 1.22 : 1) * p.gravityDir * dt;
          p.vy = Math.max(-PHYSICS.SHIP_MAX_VY, Math.min(PHYSICS.SHIP_MAX_VY, p.vy));
          break;
        }
        case 'ball': {
          p.vy -= PHYSICS.BALL_GRAVITY * (p.isMini ? 1.15 : 1) * p.gravityDir * dt;
          p.vy = Math.max(-PHYSICS.BALL_MAX_VY, Math.min(PHYSICS.BALL_MAX_VY, p.vy));
          if (p.grounded && (justPressed || this.jumpBufferTimer > 0)) {
            p.gravityDir = (p.gravityDir === 1 ? -1 : 1);
            p.vy = PHYSICS.BALL_FLIP_VY * p.gravityDir;
            p.grounded = false;
            this.jumpBufferTimer = 0;
            p.jumpsThisAttempt += 1;
            sfx.onJump();
          }
          break;
        }
        case 'ufo': {
          p.vy -= PHYSICS.UFO_GRAVITY * (p.isMini ? 1.18 : 1) * p.gravityDir * dt;
          p.vy = Math.max(-PHYSICS.UFO_MAX_VY, Math.min(PHYSICS.UFO_MAX_VY, p.vy));
          if (justPressed) {
            p.vy = PHYSICS.UFO_JUMP_VY * (p.isMini ? 0.88 : 1) * p.gravityDir;
            p.grounded = false;
            this.jumpBufferTimer = 0;
            p.jumpsThisAttempt += 1;
            sfx.onJump();
            this.spawnJumpPuff();
          }
          break;
        }
        case 'wave': {
          const slopeMult = p.isMini ? 1.732 : 1.0;
          const dir = inputHeld ? 1 : -1;
          p.vy = dir * vx * slopeMult * p.gravityDir;
          break;
        }
        case 'spider': {
          p.vy -= PHYSICS.SPIDER_GRAVITY * p.gravityDir * dt;
          if (Math.abs(p.vy) > PHYSICS.CUBE_MAX_FALL) {
            p.vy = Math.sign(p.vy) * PHYSICS.CUBE_MAX_FALL;
          }
          if (p.grounded && (justPressed || this.jumpBufferTimer > 0)) {
            this.performSpiderFlip(sfx);
            this.jumpBufferTimer = 0;
          }
          break;
        }
      }
    }

    // 4. Vertical integration
    p.cy += p.vy * dt;
    p.grounded = false;

    // 5. World Floor & Ceiling Bounds
    if (p.cy - half <= 0) {
      p.cy = half;
      if (p.gravityDir === 1) {
        if (p.vy < 0) p.vy = 0;
        p.grounded = true;
      } else {
        if (!isBoundedMode(p.mode)) {
          // Cube/Robot upside-down falling below floor dies
          this.killPlayer(sfx);
          return;
        }
        if (p.vy < 0) p.vy = 0;
        p.grounded = true;
      }
    }

    if (isBoundedMode(p.mode) || p.gravityDir === -1) {
      if (p.cy + half >= CEILING_HEIGHT) {
        if (!isBoundedMode(p.mode) && p.gravityDir === -1 && p.cy + half > CEILING_HEIGHT + 240) {
          this.killPlayer(sfx);
          return;
        }
        if (isBoundedMode(p.mode)) {
          p.cy = CEILING_HEIGHT - half;
          if (p.vy > 0) p.vy = 0;
          if (p.gravityDir === -1) p.grounded = true;
        }
      }
    }

    // 6. Collide with nearby level objects
    const nearby = this.getNearbyObjects(p.x);
    const px1 = p.x - half;
    const px2 = p.x + half;
    const py1 = p.cy - half;
    const py2 = p.cy + half;

    // First pass: Solids & Slopes
    for (const obj of nearby) {
      const bx = obj.x * GRID_SIZE;
      const by = obj.y * GRID_SIZE;

      if (obj.type === 'block' || obj.type === 'brick' || obj.type === 'neon_block' || obj.type === 'pillar' || obj.type === 'half_slab') {
        const bw = GRID_SIZE;
        const bh = obj.type === 'half_slab' ? 15 : obj.type === 'pillar' ? GRID_SIZE * 2 : GRID_SIZE;
        const bx1 = bx;
        const bx2 = bx + bw;
        const by1 = by;
        const by2 = by + bh;

        if (aabbOverlap(p.x - half, p.cy - half, p.x + half, p.cy + half, bx1, by1, bx2, by2)) {
          if (p.mode === 'wave') {
            this.killPlayer(sfx);
            return;
          }

          const overlapLeft = (p.x + half) - bx1;
          const overlapBottom = (p.cy + half) - by1;
          const overlapTop = by2 - (p.cy - half);

          // Forgiving top/bottom snap in GD (~10px)
          const safeTopLanding = p.gravityDir === 1 && p.vy <= 40 && overlapTop <= 11 && overlapLeft >= 4;
          const safeBottomLanding = p.gravityDir === -1 && p.vy >= -40 && overlapBottom <= 11 && overlapLeft >= 4;

          if (safeTopLanding) {
            p.cy = by2 + half;
            p.vy = 0;
            p.grounded = true;
          } else if (safeBottomLanding) {
            p.cy = by1 - half;
            p.vy = 0;
            p.grounded = true;
          } else if ((p.mode === 'ship' || p.mode === 'ufo' || p.mode === 'ball') && overlapLeft > 10) {
            // Ship, UFO, and Ball can safely slide/bonk against block ceilings/floors
            if (overlapTop < overlapBottom) {
              p.cy = by2 + half;
              if (p.vy < 0) p.vy = 0;
              if (p.gravityDir === 1) p.grounded = true;
            } else {
              p.cy = by1 - half;
              if (p.vy > 0) p.vy = 0;
              if (p.gravityDir === -1) p.grounded = true;
            }
          } else {
            this.killPlayer(sfx);
            return;
          }
        }
      } else if (obj.type === 'slope_up' || obj.type === 'slope_down') {
        const bx1 = bx;
        const bx2 = bx + GRID_SIZE;
        const by1 = by;
        const by2 = by + GRID_SIZE;
        if (aabbOverlap(p.x - half, p.cy - half, p.x + half, p.cy + half, bx1, by1, bx2, by2)) {
          const localX = Math.max(0, Math.min(GRID_SIZE, p.x - bx1));
          const surfY = obj.type === 'slope_up' ? by1 + localX : by2 - localX;
          if (p.gravityDir === 1) {
            if (p.cy - half <= surfY + 6 && p.cy - half >= surfY - 16) {
              p.cy = surfY + half;
              p.vy = Math.max(0, p.vy);
              p.grounded = true;
            } else if (p.cy - half < by1 + 4 && p.x - half < bx1 + 8) {
              this.killPlayer(sfx);
              return;
            }
          }
        }
      }
    }

    // Second pass: Hazards, Pads, Orbs, Portals, Coins
    const curPx1 = p.x - half;
    const curPx2 = p.x + half;
    const curPy1 = p.cy - half;
    const curPy2 = p.cy + half;

    for (const obj of nearby) {
      const bx = obj.x * GRID_SIZE;
      const by = obj.y * GRID_SIZE;

      // Hazards (authentic tight GD hitboxes)
      if (obj.type === 'spike') {
        if (aabbOverlap(curPx1, curPy1, curPx2, curPy2, bx + 10, by + 2, bx + 20, by + 20)) {
          this.killPlayer(sfx);
          return;
        }
      } else if (obj.type === 'mini_spike') {
        if (aabbOverlap(curPx1, curPy1, curPx2, curPy2, bx + 10, by + 1, bx + 20, by + 10)) {
          this.killPlayer(sfx);
          return;
        }
      } else if (obj.type === 'spike_down') {
        if (aabbOverlap(curPx1, curPy1, curPx2, curPy2, bx + 10, by + 10, bx + 20, by + 28)) {
          this.killPlayer(sfx);
          return;
        }
      } else if (obj.type === 'mini_spike_down') {
        if (aabbOverlap(curPx1, curPy1, curPx2, curPy2, bx + 10, by + 20, bx + 20, by + 29)) {
          this.killPlayer(sfx);
          return;
        }
      } else if (obj.type === 'saw') {
        if (circleRectOverlap(bx + 15, by + 15, 19, curPx1, curPy1, curPx2, curPy2)) {
          this.killPlayer(sfx);
          return;
        }
      }

      // Pads (auto-trigger on touch)
      if (obj.type.startsWith('pad_')) {
        if (
          !p.activatedObjects.has(obj.id) &&
          aabbOverlap(curPx1, curPy1, curPx2, curPy2, bx + 2, by, bx + 28, by + 12)
        ) {
          p.activatedObjects.add(obj.id);
          p.grounded = false;
          p.dashing = false;
          if (obj.type === 'pad_yellow') p.vy = PHYSICS.PAD_YELLOW_VY * p.gravityDir;
          else if (obj.type === 'pad_pink') p.vy = PHYSICS.PAD_PINK_VY * p.gravityDir;
          else if (obj.type === 'pad_red') p.vy = PHYSICS.PAD_RED_VY * p.gravityDir;
          else if (obj.type === 'pad_blue') {
            p.gravityDir = p.gravityDir === 1 ? -1 : 1;
            p.vy = PHYSICS.PAD_BLUE_VY * p.gravityDir;
          }
          sfx.onPad();
          this.spawnBurst(bx + 15, by + 6, '#FACC15', 8);
        }
      }

      // Orbs (trigger on press/buffer inside generous orb box)
      if (obj.type.startsWith('orb_')) {
        if (
          !p.activatedObjects.has(obj.id) &&
          (justPressed || this.jumpBufferTimer > 0) &&
          aabbOverlap(curPx1, curPy1, curPx2, curPy2, bx - 4, by - 4, bx + 34, by + 34)
        ) {
          p.activatedObjects.add(obj.id);
          this.jumpBufferTimer = 0;
          p.grounded = false;
          p.jumpsThisAttempt += 1;

          if (obj.type === 'orb_yellow') {
            p.vy = PHYSICS.ORB_YELLOW_VY * p.gravityDir;
            this.spawnBurst(bx + 15, by + 15, '#FACC15', 10);
          } else if (obj.type === 'orb_pink') {
            p.vy = PHYSICS.ORB_PINK_VY * p.gravityDir;
            this.spawnBurst(bx + 15, by + 15, '#F472B6', 10);
          } else if (obj.type === 'orb_red') {
            p.vy = PHYSICS.ORB_RED_VY * p.gravityDir;
            this.spawnBurst(bx + 15, by + 15, '#EF4444', 12);
          } else if (obj.type === 'orb_blue') {
            p.gravityDir = p.gravityDir === 1 ? -1 : 1;
            p.vy = PHYSICS.ORB_BLUE_VY * p.gravityDir;
            this.spawnBurst(bx + 15, by + 15, '#38BDF8', 10);
          } else if (obj.type === 'orb_green') {
            p.gravityDir = p.gravityDir === 1 ? -1 : 1;
            p.vy = PHYSICS.ORB_GREEN_VY * p.gravityDir;
            this.spawnBurst(bx + 15, by + 15, '#4ADE80', 12);
          } else if (obj.type === 'orb_black') {
            p.vy = -PHYSICS.ORB_BLACK_VY * p.gravityDir;
            this.spawnBurst(bx + 15, by + 15, '#94A3B8', 10);
          } else if (obj.type === 'orb_dash') {
            p.dashing = true;
            p.vy = 0;
            this.spawnBurst(bx + 15, by + 15, '#22C55E', 14);
          }
          sfx.onOrb();
        }
      }

      // Portals
      if (obj.type.startsWith('portal_')) {
        if (
          !p.activatedObjects.has(obj.id) &&
          aabbOverlap(curPx1, curPy1, curPx2, curPy2, bx + 4, by - 12, bx + 26, by + 72)
        ) {
          p.activatedObjects.add(obj.id);
          this.applyPortal(obj.type, sfx, bx + 15, by + 30);
        }
      }

      // Secret Coin
      if (obj.type === 'coin') {
        const coinIdx = this.coinIndexMap.get(obj.id) ?? 0;
        if (
          !p.collectedCoins.includes(coinIdx) &&
          circleRectOverlap(bx + 15, by + 15, 16, curPx1, curPy1, curPx2, curPy2)
        ) {
          p.collectedCoins.push(coinIdx);
          sfx.onCoin();
          this.spawnBurst(bx + 15, by + 15, '#FACC15', 14);
        }
      }
    }

    // 7. Rotation & Visual Trail
    if (p.mode === 'cube') {
      if (p.grounded) {
        const target = Math.round(p.rotation / 90) * 90;
        p.rotation += (target - p.rotation) * Math.min(1, dt * 28);
      } else {
        p.rotation += 415 * p.gravityDir * dt;
      }
    } else if (p.mode === 'ship') {
      const targetAngle = Math.atan2(-p.vy, vx) * (180 / Math.PI) * 0.85;
      p.rotation += (targetAngle - p.rotation) * Math.min(1, dt * 16);
    } else if (p.mode === 'ball') {
      p.rotation += (p.grounded ? 520 : 380) * p.gravityDir * dt;
    } else if (p.mode === 'ufo') {
      p.rotation = Math.max(-22, Math.min(22, -p.vy * 0.04));
    } else if (p.mode === 'wave') {
      p.rotation = Math.atan2(-p.vy, vx) * (180 / Math.PI);
    } else if (p.mode === 'robot' || p.mode === 'spider') {
      p.rotation = p.gravityDir === 1 ? 0 : 180;
    }

    // Record trail point
    if (p.trail.length === 0 || Math.hypot(p.x - p.trail[p.trail.length - 1].x, p.cy - p.trail[p.trail.length - 1].cy) > 5) {
      p.trail.push({ x: p.x, cy: p.cy, mode: p.mode });
      if (p.trail.length > 75) p.trail.shift();
    }

    // Ground slide particles
    if (p.grounded && Math.random() < 0.35) {
      p.particles.push({
        x: p.x - half * 0.7,
        y: p.cy - half * p.gravityDir,
        vx: -vx * 0.25 - Math.random() * 40,
        vy: p.gravityDir * (20 + Math.random() * 45),
        life: 0.22,
        maxLife: 0.22,
        size: 3.5,
        color: '#E2E8F0',
      });
    }

    // 8. Check Level Completion
    if (p.x >= this.levelEndX) {
      p.won = true;
      p.winTimer = 0;
      sfx.onWin();
      this.spawnBurst(p.x, p.cy, '#22D3EE', 32);
      this.spawnBurst(p.x, p.cy, '#FACC15', 24);
    }
  }

  private performSpiderFlip(sfx: SoundCallbacks) {
    const p = this.player;
    const half = getPlayerHalf(p.isMini);
    const startY = p.cy;
    const newDir: 1 | -1 = p.gravityDir === 1 ? -1 : 1;

    // Raycast vertically against nearby blocks to find landing surface
    const nearby = this.getNearbyObjects(p.x);
    let targetCy = newDir === -1 ? CEILING_HEIGHT - half : half;

    for (const obj of nearby) {
      if (obj.type === 'block' || obj.type === 'brick' || obj.type === 'neon_block' || obj.type === 'pillar' || obj.type === 'half_slab') {
        const bx1 = obj.x * GRID_SIZE;
        const bx2 = bx1 + GRID_SIZE;
        if (p.x + half * 0.8 > bx1 && p.x - half * 0.8 < bx2) {
          const by1 = obj.y * GRID_SIZE;
          const bh = obj.type === 'half_slab' ? 15 : obj.type === 'pillar' ? GRID_SIZE * 2 : GRID_SIZE;
          const by2 = by1 + bh;
          if (newDir === -1 && by1 > p.cy) {
            targetCy = Math.min(targetCy, by1 - half);
          } else if (newDir === 1 && by2 < p.cy) {
            targetCy = Math.max(targetCy, by2 + half);
          }
        }
      }
    }

    p.gravityDir = newDir;
    p.cy = targetCy;
    p.vy = 0;
    p.grounded = true;
    p.jumpsThisAttempt += 1;
    p.spiderBeams.push({
      x: p.x,
      y1: startY,
      y2: targetCy,
      life: 0.18,
      color: '#C084FC',
    });
    this.spawnBurst(p.x, targetCy, '#C084FC', 8);
    sfx.onJump();
  }

  private applyPortal(type: string, sfx: SoundCallbacks, px: number, py: number) {
    const p = this.player;
    let color = '#22D3EE';
    if (type === 'portal_cube') { p.mode = 'cube'; color = '#4ADE80'; }
    else if (type === 'portal_ship') { p.mode = 'ship'; color = '#F472B6'; }
    else if (type === 'portal_ball') { p.mode = 'ball'; color = '#FB923C'; }
    else if (type === 'portal_ufo') { p.mode = 'ufo'; color = '#FACC15'; }
    else if (type === 'portal_wave') { p.mode = 'wave'; color = '#22D3EE'; }
    else if (type === 'portal_robot') { p.mode = 'robot'; color = '#E2E8F0'; }
    else if (type === 'portal_spider') { p.mode = 'spider'; color = '#C084FC'; }
    else if (type === 'portal_grav_down') { p.gravityDir = 1; color = '#38BDF8'; }
    else if (type === 'portal_grav_up') { p.gravityDir = -1; color = '#FACC15'; }
    else if (type === 'portal_speed_05') { p.speed = '0.5x'; color = '#FB923C'; }
    else if (type === 'portal_speed_1') { p.speed = '1x'; color = '#38BDF8'; }
    else if (type === 'portal_speed_2') { p.speed = '2x'; color = '#4ADE80'; }
    else if (type === 'portal_speed_3') { p.speed = '3x'; color = '#EC4899'; }
    else if (type === 'portal_speed_4') { p.speed = '4x'; color = '#EF4444'; }
    else if (type === 'portal_mini') { p.isMini = true; color = '#EC4899'; }
    else if (type === 'portal_normal') { p.isMini = false; color = '#4ADE80'; }
    sfx.onPortal();
    this.spawnBurst(px, py, color, 12);
  }

  private killPlayer(sfx: SoundCallbacks) {
    const p = this.player;
    if (p.dead || p.won) return;
    p.dead = true;
    p.deathTimer = 0;
    p.screenShake = 8;
    p.flashAlpha = 0.35;
    sfx.onDeath();
    this.spawnBurst(p.x, p.cy, '#F43F5E', 28);
    this.spawnBurst(p.x, p.cy, '#FACC15', 16);
  }

  private spawnJumpPuff() {
    this.spawnBurst(this.player.x, this.player.cy - 10 * this.player.gravityDir, '#E2E8F0', 6);
  }

  private spawnBurst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 90 + Math.random() * 240;
      this.player.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.55,
        size: 3 + Math.random() * 4,
        color,
      });
    }
  }

  private updateParticles(dt: number) {
    const p = this.player;
    for (let i = p.particles.length - 1; i >= 0; i--) {
      const pt = p.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        p.particles.splice(i, 1);
      }
    }
    for (let i = p.spiderBeams.length - 1; i >= 0; i--) {
      p.spiderBeams[i].life -= dt;
      if (p.spiderBeams[i].life <= 0) {
        p.spiderBeams.splice(i, 1);
      }
    }
  }

  public getProgressPercent(): number {
    if (this.levelEndX <= 0) return 0;
    return Math.max(0, Math.min(100, Math.floor((this.player.x / this.levelEndX) * 100)));
  }

  public getDebugHitboxes(): HitboxDebug[] {
    const boxes: HitboxDebug[] = [];
    const half = getPlayerHalf(this.player.isMini);
    boxes.push({
      x: this.player.x - half,
      y: this.player.cy - half,
      w: half * 2,
      h: half * 2,
      kind: 'player',
    });

    const camMin = this.player.x - 300;
    const camMax = this.player.x + 900;
    for (const obj of this.level.objects) {
      const bx = obj.x * GRID_SIZE;
      if (bx < camMin || bx > camMax) continue;
      const by = obj.y * GRID_SIZE;
      if (obj.type === 'spike') boxes.push({ x: bx + 10, y: by + 2, w: 10, h: 18, kind: 'hazard' });
      else if (obj.type === 'mini_spike') boxes.push({ x: bx + 10, y: by + 1, w: 10, h: 9, kind: 'hazard' });
      else if (obj.type === 'spike_down') boxes.push({ x: bx + 10, y: by + 10, w: 10, h: 18, kind: 'hazard' });
      else if (obj.type === 'mini_spike_down') boxes.push({ x: bx + 10, y: by + 20, w: 10, h: 9, kind: 'hazard' });
      else if (obj.type === 'saw') boxes.push({ x: bx - 4, y: by - 4, w: 38, h: 38, kind: 'hazard' });
      else if (obj.type === 'block' || obj.type === 'brick' || obj.type === 'neon_block') boxes.push({ x: bx, y: by, w: 30, h: 30, kind: 'solid' });
      else if (obj.type === 'half_slab') boxes.push({ x: bx, y: by, w: 30, h: 15, kind: 'solid' });
      else if (obj.type === 'pillar') boxes.push({ x: bx, y: by, w: 30, h: 60, kind: 'solid' });
      else if (obj.type.startsWith('orb_')) boxes.push({ x: bx - 4, y: by - 4, w: 38, h: 38, kind: 'orb' });
      else if (obj.type.startsWith('portal_')) boxes.push({ x: bx + 4, y: by - 12, w: 22, h: 84, kind: 'portal' });
      else if (obj.type === 'coin') boxes.push({ x: bx - 1, y: by - 1, w: 32, h: 32, kind: 'coin' });
    }
    return boxes;
  }
}
