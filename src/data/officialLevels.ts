import { LevelData, LevelObject, ObjectType } from '../types/game';

class LevelBuilder {
  private objects: LevelObject[] = [];
  private seq = 0;

  add(type: ObjectType, x: number, y: number, color?: string) {
    this.objects.push({
      id: `o_${this.seq++}`,
      type,
      x,
      y,
      ...(color ? { color } : {}),
    });
    return this;
  }

  row(type: ObjectType, startX: number, count: number, y: number, color?: string) {
    for (let i = 0; i < count; i++) {
      this.add(type, startX + i, y, color);
    }
    return this;
  }

  col(type: ObjectType, x: number, startY: number, count: number, color?: string) {
    for (let i = 0; i < count; i++) {
      this.add(type, x, startY + i, color);
    }
    return this;
  }

  spikes(startX: number, count: number, y = 0, down = false) {
    for (let i = 0; i < count; i++) {
      this.add(down ? 'spike_down' : 'spike', startX + i, y);
    }
    return this;
  }

  staircase(startX: number, steps: number, baseY = 0, type: ObjectType = 'block') {
    for (let i = 0; i < steps; i++) {
      this.row(type, startX + i * 4, 3, baseY + i);
    }
    return this;
  }

  build(): LevelObject[] {
    return this.objects;
  }
}

// 1. STEREO PULSE (Easy · 2 Stars) - Classic Cube + Ship intro
const stereoPulseObjects = (() => {
  const b = new LevelBuilder();
  // Opening rhythmic jumps
  b.add('spike', 18, 0);
  b.add('spike', 29, 0);
  b.add('spike', 30, 0);

  // Step-up platforms
  b.row('block', 40, 4, 0);
  b.row('block', 46, 4, 1);
  b.add('coin', 47.5, 2.5);
  b.row('block', 52, 4, 2);
  b.spikes(44, 2, 0);
  b.spikes(50, 2, 0);

  // Ground rhythm + double spikes
  b.add('spike', 65, 0);
  b.spikes(76, 2, 0);
  b.row('brick', 86, 3, 0);
  b.add('spike', 87, 1);
  b.row('brick', 93, 4, 1);
  b.spikes(89, 4, 0);

  // Yellow pad jump
  b.add('pad_yellow', 105, 0);
  b.spikes(107, 4, 0);
  b.row('neon_block', 112, 5, 3);
  b.add('coin', 114, 4.5);

  // Ship section! (x=126 to 198)
  b.add('portal_ship', 126, 2);
  // Gentle pillars top and bottom
  b.col('block', 140, 0, 3);
  b.col('block', 152, 7, 4);
  b.col('block', 164, 0, 4);
  b.col('block', 164, 9, 2);
  b.add('coin', 164, 6);
  b.col('block', 176, 6, 5);
  b.col('block', 188, 0, 3);

  // Back to Cube finale
  b.add('portal_cube', 200, 2);
  b.spikes(214, 2, 0);
  b.row('block', 222, 4, 1);
  b.spikes(222, 4, 0);
  b.spikes(232, 3, 0);
  b.add('end_wall', 246, 0);
  return b.build();
})();

// 2. BACK ON BEAT (Normal · 3 Stars) - Pads, Elevated Platforms & Ship
const backOnBeatObjects = (() => {
  const b = new LevelBuilder();
  b.spikes(16, 2, 0);
  b.add('pad_yellow', 26, 0);
  b.spikes(28, 3, 0);
  b.row('neon_block', 32, 4, 3);
  b.add('pad_pink', 35, 4);
  b.row('neon_block', 40, 5, 5);
  b.add('coin', 42, 6.5);

  // Ground pit spikes
  b.spikes(36, 12, 0);

  // Fast step section
  b.row('block', 54, 4, 0);
  b.row('block', 60, 4, 1);
  b.add('spike', 61, 2);
  b.row('block', 67, 4, 2);
  b.spikes(58, 2, 0);
  b.spikes(64, 3, 0);

  // 2x Speed + Ship
  b.add('portal_speed_2', 78, 2);
  b.add('portal_ship', 82, 2);
  b.col('neon_block', 98, 0, 3);
  b.col('neon_block', 110, 7, 4);
  b.add('saw', 124, 5);
  b.col('neon_block', 138, 0, 4);
  b.add('coin', 138, 6);
  b.col('neon_block', 150, 7, 4);
  b.add('saw', 164, 4);

  // Back to Cube + 1x
  b.add('portal_cube', 178, 2);
  b.add('portal_speed_1', 180, 2);
  b.add('pad_red', 192, 0);
  b.spikes(194, 5, 0);
  b.row('block', 200, 6, 4);
  b.add('coin', 202.5, 5.5);
  b.spikes(206, 4, 0);

  // Final triple
  b.spikes(220, 3, 0);
  b.spikes(232, 2, 0);
  b.add('end_wall', 248, 0);
  return b.build();
})();

