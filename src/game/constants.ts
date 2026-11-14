import { Difficulty, IconConfig, PlayerSettings, SpeedTier } from '../types/game';

export const GRID_SIZE = 30;
export const CEILING_HEIGHT = 330; // 11 blocks ceiling for bounded modes (Ship, Ball, UFO, Wave, Spider)
export const FIXED_DT = 1 / 240; // 240Hz deterministic physics sub-stepping

export const SPEED_VALUES: Record<SpeedTier, number> = {
  '0.5x': 251.4,
  '1x': 311.5,
  '2x': 387.4,
  '3x': 468.0,
  '4x': 576.0,
};

// Authentic Geometry Dash Physics Constants (world units = 30px/block)
export const PHYSICS = {
  CUBE_GRAVITY: 2790,
  CUBE_JUMP_VY: 598,
  CUBE_MINI_JUMP_VY: 492,
  CUBE_MAX_FALL: 900,

  SHIP_GRAVITY: 1040,
  SHIP_THRUST: 2350,
  SHIP_MAX_VY: 460,

  BALL_GRAVITY: 2150,
  BALL_MAX_VY: 680,
  BALL_FLIP_VY: 120,

  UFO_GRAVITY: 1680,
  UFO_JUMP_VY: 435,
  UFO_MAX_VY: 560,

  ROBOT_GRAVITY: 2790,
  ROBOT_MIN_VY: 380,
  ROBOT_HOLD_ACCEL: 2180,
  ROBOT_MAX_HOLD_TIME: 0.25,

  SPIDER_GRAVITY: 2790,

  PAD_YELLOW_VY: 825,
  PAD_PINK_VY: 565,
  PAD_RED_VY: 990,
  PAD_BLUE_VY: 260,

  ORB_YELLOW_VY: 610,
  ORB_PINK_VY: 450,
  ORB_RED_VY: 840,
  ORB_BLUE_VY: 245,
  ORB_GREEN_VY: 610,
  ORB_BLACK_VY: 960,
};

export const DEFAULT_ICON_CONFIG: IconConfig = {
  cubeId: 0,
  shipId: 0,
  ballId: 0,
  ufoId: 0,
  waveId: 0,
  robotId: 0,
  spiderId: 0,
  primaryColor: '#22D3EE',
  secondaryColor: '#FACC15',
  trailStyle: 'classic',
};

export const DEFAULT_SETTINGS: PlayerSettings = {
  musicVolume: 0.55,
  sfxVolume: 0.7,
  autoCheckpoints: true,
  showHitboxes: false,
};

export const ICON_COLORS = [
  '#22D3EE', // Cyan
  '#3B82F6', // Royal Blue
  '#10B981', // Emerald
  '#84CC16', // Lime
  '#FACC15', // GD Gold
  '#F97316', // Orange
  '#EF4444', // Crimson
  '#EC4899', // Magenta
  '#A855F7', // Violet
  '#FFFFFF', // White
  '#0F172A', // Obsidian
];

export const DIFFICULTY_META: Record<Difficulty, { color: string; bg: string; stars: number; label: string }> = {
  Easy: { color: '#38BDF8', bg: 'rgba(56,189,248,0.14)', stars: 2, label: 'Easy' },
  Normal: { color: '#4ADE80', bg: 'rgba(74,222,128,0.14)', stars: 3, label: 'Normal' },
  Hard: { color: '#FACC15', bg: 'rgba(250,204,21,0.14)', stars: 5, label: 'Hard' },
  Harder: { color: '#FB923C', bg: 'rgba(251,146,60,0.14)', stars: 7, label: 'Harder' },
  Insane: { color: '#E879F9', bg: 'rgba(232,121,249,0.14)', stars: 9, label: 'Insane' },
  Demon: { color: '#F43F5E', bg: 'rgba(244,63,94,0.16)', stars: 10, label: 'Demon' },
};

export const SONG_CATALOG = [
  { id: 'stereo_pulse', title: 'Stereo Pulse', artist: 'DashSynth', bpm: 108 },
  { id: 'back_on_beat', title: 'Back On Beat', artist: 'DashSynth', bpm: 118 },
  { id: 'polargeist_dash', title: 'Polargeist Dash', artist: 'StepCore', bpm: 126 },
  { id: 'dry_gravity', title: 'Dry Gravity', artist: 'VoltDrop', bpm: 132 },
  { id: 'cycles_neon', title: 'Cycles of Neon', artist: 'VoltDrop', bpm: 138 },
  { id: 'deadlocked_core', title: 'Deadlocked Core', artist: 'F777-Style', bpm: 148 },
];

export const BG_THEMES = [
  { name: 'Classic Blue', bg: '#0A2563', ground: '#05153B' },
  { name: 'Emerald Pulse', bg: '#064E3B', ground: '#022C22' },
  { name: 'Crimson Core', bg: '#5B0E24', ground: '#320612' },
  { name: 'Violet Void', bg: '#3B0764', ground: '#1E0338' },
  { name: 'Obsidian Cyan', bg: '#0F172A', ground: '#070B14' },
  { name: 'Amber Dusk', bg: '#5C2406', ground: '#2F1102' },
];
