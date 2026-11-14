import { CEILING_HEIGHT, GRID_SIZE } from './constants';
import { GeometryDashSimulation } from './physics';
import { GameMode, IconConfig, LevelData, LevelObject, ObjectType } from '../types/game';

export interface RenderViewport {
  width: number;
  height: number;
  camX: number;
  camY: number;
  scale: number;
}

export function computeGameViewport(
  canvasWidth: number,
  canvasHeight: number,
  playerX: number,
  playerCy: number,
  mode: GameMode
): RenderViewport {
  // Fit ~12.5 blocks vertically so floor + ceiling + sky breathe cleanly
  const scale = Math.max(0.75, canvasHeight / 430);
  const viewWorldH = canvasHeight / scale;
  const viewWorldW = canvasWidth / scale;

  const camX = playerX - viewWorldW * 0.28;
  // Keep floor visible near bottom (~72px ground strip), smoothly track cube high jumps
  let camY = -72;
  if (mode === 'cube' || mode === 'robot') {
    const upperThreshold = viewWorldH * 0.62;
    if (playerCy > upperThreshold) {
      camY += playerCy - upperThreshold;
    }
  }
  return { width: canvasWidth, height: canvasHeight, camX, camY, scale };
}

function worldToScreenY(worldY: number, vp: RenderViewport): number {
  return vp.height - (worldY - vp.camY) * vp.scale;
}

function worldToScreenX(worldX: number, vp: RenderViewport): number {
  return (worldX - vp.camX) * vp.scale;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  vp: RenderViewport,
  bgColor: string,
  groundColor: string,
  showCeiling: boolean
) {
  // Deep gradient sky
  const grad = ctx.createLinearGradient(0, 0, 0, vp.height);
  grad.addColorStop(0, bgColor);
  grad.addColorStop(1, '#040711');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vp.width, vp.height);

  // Parallax geometric square pattern (0.25x scroll speed)
  const tileSize = 110 * vp.scale;
  const offsetX = ((-vp.camX * 0.25 * vp.scale) % tileSize + tileSize) % tileSize;
  const offsetY = ((vp.camY * 0.15 * vp.scale) % tileSize + tileSize) % tileSize;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1.5;
  for (let x = offsetX - tileSize; x < vp.width + tileSize; x += tileSize) {
    for (let y = offsetY - tileSize; y < vp.height + tileSize; y += tileSize) {
      ctx.strokeRect(x + 8, y + 8, tileSize - 16, tileSize - 16);
      ctx.strokeRect(x + 24, y + 24, tileSize - 48, tileSize - 48);
    }
  }
  ctx.restore();

  // Floor strip
  const floorScreenY = worldToScreenY(0, vp);
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, floorScreenY, vp.width, vp.height - floorScreenY + 20);

  // Floor scrolling tiles
  const gTile = 60 * vp.scale;
  const gOff = ((-vp.camX * vp.scale) % gTile + gTile) % gTile;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.5;
  for (let x = gOff - gTile; x < vp.width + gTile; x += gTile) {
    ctx.strokeRect(x, floorScreenY + 2, gTile, gTile);
  }

  // Crisp glowing floor line
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = Math.max(2, 2.5 * vp.scale);
  ctx.beginPath();
  ctx.moveTo(0, floorScreenY);
  ctx.lineTo(vp.width, floorScreenY);
  ctx.stroke();

  // Ceiling strip for bounded modes
  if (showCeiling) {
    const ceilScreenY = worldToScreenY(CEILING_HEIGHT, vp);
    if (ceilScreenY > 0) {
      ctx.fillStyle = groundColor;
      ctx.fillRect(0, 0, vp.width, ceilScreenY);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1.5;
      for (let x = gOff - gTile; x < vp.width + gTile; x += gTile) {
        ctx.strokeRect(x, ceilScreenY - gTile, gTile, gTile);
      }
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = Math.max(2, 2.5 * vp.scale);
      ctx.beginPath();
      ctx.moveTo(0, ceilScreenY);
      ctx.lineTo(vp.width, ceilScreenY);
      ctx.stroke();
    }
  }
}