// 3. POLARGEIST DASH (Normal · 4 Stars) - Jump Orbs, Ball Mode & Coins
const polargeistDashObjects = (() => {
  const b = new LevelBuilder();
  b.spikes(16, 2, 0);
  // First Yellow Orb chain
  b.spikes(25, 4, 0);
  b.add('orb_yellow', 26.5, 2.2);
  b.row('block', 30, 4, 1);

  b.spikes(34, 6, 0);
  b.add('orb_yellow', 36, 3);
  b.add('orb_pink', 40, 4.2);
  b.row('neon_block', 44, 4, 4);
  b.add('coin', 46, 5.5);

  // Red Orb over tall wall
  b.add('orb_red', 56, 1.5);
  b.col('block', 59, 0, 4);
  b.spikes(60, 4, 0);

  // Ball Mode Section (x=72 to 132)
  b.add('portal_ball', 72, 2);
  b.spikes(84, 3, 0);
  b.spikes(96, 3, 10, true);
  b.row('brick', 104, 5, 4);
  b.add('spike', 106, 5);
  b.add('coin', 112, 8.5);
  b.spikes(110, 4, 0);
  b.spikes(120, 3, 10, true);

  // Cube + Orb combo
  b.add('portal_cube', 132, 2);
  b.add('portal_grav_down', 134, 2);
  b.add('portal_speed_2', 142, 2);
  b.spikes(154, 3, 0);
  b.add('orb_yellow', 166, 2.2);
  b.spikes(164, 5, 0);
  b.row('block', 170, 5, 2);
  b.add('orb_yellow', 177, 4.2);
  b.row('neon_block', 182, 5, 4);
  b.add('coin', 184, 5.5);
  b.spikes(175, 14, 0);

  // Final Ship sprint
  b.add('portal_ship', 196, 2);
  b.col('block', 212, 0, 3);
  b.col('block', 224, 7, 4);
  b.col('block', 236, 0, 4);
  b.add('end_wall', 252, 0);
  return b.build();
})();

// 4. DRY GRAVITY (Hard · 5 Stars) - Gravity Inversion & UFO Mode
const dryGravityObjects = (() => {
  const b = new LevelBuilder();
  b.add('portal_speed_2', 10, 2);
  b.spikes(20, 3, 0);
  b.row('block', 30, 5, 1);
  b.add('spike', 32, 2);

  // Upside-down Cube section with ceiling track!
  b.row('neon_block', 42, 46, 9);
  b.add('portal_grav_up', 42, 2);
  b.spikes(54, 2, 8, true);
  b.spikes(66, 3, 8, true);
  b.add('coin', 74, 7.2);
  b.add('orb_yellow', 78, 6.5);
  b.spikes(76, 4, 8, true);
  b.add('portal_grav_down', 86, 6);

  // Safe landing floor
  b.spikes(94, 3, 0);

  // UFO Mode Section (x=104 to 166)
  b.add('portal_ufo', 104, 2);
  b.col('block', 118, 0, 3);
  b.col('block', 118, 8, 3);
  b.col('block', 132, 0, 5);
  b.col('block', 132, 9, 2);
  b.add('coin', 132, 7);
  b.col('block', 146, 0, 2);
  b.col('block', 146, 6, 5);
  b.add('saw', 158, 5);

  // Gravity Blue Orb Cube section
  b.add('portal_cube', 170, 2);
  b.row('neon_block', 180, 22, 9);
  b.add('orb_blue', 182, 2.2);
  b.spikes(180, 12, 0);
  b.spikes(194, 3, 8, true);
  b.add('orb_blue', 198, 6.5);
  b.add('coin', 202, 2.5);

  // Finale
  b.spikes(214, 3, 0);
  b.add('pad_yellow', 224, 0);
  b.spikes(226, 4, 0);
  b.add('end_wall', 244, 0);
  return b.build();
})();

