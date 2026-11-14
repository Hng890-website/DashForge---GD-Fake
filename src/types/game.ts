export type GameMode = 'cube' | 'ship' | 'ball' | 'ufo' | 'wave' | 'robot' | 'spider';
export type SpeedTier = '0.5x' | '1x' | '2x' | '3x' | '4x';
export type Difficulty = 'Easy' | 'Normal' | 'Hard' | 'Harder' | 'Insane' | 'Demon';
export type TrailStyle = 'classic' | 'neon' | 'spark' | 'rainbow';

export type ObjectType =
  | 'block'
  | 'brick'
  | 'half_slab'
  | 'neon_block'
  | 'slope_up'
  | 'slope_down'
  | 'pillar'
  | 'spike'
  | 'mini_spike'
  | 'spike_down'
  | 'mini_spike_down'
  | 'saw'
  | 'pad_yellow'
  | 'pad_pink'
  | 'pad_red'
  | 'pad_blue'
  | 'orb_yellow'
  | 'orb_pink'
  | 'orb_red'
  | 'orb_blue'
  | 'orb_green'
  | 'orb_black'
  | 'orb_dash'
  | 'portal_cube'
  | 'portal_ship'
  | 'portal_ball'
  | 'portal_ufo'
  | 'portal_wave'
  | 'portal_robot'
  | 'portal_spider'
  | 'portal_grav_down'
  | 'portal_grav_up'
  | 'portal_speed_05'
  | 'portal_speed_1'
  | 'portal_speed_2'
  | 'portal_speed_3'
  | 'portal_speed_4'
  | 'portal_mini'
  | 'portal_normal'
  | 'coin'
  | 'end_wall';

export interface LevelObject {
  id: string;
  type: ObjectType;
  /** Grid X coordinate (1 unit = 30px) */
  x: number;
  /** Grid Y coordinate above ground surface (0 = floor level, positive = up) */
  y: number;
  /** Optional rotation in degrees (0, 90, 180, 270) */
  rotation?: number;
  /** Optional custom tint hex */
  color?: string;
}

export interface LevelData {
  id: string;
  name: string;
  authorName: string;
  authorUid?: string;
  description: string;
  difficulty: Difficulty;
  stars: number;
  songId: string;
  bpm: number;
  bgColor: string;
  groundColor: string;
  startMode: GameMode;
  startSpeed: SpeedTier;
  startGravity: 1 | -1;
  objects: LevelObject[];
  isOfficial?: boolean;
  verified?: boolean;
  plays?: number;
  likes?: number;
}

export interface IconConfig {
  cubeId: number;
  shipId: number;
  ballId: number;
  ufoId: number;
  waveId: number;
  robotId: number;
  spiderId: number;
  primaryColor: string;
  secondaryColor: string;
  trailStyle: TrailStyle;
}

export interface PlayerSettings {
  musicVolume: number;
  sfxVolume: number;
  autoCheckpoints: boolean;
  showHitboxes: boolean;
}

export interface PlayerPublicProfile {
  uid: string;
  displayName: string;
  stars: number;
  coins: number;
  completedCount: number;
  totalAttempts: number;
  totalJumps: number;
  iconConfig: IconConfig;
  updatedAt?: unknown;
}

export interface PlayerLevelProgress {
  uid: string;
  levelId: string;
  normalPercent: number;
  practicePercent: number;
  attempts: number;
  coinsCollected: number[];
  completed: boolean;
  updatedAt?: unknown;
}

export interface PlayerDraftLevel {
  uid: string;
  draftId: string;
  name: string;
  songId: string;
  bgColor: string;
  groundColor: string;
  startMode: GameMode;
  startSpeed: SpeedTier;
  startGravity: 1 | -1;
  objects: LevelObject[];
  verified: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ServerLevelComment {
  commentId: string;
  levelId: string;
  authorUid: string;
  authorName: string;
  text: string;
  percent: number;
  createdAt?: unknown;
}