export function drawLevelObject(
  ctx: CanvasRenderingContext2D,
  obj: LevelObject,
  vp: RenderViewport,
  timeSec: number,
  collected = false
) {
  const s = GRID_SIZE * vp.scale;
  const sx = worldToScreenX(obj.x * GRID_SIZE, vp);
  const syBottom = worldToScreenY(obj.y * GRID_SIZE, vp);
  const syTop = syBottom - s;

  if (sx < -s * 4 || sx > vp.width + s * 4) return;

  const type = obj.type;

  // Blocks
  if (type === 'block') {
    ctx.fillStyle = obj.color || '#0F172A';
    ctx.fillRect(sx, syTop, s, s);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = Math.max(1.5, 1.8 * vp.scale);
    ctx.strokeRect(sx + 0.5, syTop + 0.5, s - 1, s - 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(sx + s * 0.22, syTop + s * 0.22, s * 0.56, s * 0.56);
    return;
  }

  if (type === 'brick') {
    ctx.fillStyle = obj.color || '#1E293B';
    ctx.fillRect(sx, syTop, s, s);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = Math.max(1.2, 1.4 * vp.scale);
    ctx.strokeRect(sx + 0.5, syTop + 0.5, s - 1, s - 1);
    ctx.beginPath();
    ctx.moveTo(sx, syTop + s * 0.5);
    ctx.lineTo(sx + s, syTop + s * 0.5);
    ctx.moveTo(sx + s * 0.5, syTop);
    ctx.lineTo(sx + s * 0.5, syTop + s * 0.5);
    ctx.moveTo(sx + s * 0.25, syTop + s * 0.5);
    ctx.lineTo(sx + s * 0.25, syBottom);
    ctx.stroke();
    return;
  }

  if (type === 'neon_block') {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
    ctx.fillRect(sx, syTop, s, s);
    ctx.strokeStyle = obj.color || '#22D3EE';
    ctx.lineWidth = Math.max(2, 2.2 * vp.scale);
    ctx.strokeRect(sx + 1, syTop + 1, s - 2, s - 2);
    ctx.fillStyle = obj.color || '#22D3EE';
    ctx.fillRect(sx + s * 0.35, syTop + s * 0.35, s * 0.3, s * 0.3);
    return;
  }

  if (type === 'half_slab') {
    const hh = s * 0.5;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(sx, syBottom - hh, s, hh);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = Math.max(1.5, 1.8 * vp.scale);
    ctx.strokeRect(sx + 0.5, syBottom - hh + 0.5, s - 1, hh - 1);
    return;
  }

  if (type === 'pillar') {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(sx, syBottom - s * 2, s, s * 2);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = Math.max(1.5, 1.8 * vp.scale);
    ctx.strokeRect(sx + 0.5, syBottom - s * 2 + 0.5, s - 1, s * 2 - 1);
    ctx.strokeStyle = 'rgba(56,189,248,0.35)';
    ctx.beginPath();
    ctx.moveTo(sx + s * 0.5, syBottom - s * 1.85);
    ctx.lineTo(sx + s * 0.5, syBottom - s * 0.15);
    ctx.stroke();
    return;
  }

  if (type === 'slope_up' || type === 'slope_down') {
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = Math.max(1.5, 1.8 * vp.scale);
    ctx.beginPath();
    if (type === 'slope_up') {
      ctx.moveTo(sx, syBottom);
      ctx.lineTo(sx + s, syTop);
      ctx.lineTo(sx + s, syBottom);
    } else {
      ctx.moveTo(sx, syTop);
      ctx.lineTo(sx + s, syBottom);
      ctx.lineTo(sx, syBottom);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }

  // Spikes
  if (type === 'spike' || type === 'mini_spike' || type === 'spike_down' || type === 'mini_spike_down') {
    const isMini = type === 'mini_spike' || type === 'mini_spike_down';
    const isDown = type === 'spike_down' || type === 'mini_spike_down';
    const h = isMini ? s * 0.55 : s;
    ctx.fillStyle = '#090D16';
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = Math.max(1.4, 1.8 * vp.scale);
    ctx.beginPath();
    if (!isDown) {
      ctx.moveTo(sx + 1, syBottom);
      ctx.lineTo(sx + s * 0.5, syBottom - h);
      ctx.lineTo(sx + s - 1, syBottom);
    } else {
      ctx.moveTo(sx + 1, syTop);
      ctx.lineTo(sx + s * 0.5, syTop + h);
      ctx.lineTo(sx + s - 1, syTop);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner bevel accent
    ctx.strokeStyle = 'rgba(244,63,94,0.6)';
    ctx.lineWidth = Math.max(1, 1.2 * vp.scale);
    ctx.beginPath();
    if (!isDown) {
      ctx.moveTo(sx + s * 0.25, syBottom - 2);
      ctx.lineTo(sx + s * 0.5, syBottom - h * 0.65);
      ctx.lineTo(sx + s * 0.75, syBottom - 2);
    } else {
      ctx.moveTo(sx + s * 0.25, syTop + 2);
      ctx.lineTo(sx + s * 0.5, syTop + h * 0.65);
      ctx.lineTo(sx + s * 0.75, syTop + 2);
    }
    ctx.stroke();
    return;
  }

  // Spinning Sawblade
  if (type === 'saw') {
    const cx = sx + s * 0.5;
    const cy = syTop + s * 0.5;
    const r = s * 0.92;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(timeSec * 6.5);
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = Math.max(1.5, 2 * vp.scale);
    ctx.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth * 2; i++) {
      const ang = (Math.PI * i) / teeth;
      const rad = i % 2 === 0 ? r : r * 0.68;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#F43F5E';
    ctx.fill();
    ctx.restore();
    return;
  }

  // Pads
  if (type.startsWith('pad_')) {
    const padColor =
      type === 'pad_yellow' ? '#FACC15' :
      type === 'pad_pink' ? '#F472B6' :
      type === 'pad_red' ? '#EF4444' : '#38BDF8';
    const ph = s * 0.28;
    ctx.fillStyle = padColor;
    ctx.beginPath();
    ctx.roundRect(sx + 2, syBottom - ph, s - 4, ph, 4);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Pulse chevron above pad
    const pulse = (Math.sin(timeSec * 8) + 1) * 0.5;
    ctx.strokeStyle = padColor;
    ctx.globalAlpha = 0.55 + pulse * 0.4;
    ctx.beginPath();
    ctx.moveTo(sx + s * 0.25, syBottom - ph - 3);
    ctx.lineTo(sx + s * 0.5, syBottom - ph - 8 - pulse * 3);
    ctx.lineTo(sx + s * 0.75, syBottom - ph - 3);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  // Orbs
  if (type.startsWith('orb_')) {
    const cx = sx + s * 0.5;
    const cy = syTop + s * 0.5;
    const r = s * 0.4;
    const orbColor =
      type === 'orb_yellow' ? '#FACC15' :
      type === 'orb_pink' ? '#F472B6' :
      type === 'orb_red' ? '#EF4444' :
      type === 'orb_blue' ? '#38BDF8' :
      type === 'orb_green' ? '#4ADE80' :
      type === 'orb_black' ? '#64748B' : '#22C55E';

    const pulse = 1 + Math.sin(timeSec * 7) * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    // Outer ring
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1.5, 2 * vp.scale);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
    ctx.stroke();

    // Inner core
    ctx.fillStyle = orbColor;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Special symbol for dash/black/blue/green
    if (type === 'orb_dash') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, 0);
      ctx.lineTo(r * 0.4, 0);
      ctx.lineTo(r * 0.1, -r * 0.3);
      ctx.moveTo(r * 0.4, 0);
      ctx.lineTo(r * 0.1, r * 0.3);
      ctx.stroke();
    } else if (type === 'orb_black') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.4);
      ctx.lineTo(0, r * 0.4);
      ctx.lineTo(-r * 0.3, r * 0.1);
      ctx.moveTo(0, r * 0.4);
      ctx.lineTo(r * 0.3, r * 0.1);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Portals
  if (type.startsWith('portal_')) {
    const meta = getPortalMeta(type);
    const cx = sx + s * 0.5;
    const cy = syTop - s * 0.5;
    const pw = s * 0.72;
    const ph = s * 2.7;

    ctx.save();
    ctx.translate(cx, cy);
    // Glow aura
    ctx.fillStyle = meta.glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, pw * 0.78, ph * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Portal ring
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = Math.max(2.5, 3 * vp.scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, pw * 0.5, ph * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, pw * 0.32, ph * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Label tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(9, Math.round(10 * vp.scale))}px "Chakra Petch", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.label, 0, 0);
    ctx.restore();
    return;
  }

  // Coin
  if (type === 'coin') {
    if (collected) return;
    const cx = sx + s * 0.5;
    const cy = syTop + s * 0.5;
    const r = s * 0.46;
    const spin = Math.abs(Math.cos(timeSec * 3.5));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.22, spin), 1);
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#A16207';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // End Wall
  if (type === 'end_wall') {
    const grad = ctx.createLinearGradient(sx, 0, sx + s * 2, 0);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0.85)');
    grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, 0, s * 2, vp.height);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, vp.height);
    ctx.stroke();
  }
}