// 5. CYCLES OF NEON (Harder · 7 Stars) - Wave, Robot, Mini Portal & 3x Speed
const cyclesNeonObjects = (() => {
  const b = new LevelBuilder();
  // Robot opening
  b.add('portal_robot', 6, 2);
  b.add('portal_speed_2', 8, 2);
  b.spikes(18, 2, 0);
  b.row('block', 25, 4, 2);
  b.spikes(23, 2, 0);
  b.add('orb_yellow', 32, 3.5);
  b.row('block', 36, 4, 4);
  b.add('coin', 38, 5.5);
  b.spikes(29, 12, 0);

  // Wave Corridor! (x=48 to 114)
  b.add('portal_wave', 48, 3);
  b.row('neon_block', 56, 54, 0);
  b.row('neon_block', 56, 54, 10);
  b.col('neon_block', 68, 1, 3);
  b.col('neon_block', 80, 6, 4);
  b.col('neon_block', 92, 1, 4);
  b.add('coin', 92, 6.5);
  b.col('neon_block', 104, 6, 4);

  // Mini Ball + 3x Speed!
  b.add('portal_ball', 116, 3);
  b.add('portal_mini', 118, 3);
  b.add('portal_speed_3', 120, 3);
  b.spikes(134, 3, 0);
  b.spikes(146, 3, 10, true);
  b.row('brick', 156, 5, 5);
  b.spikes(166, 3, 0);
  b.spikes(178, 3, 10, true);

  // Back to Normal Cube
  b.add('portal_normal', 190, 2);
  b.add('portal_cube', 192, 2);
  b.add('portal_grav_down', 194, 2);
  b.add('portal_speed_2', 196, 2);
  b.add('orb_green', 208, 2.5);
  b.row('neon_block', 212, 16, 9);
  b.add('coin', 218, 7.2);
  b.add('orb_blue', 224, 6.5);
  b.spikes(206, 20, 0);

  b.spikes(236, 3, 0);
  b.add('end_wall', 252, 0);
  return b.build();
})();

// 6. DEADLOCKED CORE (Demon · 10 Stars) - All 7 Modes + Dash Orbs + 3x/4x Speed
const deadlockedCoreObjects = (() => {
  const b = new LevelBuilder();
  b.add('portal_speed_2', 6, 2);
  b.spikes(16, 3, 0);
  b.add('orb_yellow', 24, 2.2);
  b.add('orb_pink', 28, 3.5);
  b.row('neon_block', 32, 4, 3);
  b.spikes(22, 14, 0);

  // Spider Teleport Section (x=42 to 94)
  b.add('portal_spider', 42, 2);
  b.spikes(52, 3, 0);
  b.spikes(62, 3, 10, true);
  b.row('block', 70, 5, 5);
  b.add('coin', 72, 6.8);
  b.spikes(76, 3, 0);
  b.spikes(86, 3, 10, true);

  // Dash Orb + 3x Wave!
  b.add('portal_cube', 96, 2);
  b.add('portal_grav_down', 98, 2);
  b.add('portal_speed_3', 100, 2);
  b.add('orb_dash', 110, 2.5);
  b.spikes(112, 12, 0);

  // Mini Wave Tunnel
  b.add('portal_wave', 128, 3);
  b.add('portal_mini', 130, 3);
  b.row('neon_block', 138, 46, 0);
  b.row('neon_block', 138, 46, 10);
  b.col('neon_block', 148, 1, 3);
  b.col('neon_block', 158, 6, 4);
  b.add('saw', 168, 5);
  b.add('coin', 168, 2);
  b.col('neon_block', 178, 1, 4);

  // 4x Ship + UFO Chaos
  b.add('portal_normal', 188, 3);
  b.add('portal_ship', 190, 3);
  b.add('portal_speed_4', 192, 3);
  b.add('saw', 208, 4);
  b.add('saw', 222, 7);
  b.col('block', 236, 0, 4);
  b.col('block', 236, 9, 2);

  b.add('portal_ufo', 248, 3);
  b.col('block', 264, 0, 3);
  b.col('block', 264, 8, 3);
  b.add('coin', 274, 5.5);
  b.add('saw', 278, 3);

  // Final Robot + Cube Sprint
  b.add('portal_robot', 292, 2);
  b.add('portal_speed_2', 294, 2);
  b.spikes(304, 3, 0);
  b.add('pad_red', 312, 0);
  b.spikes(314, 6, 0);
  b.add('end_wall', 330, 0);
  return b.build();
})();

export const OFFICIAL_LEVELS: LevelData[] = [
  {
    id: 'official_stereo_pulse',
    name: 'Stereo Pulse',
    authorName: 'DashForge Official',
    description: 'Khởi động nhịp điệu với Cube cổ điển và phân đoạn Ship đầu tiên.',
    difficulty: 'Easy',
    stars: 2,
    songId: 'stereo_pulse',
    bpm: 108,
    bgColor: '#0A2563',
    groundColor: '#05153B',
    startMode: 'cube',
    startSpeed: '1x',
    startGravity: 1,
    objects: stereoPulseObjects,
    isOfficial: true,
    verified: true,
  },
  {
    id: 'official_back_on_beat',
    name: 'Back On Beat',
    authorName: 'DashForge Official',
    description: 'Bệ nhảy Pad vàng/hồng/đỏ kết hợp tốc độ 2x và đường bay Ship.',
    difficulty: 'Normal',
    stars: 3,
    songId: 'back_on_beat',
    bpm: 118,
    bgColor: '#064E3B',
    groundColor: '#022C22',
    startMode: 'cube',
    startSpeed: '1x',
    startGravity: 1,
    objects: backOnBeatObjects,
    isOfficial: true,
    verified: true,
  },
  {
    id: 'official_polargeist_dash',
    name: 'Polargeist Dash',
    authorName: 'DashForge Official',
    description: 'Làm chủ chuỗi Jump Orb trên không và chế độ Ball đảo trọng lực.',
    difficulty: 'Normal',
    stars: 4,
    songId: 'polargeist_dash',
    bpm: 126,
    bgColor: '#3B0764',
    groundColor: '#1E0338',
    startMode: 'cube',
    startSpeed: '1x',
    startGravity: 1,
    objects: polargeistDashObjects,
    isOfficial: true,
    verified: true,
  },
  {
    id: 'official_dry_gravity',
    name: 'Dry Gravity',
    authorName: 'DashForge Official',
    description: 'Đảo ngược trọng lực liên tục cùng chế độ UFO vượt chướng ngại.',
    difficulty: 'Hard',
    stars: 5,
    songId: 'dry_gravity',
    bpm: 132,
    bgColor: '#5C2406',
    groundColor: '#2F1102',
    startMode: 'cube',
    startSpeed: '1x',
    startGravity: 1,
    objects: dryGravityObjects,
    isOfficial: true,
    verified: true,
  },
  {
    id: 'official_cycles_neon',
    name: 'Cycles of Neon',
    authorName: 'DashForge Official',
    description: 'Kết hợp Robot giữ lực nhảy, đường hầm Wave 45° và Mini Ball 3x.',
    difficulty: 'Harder',
    stars: 7,
    songId: 'cycles_neon',
    bpm: 138,
    bgColor: '#0F172A',
    groundColor: '#070B14',
    startMode: 'cube',
    startSpeed: '1x',
    startGravity: 1,
    objects: cyclesNeonObjects,
    isOfficial: true,
    verified: true,
  },
  {
    id: 'official_deadlocked_core',
    name: 'Deadlocked Core',
    authorName: 'DashForge Official',
    description: 'Thử thách Demon tổng hợp cả 7 chế độ, Dash Orb, Spider và tốc độ 4x.',
    difficulty: 'Demon',
    stars: 10,
    songId: 'deadlocked_core',
    bpm: 148,
    bgColor: '#5B0E24',
    groundColor: '#320612',
    startMode: 'cube',
    startSpeed: '1x',
    startGravity: 1,
    objects: deadlockedCoreObjects,
    isOfficial: true,
    verified: true,
  },
];

// Curated Featured Server Levels so the Online Server Browser has instant playable community levels
export const FEATURED_SERVER_LEVELS: LevelData[] = [
  {
    id: 'srv_neon_velocity',
    name: 'Neon Velocity',
    authorName: 'KrazManGD',
    description: 'Màn chơi Wave + Dash Orb tốc độ cao với hành lang neon mượt mà.',
    difficulty: 'Hard',
    stars: 5,
    songId: 'cycles_neon',
    bpm: 138,
    bgColor: '#0F172A',
    groundColor: '#070B14',
    startMode: 'cube',
    startSpeed: '2x',
    startGravity: 1,
    plays: 1420,
    likes: 318,
    verified: true,
    objects: (() => {
      const b = new LevelBuilder();
      b.spikes(16, 2, 0);
      b.add('orb_dash', 24, 2.2);
      b.spikes(26, 8, 0);
      b.add('portal_wave', 38, 3);
      b.row('neon_block', 46, 36, 0);
      b.row('neon_block', 46, 36, 10);
      b.col('neon_block', 56, 1, 3);
      b.col('neon_block', 68, 6, 4);
      b.add('coin', 68, 3);
      b.add('portal_cube', 86, 2);
      b.spikes(98, 3, 0);
      b.add('end_wall', 112, 0);
      return b.build();
    })(),
  },
  {
    id: 'srv_spider_temple',
    name: 'Spider Temple',
    authorName: 'ViPriN_Lab',
    description: 'Thử thách dịch chuyển Spider tức thời qua các cột trụ cổ đại.',
    difficulty: 'Harder',
    stars: 7,
    songId: 'dry_gravity',
    bpm: 132,
    bgColor: '#3B0764',
    groundColor: '#1E0338',
    startMode: 'spider',
    startSpeed: '2x',
    startGravity: 1,
    plays: 980,
    likes: 245,
    verified: true,
    objects: (() => {
      const b = new LevelBuilder();
      b.spikes(18, 3, 0);
      b.spikes(28, 3, 10, true);
      b.row('brick', 38, 5, 5);
      b.add('coin', 40, 6.8);
      b.spikes(46, 3, 0);
      b.spikes(56, 3, 10, true);
      b.add('portal_ship', 68, 3);
      b.add('saw', 82, 5);
      b.add('saw', 94, 4);
      b.add('end_wall', 110, 0);
      return b.build();
    })(),
  },
];