export function getPortalMeta(type: ObjectType): { color: string; glow: string; label: string } {
  switch (type) {
    case 'portal_cube': return { color: '#4ADE80', glow: 'rgba(74,222,128,0.2)', label: 'CUBE' };
    case 'portal_ship': return { color: '#F472B6', glow: 'rgba(244,114,182,0.22)', label: 'SHIP' };
    case 'portal_ball': return { color: '#FB923C', glow: 'rgba(251,146,60,0.22)', label: 'BALL' };
    case 'portal_ufo': return { color: '#FACC15', glow: 'rgba(250,204,21,0.22)', label: 'UFO' };
    case 'portal_wave': return { color: '#22D3EE', glow: 'rgba(34,211,238,0.22)', label: 'WAVE' };
    case 'portal_robot': return { color: '#E2E8F0', glow: 'rgba(226,232,240,0.2)', label: 'ROBO' };
    case 'portal_spider': return { color: '#C084FC', glow: 'rgba(192,132,252,0.22)', label: 'SPDR' };
    case 'portal_grav_down': return { color: '#38BDF8', glow: 'rgba(56,189,248,0.2)', label: 'G+' };
    case 'portal_grav_up': return { color: '#FACC15', glow: 'rgba(250,204,21,0.2)', label: 'G-' };
    case 'portal_speed_05': return { color: '#FB923C', glow: 'rgba(251,146,60,0.2)', label: '0.5x' };
    case 'portal_speed_1': return { color: '#38BDF8', glow: 'rgba(56,189,248,0.2)', label: '1x' };
    case 'portal_speed_2': return { color: '#4ADE80', glow: 'rgba(74,222,128,0.2)', label: '2x' };
    case 'portal_speed_3': return { color: '#EC4899', glow: 'rgba(236,72,153,0.2)', label: '3x' };
    case 'portal_speed_4': return { color: '#EF4444', glow: 'rgba(239,68,68,0.22)', label: '4x' };
    case 'portal_mini': return { color: '#EC4899', glow: 'rgba(236,72,153,0.2)', label: 'MINI' };
    case 'portal_normal': return { color: '#4ADE80', glow: 'rgba(74,222,128,0.2)', label: 'FULL' };
    default: return { color: '#FFFFFF', glow: 'rgba(255,255,255,0.15)', label: '' };
  }
}

export function drawPlayerIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  mode: GameMode,
  rotationDeg: number,
  gravityDir: 1 | -1,
  iconConfig: IconConfig,
  timeSec = 0
) {
  const half = size / 2;
  const pCol = iconConfig.primaryColor;
  const sCol = iconConfig.secondaryColor;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  if (gravityDir === -1 && (mode === 'ship' || mode === 'ufo' || mode === 'robot' || mode === 'spider')) {
    ctx.scale(1, -1);
  }

  ctx.lineWidth = Math.max(1.5, size * 0.065);
  ctx.strokeStyle = '#090D16';

  if (mode === 'cube') {
    const skin = iconConfig.cubeId % 4;
    ctx.fillStyle = pCol;
    ctx.fillRect(-half, -half, size, size);
    ctx.strokeRect(-half, -half, size, size);

    ctx.fillStyle = sCol;
    if (skin === 0) {
      // Classic GD face
      ctx.fillRect(-half * 0.55, -half * 0.45, size * 0.22, size * 0.22);
      ctx.fillRect(half * 0.12, -half * 0.45, size * 0.22, size * 0.22);
      ctx.fillRect(-half * 0.55, half * 0.15, size * 0.55, size * 0.18);
    } else if (skin === 1) {
      // Inner diamond + frame
      ctx.beginPath();
      ctx.moveTo(0, -half * 0.65);
      ctx.lineTo(half * 0.65, 0);
      ctx.lineTo(0, half * 0.65);
      ctx.lineTo(-half * 0.65, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (skin === 2) {
      // Visor core
      ctx.fillRect(-half * 0.7, -half * 0.25, size * 0.7, size * 0.25);
      ctx.strokeRect(-half * 0.7, -half * 0.25, size * 0.7, size * 0.25);
    } else {
      // Crosshair X
      ctx.fillRect(-half * 0.35, -half * 0.35, size * 0.35, size * 0.35);
      ctx.strokeRect(-half * 0.68, -half * 0.68, size * 0.68, size * 0.68);
    }
  } else if (mode === 'ship') {
    // Mini cube pilot inside cockpit
    ctx.fillStyle = pCol;
    ctx.fillRect(-half * 0.35, -half * 0.75, size * 0.38, size * 0.38);
    ctx.strokeRect(-half * 0.35, -half * 0.75, size * 0.38, size * 0.38);

    // Ship hull
    ctx.fillStyle = sCol;
    ctx.beginPath();
    ctx.moveTo(-half * 0.95, -half * 0.1);
    ctx.lineTo(half * 0.6, -half * 0.2);
    ctx.lineTo(half * 1.05, half * 0.15);
    ctx.lineTo(half * 0.55, half * 0.58);
    ctx.lineTo(-half * 0.75, half * 0.58);
    ctx.lineTo(-half * 1.05, half * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Accent stripe
    ctx.fillStyle = pCol;
    ctx.fillRect(-half * 0.5, half * 0.08, size * 0.55, size * 0.16);
  } else if (mode === 'ball') {
    const skin = iconConfig.ballId % 3;
    ctx.fillStyle = pCol;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = sCol;
    const spikes = skin === 0 ? 6 : skin === 1 ? 8 : 4;
    for (let i = 0; i < spikes; i++) {
      const a = (Math.PI * 2 * i) / spikes;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-half * 0.18, -half * 0.88);
      ctx.lineTo(0, -half * 1.12);
      ctx.lineTo(half * 0.18, -half * 0.88);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (mode === 'ufo') {
    // Glass dome
    ctx.fillStyle = 'rgba(186, 230, 253, 0.78)';
    ctx.beginPath();
    ctx.arc(0, -half * 0.1, half * 0.58, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Saucer body
    ctx.fillStyle = pCol;
    ctx.beginPath();
    ctx.ellipse(0, half * 0.18, half * 1.0, half * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Trim lights
    ctx.fillStyle = sCol;
    for (const lx of [-half * 0.5, 0, half * 0.5]) {
      ctx.beginPath();
      ctx.arc(lx, half * 0.18, half * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mode === 'wave') {
    ctx.fillStyle = pCol;
    ctx.beginPath();
    ctx.moveTo(half * 0.95, 0);
    ctx.lineTo(-half * 0.75, -half * 0.68);
    ctx.lineTo(-half * 0.35, 0);
    ctx.lineTo(-half * 0.75, half * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = sCol;
    ctx.beginPath();
    ctx.moveTo(half * 0.45, 0);
    ctx.lineTo(-half * 0.35, -half * 0.3);
    ctx.lineTo(-half * 0.35, half * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (mode === 'robot') {
    const legSwing = Math.sin(timeSec * 16) * half * 0.25;
    // Head
    ctx.fillStyle = pCol;
    ctx.fillRect(-half * 0.65, -half * 0.85, size * 0.65, size * 0.52);
    ctx.strokeRect(-half * 0.65, -half * 0.85, size * 0.65, size * 0.52);
    // Visor
    ctx.fillStyle = sCol;
    ctx.fillRect(-half * 0.1, -half * 0.7, size * 0.34, size * 0.18);
    // Legs
    ctx.fillStyle = sCol;
    ctx.fillRect(-half * 0.48 + legSwing, half * 0.15, size * 0.22, size * 0.36);
    ctx.strokeRect(-half * 0.48 + legSwing, half * 0.15, size * 0.22, size * 0.36);
    ctx.fillRect(half * 0.08 - legSwing, half * 0.15, size * 0.22, size * 0.36);
    ctx.strokeRect(half * 0.08 - legSwing, half * 0.15, size * 0.22, size * 0.36);
  } else if (mode === 'spider') {
    const legSwing = Math.sin(timeSec * 20) * half * 0.22;
    // Legs
    ctx.strokeStyle = sCol;
    ctx.lineWidth = Math.max(2, size * 0.11);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * half * 0.3, 0);
      ctx.lineTo(dir * half * 0.85, half * 0.25 + legSwing * dir);
      ctx.lineTo(dir * half * 0.65, half * 0.9);
      ctx.stroke();
    }
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = Math.max(1.5, size * 0.065);
    // Core body
    ctx.fillStyle = pCol;
    ctx.beginPath();
    ctx.roundRect(-half * 0.62, -half * 0.55, size * 0.62, size * 0.5, 4);
    ctx.fill();
    ctx.stroke();
    // Eye
    ctx.fillStyle = sCol;
    ctx.beginPath();
    ctx.arc(half * 0.22, -half * 0.12, half * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function renderSimulation(
  ctx: CanvasRenderingContext2D,
  sim: GeometryDashSimulation,
  iconConfig: IconConfig,
  canvasWidth: number,
  canvasHeight: number,
  showHitboxes: boolean,
  timeSec: number
) {
  const level: LevelData = sim.level;
  const p = sim.player;

  const vp = computeGameViewport(canvasWidth, canvasHeight, p.x, p.cy, p.mode);

  ctx.save();
  if (p.screenShake > 0) {
    const sx = (Math.random() - 0.5) * p.screenShake;
    const sy = (Math.random() - 0.5) * p.screenShake;
    ctx.translate(sx, sy);
  }

  const showCeiling =
    p.mode === 'ship' || p.mode === 'ball' || p.mode === 'ufo' || p.mode === 'wave' || p.mode === 'spider';

  drawBackground(ctx, vp, level.bgColor, level.groundColor, showCeiling);

  // Spider laser beams
  for (const beam of p.spiderBeams) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, beam.life / 0.18);
    ctx.strokeStyle = beam.color;
    ctx.lineWidth = 5 * vp.scale;
    ctx.beginPath();
    ctx.moveTo(worldToScreenX(beam.x, vp), worldToScreenY(beam.y1, vp));
    ctx.lineTo(worldToScreenX(beam.x, vp), worldToScreenY(beam.y2, vp));
    ctx.stroke();
    ctx.restore();
  }

  // Draw level objects
  let coinIdx = 0;
  for (const obj of level.objects) {
    let collected = false;
    if (obj.type === 'coin') {
      collected = p.collectedCoins.includes(coinIdx);
      coinIdx++;
    }
    drawLevelObject(ctx, obj, vp, timeSec, collected);
  }

  // Practice Checkpoints
  for (const cp of sim.checkpoints) {
    const cx = worldToScreenX(cp.x, vp);
    const cy = worldToScreenY(cp.cy, vp);
    const r = 10 * vp.scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#4ADE80';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.75, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.75, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Player Trail
  if (p.trail.length > 1 && !p.dead) {
    ctx.save();
    const isWave = p.mode === 'wave';
    if (isWave) {
      ctx.strokeStyle = iconConfig.primaryColor;
      ctx.lineWidth = Math.max(3, (p.isMini ? 4 : 7) * vp.scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      p.trail.forEach((pt, idx) => {
        const tx = worldToScreenX(pt.x, vp);
        const ty = worldToScreenY(pt.cy, vp);
        if (idx === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      });
      ctx.lineTo(worldToScreenX(p.x, vp), worldToScreenY(p.cy, vp));
      ctx.stroke();
    } else {
      for (let i = 1; i < p.trail.length; i++) {
        const prev = p.trail[i - 1];
        const curr = p.trail[i];
        const alpha = (i / p.trail.length) * 0.42;
        ctx.strokeStyle =
          iconConfig.trailStyle === 'rainbow'
            ? `hsla(${(i * 18 + timeSec * 180) % 360}, 90%, 60%, ${alpha})`
            : iconConfig.trailStyle === 'neon'
            ? iconConfig.secondaryColor
            : iconConfig.primaryColor;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = (p.isMini ? 4 : 7) * vp.scale * (i / p.trail.length);
        ctx.beginPath();
        ctx.moveTo(worldToScreenX(prev.x, vp), worldToScreenY(prev.cy, vp));
        ctx.lineTo(worldToScreenX(curr.x, vp), worldToScreenY(curr.cy, vp));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Player Icon
  if (!p.dead) {
    const px = worldToScreenX(p.x, vp);
    const py = worldToScreenY(p.cy, vp);
    const pSize = (p.isMini ? 18 : 30) * vp.scale;
    drawPlayerIcon(ctx, px, py, pSize, p.mode, p.rotation, p.gravityDir, iconConfig, timeSec);
  }

  // Particles
  for (const pt of p.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    const sx = worldToScreenX(pt.x, vp);
    const sy = worldToScreenY(pt.y, vp);
    const sz = pt.size * vp.scale;
    ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
    ctx.restore();
  }

  // Optional Hitbox Overlay (Pro feature!)
  if (showHitboxes) {
    const boxes = sim.getDebugHitboxes();
    ctx.save();
    for (const b of boxes) {
      const rx = worldToScreenX(b.x, vp);
      const ryTop = worldToScreenY(b.y + b.h, vp);
      const rw = b.w * vp.scale;
      const rh = b.h * vp.scale;
      ctx.strokeStyle =
        b.kind === 'player' ? '#22D3EE' :
        b.kind === 'hazard' ? '#F43F5E' :
        b.kind === 'solid' ? '#38BDF8' :
        b.kind === 'orb' ? '#FACC15' :
        b.kind === 'portal' ? '#C084FC' : '#4ADE80';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ryTop, rw, rh);
    }
    ctx.restore();
  }

  // Death Flash
  if (p.flashAlpha > 0) {
    ctx.fillStyle = `rgba(244, 63, 94, ${p.flashAlpha})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.restore();
}
