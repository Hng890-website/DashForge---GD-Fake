import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Copy,
  Eraser,
  FolderOpen,
  Hand,
  MousePointer,
  Paintbrush,
  Play,
  Plus,
  Save,
  Settings2,
  Trash2,
  UploadCloud,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { BG_THEMES, CEILING_HEIGHT, DIFFICULTY_META, GRID_SIZE, SONG_CATALOG } from '../game/constants';
import { drawBackground, drawLevelObject, RenderViewport } from '../game/renderer';
import {
  Difficulty,
  GameMode,
  LevelData,
  LevelObject,
  ObjectType,
  PlayerDraftLevel,
  SpeedTier,
} from '../types/game';

interface LevelEditorProps {
  uid: string | null;
  displayName: string;
  drafts: PlayerDraftLevel[];
  initialLevel?: LevelData | null;
  onSaveDraft: (draft: Omit<PlayerDraftLevel, 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteDraft: (draftId: string) => Promise<void>;
  onPublishLevel: (params: {
    authorUid: string;
    authorName: string;
    name: string;
    description: string;
    difficulty: Difficulty;
    stars: number;
    songId: string;
    bgColor: string;
    groundColor: string;
    startMode: GameMode;
    startSpeed: SpeedTier;
    startGravity: 1 | -1;
    objects: LevelObject[];
    verified: boolean;
  }) => Promise<string>;
  onPlaytest: (level: LevelData, onVerified: () => void) => void;
  onSignIn: () => void;
}

type EditorTool = 'build' | 'swipe' | 'select' | 'erase' | 'pan';
type PaletteCategory = 'blocks' | 'hazards' | 'interactive' | 'portals' | 'special';

const PALETTE: Record<PaletteCategory, { type: ObjectType; label: string }[]> = {
  blocks: [
    { type: 'block', label: 'Block' },
    { type: 'brick', label: 'Brick' },
    { type: 'neon_block', label: 'Neon' },
    { type: 'half_slab', label: 'Slab' },
    { type: 'pillar', label: 'Pillar' },
    { type: 'slope_up', label: 'Slope /' },
    { type: 'slope_down', label: 'Slope \\' },
  ],
  hazards: [
    { type: 'spike', label: 'Spike' },
    { type: 'mini_spike', label: 'Mini Spk' },
    { type: 'spike_down', label: 'Down Spk' },
    { type: 'mini_spike_down', label: 'Mini Down' },
    { type: 'saw', label: 'Sawblade' },
  ],
  interactive: [
    { type: 'pad_yellow', label: 'Y-Pad' },
    { type: 'pad_pink', label: 'P-Pad' },
    { type: 'pad_red', label: 'R-Pad' },
    { type: 'pad_blue', label: 'B-Pad' },
    { type: 'orb_yellow', label: 'Y-Orb' },
    { type: 'orb_pink', label: 'P-Orb' },
    { type: 'orb_red', label: 'R-Orb' },
    { type: 'orb_blue', label: 'B-Orb' },
    { type: 'orb_green', label: 'G-Orb' },
    { type: 'orb_black', label: 'Blk-Orb' },
    { type: 'orb_dash', label: 'Dash Orb' },
  ],
  portals: [
    { type: 'portal_cube', label: 'Cube' },
    { type: 'portal_ship', label: 'Ship' },
    { type: 'portal_ball', label: 'Ball' },
    { type: 'portal_ufo', label: 'UFO' },
    { type: 'portal_wave', label: 'Wave' },
    { type: 'portal_robot', label: 'Robot' },
    { type: 'portal_spider', label: 'Spider' },
    { type: 'portal_grav_down', label: 'Grav +' },
    { type: 'portal_grav_up', label: 'Grav -' },
    { type: 'portal_speed_05', label: '0.5x' },
    { type: 'portal_speed_1', label: '1x' },
    { type: 'portal_speed_2', label: '2x' },
    { type: 'portal_speed_3', label: '3x' },
    { type: 'portal_speed_4', label: '4x' },
    { type: 'portal_mini', label: 'Mini' },
    { type: 'portal_normal', label: 'Normal' },
  ],
  special: [
    { type: 'coin', label: 'Coin' },
    { type: 'end_wall', label: 'Finish' },
  ],
};

function makeStarterObjects(): LevelObject[] {
  return [
    { id: 'ed_1', type: 'spike', x: 14, y: 0 },
    { id: 'ed_2', type: 'block', x: 22, y: 0 },
    { id: 'ed_3', type: 'block', x: 23, y: 0 },
    { id: 'ed_4', type: 'spike', x: 28, y: 0 },
    { id: 'ed_5', type: 'pad_yellow', x: 34, y: 0 },
    { id: 'ed_6', type: 'block', x: 39, y: 3 },
    { id: 'ed_7', type: 'block', x: 40, y: 3 },
    { id: 'ed_8', type: 'coin', x: 39.5, y: 4.5 },
    { id: 'ed_9', type: 'end_wall', x: 56, y: 0 },
  ];
}

export const LevelEditor: React.FC<LevelEditorProps> = ({
  uid,
  displayName,
  drafts,
  initialLevel,
  onSaveDraft,
  onDeleteDraft,
  onPublishLevel,
  onPlaytest,
  onSignIn,
}) => {
  const [draftId, setDraftId] = useState<string>(() => `draft_${Date.now()}`);
  const [name, setName] = useState('My Custom Level');
  const [songId, setSongId] = useState(SONG_CATALOG[0].id);
  const [bgColor, setBgColor] = useState(BG_THEMES[0].bg);
  const [groundColor, setGroundColor] = useState(BG_THEMES[0].ground);
  const [startMode, setStartMode] = useState<GameMode>('cube');
  const [startSpeed, setStartSpeed] = useState<SpeedTier>('1x');
  const [startGravity, setStartGravity] = useState<1 | -1>(1);
  const [objects, setObjects] = useState<LevelObject[]>(makeStarterObjects);
  const [verified, setVerified] = useState(false);

  const [tool, setTool] = useState<EditorTool>('build');
  const [category, setCategory] = useState<PaletteCategory>('blocks');
  const [selectedType, setSelectedType] = useState<ObjectType>('block');
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [snapHalf, setSnapHalf] = useState(false);

  const [camX, setCamX] = useState(-60);
  const [camY, setCamY] = useState(-60);
  const [zoom, setZoom] = useState(1);

  const [showSettings, setShowSettings] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [showPublish, setShowPublish] = useState(false);

  const [pubDesc, setPubDesc] = useState('');
  const [pubDiff, setPubDiff] = useState<Difficulty>('Normal');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerDownRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);
  const lastSwipeKeyRef = useRef<string>('');

  // Load initial cloned level if provided
  useEffect(() => {
    if (initialLevel) {
      setDraftId(`draft_${Date.now()}`);
      setName(`${initialLevel.name} Copy`.slice(0, 40));
      setSongId(initialLevel.songId);
      setBgColor(initialLevel.bgColor);
      setGroundColor(initialLevel.groundColor);
      setStartMode(initialLevel.startMode);
      setStartSpeed(initialLevel.startSpeed);
      setStartGravity(initialLevel.startGravity);
      setObjects(initialLevel.objects.map((o) => ({ ...o })));
      setVerified(false);
      setCamX(-60);
    }
  }, [initialLevel]);

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2600);
  };

  const getViewport = useCallback(
    (w: number, h: number): RenderViewport => ({
      width: w,
      height: h,
      camX,
      camY,
      scale: zoom,
    }),
    [camX, camY, zoom]
  );

  // Screen -> Grid coordinates
  const screenToGrid = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { gx: 0, gy: 0, worldX: 0, worldY: 0 };
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const worldX = sx / zoom + camX;
      const worldY = (rect.height - sy) / zoom + camY;
      const step = snapHalf ? 0.5 : 1;
      const gx = Math.floor(worldX / GRID_SIZE / step) * step;
      const gy = Math.floor(worldY / GRID_SIZE / step) * step;
      return { gx, gy, worldX, worldY };
    },
    [camX, camY, snapHalf, zoom]
  );

  const placeObjectAt = useCallback(
    (gx: number, gy: number) => {
      if (gy < 0 || gy > 18 || gx < 0) return;
      const key = `${gx}_${gy}_${selectedType}`;
      if (lastSwipeKeyRef.current === key) return;
      lastSwipeKeyRef.current = key;

      setObjects((prev) => {
        if (prev.length >= 1500) return prev;
        const exists = prev.some(
          (o) => Math.abs(o.x - gx) < 0.1 && Math.abs(o.y - gy) < 0.1 && o.type === selectedType
        );
        if (exists) return prev;
        const id = `ed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        setVerified(false);
        return [...prev, { id, type: selectedType, x: gx, y: gy }];
      });
    },
    [selectedType]
  );

  const eraseObjectAt = useCallback((worldX: number, worldY: number) => {
    const gx = worldX / GRID_SIZE;
    const gy = worldY / GRID_SIZE;
    setObjects((prev) => {
      const idx = prev.findIndex(
        (o) => gx >= o.x - 0.1 && gx <= o.x + 1.1 && gy >= o.y - 0.1 && gy <= o.y + 1.2
      );
      if (idx === -1) return prev;
      const next = [...prev];
      const removed = next.splice(idx, 1)[0];
      if (removed.id === selectedObjId) setSelectedObjId(null);
      setVerified(false);
      return next;
    });
  }, [selectedObjId]);

  const selectObjectAt = useCallback((worldX: number, worldY: number) => {
    const gx = worldX / GRID_SIZE;
    const gy = worldY / GRID_SIZE;
    const found = objects.find(
      (o) => gx >= o.x - 0.1 && gx <= o.x + 1.1 && gy >= o.y - 0.1 && gy <= o.y + 1.2
    );
    setSelectedObjId(found ? found.id : null);
  }, [objects]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    pointerDownRef.current = true;
    lastSwipeKeyRef.current = '';

    // Right click or middle click pans/erases
    if (e.button === 1 || tool === 'pan') {
      panStartRef.current = { x: e.clientX, y: e.clientY, camX, camY };
      return;
    }

    const { gx, gy, worldX, worldY } = screenToGrid(e.clientX, e.clientY);
    if (e.button === 2 || tool === 'erase') {
      eraseObjectAt(worldX, worldY);
    } else if (tool === 'build' || tool === 'swipe') {
      placeObjectAt(gx, gy);
    } else if (tool === 'select') {
      selectObjectAt(worldX, worldY);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerDownRef.current) return;
    if (panStartRef.current) {
      const dx = (e.clientX - panStartRef.current.x) / zoom;
      const dy = (e.clientY - panStartRef.current.y) / zoom;
      setCamX(Math.max(-120, panStartRef.current.camX - dx));
      setCamY(Math.max(-120, Math.min(300, panStartRef.current.camY + dy)));
      return;
    }
    const { gx, gy, worldX, worldY } = screenToGrid(e.clientX, e.clientY);
    if (tool === 'swipe') {
      placeObjectAt(gx, gy);
    } else if (tool === 'erase') {
      eraseObjectAt(worldX, worldY);
    }
  };

  const handleCanvasPointerUp = () => {
    pointerDownRef.current = false;
    panStartRef.current = null;
    lastSwipeKeyRef.current = '';
  };

  // Nudge or delete selected object with keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' && !selectedObjId) setCamX((x) => x + 90);
      if (e.key === 'ArrowLeft' && !selectedObjId) setCamX((x) => Math.max(-120, x - 90));
      if (!selectedObjId) return;

      const step = e.shiftKey ? 0.25 : 1;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setObjects((prev) => prev.map((o) => (o.id === selectedObjId ? { ...o, x: o.x + step } : o)));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setObjects((prev) =>
          prev.map((o) => (o.id === selectedObjId ? { ...o, x: Math.max(0, o.x - step) } : o))
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setObjects((prev) =>
          prev.map((o) => (o.id === selectedObjId ? { ...o, y: Math.min(18, o.y + step) } : o))
        );
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setObjects((prev) =>
          prev.map((o) => (o.id === selectedObjId ? { ...o, y: Math.max(0, o.y - step) } : o))
        );
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setObjects((prev) => prev.filter((o) => o.id !== selectedObjId));
        setSelectedObjId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedObjId]);

  // Render Editor Canvas
  useEffect(() => {
    let raf = 0;
    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const tw = Math.max(300, Math.floor(rect.width * dpr));
        const th = Math.max(240, Math.floor(rect.height * dpr));
        if (canvas.width !== tw || canvas.height !== th) {
          canvas.width = tw;
          canvas.height = th;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          const vp = getViewport(rect.width, rect.height);
          drawBackground(ctx, vp, bgColor, groundColor, true);

          // Draw subtle editor grid lines
          const stepPx = GRID_SIZE * zoom;
          const startGx = Math.max(0, Math.floor(camX / GRID_SIZE));
          const endGx = Math.ceil((camX + rect.width / zoom) / GRID_SIZE);

          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          for (let gx = startGx; gx <= endGx; gx++) {
            const sx = (gx * GRID_SIZE - camX) * zoom;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, rect.height);
            ctx.stroke();
          }
          for (let gy = 0; gy <= 16; gy++) {
            const sy = rect.height - (gy * GRID_SIZE - camY) * zoom;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(rect.width, sy);
            ctx.stroke();
          }

          // Start spawn line at X=0
          const zeroX = (0 - camX) * zoom;
          if (zeroX >= -10 && zeroX <= rect.width + 10) {
            ctx.strokeStyle = '#4ADE80';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(zeroX, 0);
            ctx.lineTo(zeroX, rect.height);
            ctx.stroke();
          }

          // Ceiling guide line
          const ceilY = rect.height - (CEILING_HEIGHT - camY) * zoom;
          ctx.strokeStyle = 'rgba(244,63,94,0.35)';
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(0, ceilY);
          ctx.lineTo(rect.width, ceilY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw objects
          const t = now / 1000;
          for (const obj of objects) {
            drawLevelObject(ctx, obj, vp, t, false);
            if (obj.id === selectedObjId) {
              const sx = (obj.x * GRID_SIZE - camX) * zoom;
              const syBottom = rect.height - (obj.y * GRID_SIZE - camY) * zoom;
              ctx.strokeStyle = '#22D3EE';
              ctx.lineWidth = 2.5;
              ctx.strokeRect(sx - 2, syBottom - stepPx - 2, stepPx + 4, stepPx + 4);
            }
          }

          ctx.restore();
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [bgColor, camX, camY, getViewport, groundColor, objects, selectedObjId, zoom]);

  const buildLevelData = (): LevelData => {
    const song = SONG_CATALOG.find((s) => s.id === songId) || SONG_CATALOG[0];
    return {
      id: draftId,
      name: name.trim() || 'Untitled Level',
      authorName: displayName,
      description: pubDesc.trim() || 'Created with DashForge Level Editor',
      difficulty: pubDiff,
      stars: DIFFICULTY_META[pubDiff].stars,
      songId: song.id,
      bpm: song.bpm,
      bgColor,
      groundColor,
      startMode,
      startSpeed,
      startGravity,
      objects,
      verified,
    };
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSaveDraft({
        uid: uid || 'guest',
        draftId,
        name: name.trim().slice(0, 40) || 'Untitled Level',
        songId,
        bgColor,
        groundColor,
        startMode,
        startSpeed,
        startGravity,
        objects,
        verified,
      });
      showToast(uid ? 'Đã lưu bản nháp lên đám mây!' : 'Đã lưu bản nháp trên trình duyệt!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi lưu bản nháp');
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) {
      onSignIn();
      return;
    }
    if (objects.length === 0) {
      showToast('Màn chơi cần ít nhất 1 vật thể!');
      return;
    }
    setBusy(true);
    try {
      await onPublishLevel({
        authorUid: uid,
        authorName: displayName,
        name: name.trim().slice(0, 40) || 'Custom Level',
        description: pubDesc.trim().slice(0, 160),
        difficulty: pubDiff,
        stars: DIFFICULTY_META[pubDiff].stars,
        songId,
        bgColor,
        groundColor,
        startMode,
        startSpeed,
        startGravity,
        objects,
        verified: true,
      });
      setShowPublish(false);
      showToast('Đã đăng màn chơi lên Server thành công!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể đăng màn chơi');
    } finally {
      setBusy(false);
    }
  };

  const loadDraftIntoEditor = (d: PlayerDraftLevel) => {
    setDraftId(d.draftId);
    setName(d.name);
    setSongId(d.songId);
    setBgColor(d.bgColor);
    setGroundColor(d.groundColor);
    setStartMode(d.startMode);
    setStartSpeed(d.startSpeed);
    setStartGravity(d.startGravity);
    setObjects(d.objects);
    setVerified(d.verified);
    setCamX(-60);
    setShowDrafts(false);
  };

  const handleNewDraft = () => {
    setDraftId(`draft_${Date.now()}`);
    setName('New Level');
    setObjects([]);
    setVerified(false);
    setCamX(-60);
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selectedObjId) return;
    setObjects((prev) =>
      prev.map((o) =>
        o.id === selectedObjId
          ? { ...o, x: Math.max(0, o.x + dx), y: Math.max(0, Math.min(18, o.y + dy)) }
          : o
      )
    );
    setVerified(false);
  };

  const duplicateSelected = () => {
    const src = objects.find((o) => o.id === selectedObjId);
    if (!src || objects.length >= 1500) return;
    const id = `ed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setObjects((prev) => [...prev, { ...src, id, x: src.x + 1 }]);
    setSelectedObjId(id);
    setVerified(false);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0D1322] px-4 py-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="font-display text-lg font-bold text-white bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 w-48 sm:w-64 focus:border-cyan-400 focus:outline-none"
          />
          <span className="font-mono-num text-xs text-slate-400">
            {objects.length}/1500 obj
          </span>
          {verified && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Verified</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleNewDraft}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Mới</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDrafts(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Bản nháp ({drafts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>Cài đặt</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Lưu</span>
          </button>

          <button
            type="button"
            onClick={() => onPlaytest(buildLevelData(), () => setVerified(true))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5 fill-slate-950" />
            <span>Playtest</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPublish(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>Đăng Server</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300">
          {statusMsg}
        </div>
      )}

      {/* Main Editor Canvas + Left Tool Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-1 flex lg:flex-col items-center justify-between lg:justify-start gap-2 rounded-xl border border-slate-800 bg-[#0D1322] p-2">
          {[
            { id: 'build' as EditorTool, icon: Plus, label: 'Đặt' },
            { id: 'swipe' as EditorTool, icon: Paintbrush, label: 'Vẽ' },
            { id: 'select' as EditorTool, icon: MousePointer, label: 'Chọn' },
            { id: 'erase' as EditorTool, icon: Eraser, label: 'Xóa' },
            { id: 'pan' as EditorTool, icon: Hand, label: 'Kéo' },
          ].map((t) => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                className={`flex flex-col items-center justify-center rounded-lg px-2 py-2 w-full text-[11px] font-medium transition-colors cursor-pointer ${
                  active ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 mb-0.5" />
                <span>{t.label}</span>
              </button>
            );
          })}

          <div className="hidden lg:block h-px w-full bg-slate-800 my-1" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
            title="Phóng to"
            className="flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            title="Thu nhỏ"
            className="flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSnapHalf((v) => !v)}
            className={`rounded-lg px-2 py-1.5 text-[10px] font-mono-num font-semibold cursor-pointer ${
              snapHalf ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {snapHalf ? '0.5x' : '1.0x'}
          </button>
        </div>

        {/* Canvas Viewport */}
        <div className="lg:col-span-11 relative overflow-hidden rounded-2xl border border-slate-800 bg-[#050914]">
          <canvas
            ref={canvasRef}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            className="block h-[420px] sm:h-[460px] w-full touch-none select-none cursor-crosshair"
          />

          {/* Selected Object Quick Nudge Controls */}
          {selectedObjId && (
            <div className="absolute top-3 right-3 flex items-center gap-1 rounded-xl border border-slate-700 bg-[#070B14]/90 p-1.5 backdrop-blur-sm">
              <button type="button" onClick={() => nudgeSelected(-0.5, 0)} className="p-1.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"><ArrowLeft className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => nudgeSelected(0, 0.5)} className="p-1.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => nudgeSelected(0, -0.5)} className="p-1.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => nudgeSelected(0.5, 0)} className="p-1.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"><ArrowRight className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={duplicateSelected} title="Nhân bản" className="p-1.5 rounded hover:bg-slate-800 text-cyan-300 cursor-pointer"><Copy className="h-3.5 w-3.5" /></button>
              <button
                type="button"
                onClick={() => {
                  setObjects((prev) => prev.filter((o) => o.id !== selectedObjId));
                  setSelectedObjId(null);
                }}
                title="Xóa"
                className="p-1.5 rounded hover:bg-slate-800 text-rose-400 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Horizontal Scroller Quick Controls */}
          <div className="flex items-center justify-between border-t border-slate-800 bg-[#0D1322] px-4 py-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCamX((x) => Math.max(-120, x - 240))}
                className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                ← Trái
              </button>
              <button
                type="button"
                onClick={() => setCamX(-60)}
                className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                Về đầu (X=0)
              </button>
              <button
                type="button"
                onClick={() => setCamX((x) => x + 240)}
                className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                Phải →
              </button>
            </div>
            <span className="font-mono-num">
              Camera X: {Math.round(camX / GRID_SIZE)} blocks · Chuột phải để xóa nhanh
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Object Palette */}
      <div className="rounded-2xl border border-slate-800 bg-[#0D1322] p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          {(
            [
              { id: 'blocks', label: 'Blocks & Slopes' },
              { id: 'hazards', label: 'Spikes & Saws' },
              { id: 'interactive', label: 'Orbs & Pads' },
              { id: 'portals', label: 'Portals' },
              { id: 'special', label: 'Coins & Finish' },
            ] as { id: PaletteCategory; label: string }[]
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                category === cat.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {PALETTE[category].map((item) => {
            const active = selectedType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => {
                  setSelectedType(item.type);
                  if (tool === 'erase' || tool === 'pan' || tool === 'select') setTool('build');
                }}
                className={`rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Level Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0D1322] p-6 space-y-5">
            <h3 className="font-display text-xl font-bold text-white">Cài đặt Màn chơi</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nhạc nền (BPM)</label>
                <select
                  value={songId}
                  onChange={(e) => setSongId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {SONG_CATALOG.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.bpm} BPM)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Chế độ bắt đầu</label>
                <select
                  value={startMode}
                  onChange={(e) => setStartMode(e.target.value as GameMode)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white capitalize"
                >
                  {(['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'] as GameMode[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Tốc độ bắt đầu</label>
                <select
                  value={startSpeed}
                  onChange={(e) => setStartSpeed(e.target.value as SpeedTier)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {(['0.5x', '1x', '2x', '3x', '4x'] as SpeedTier[]).map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Trọng lực ban đầu</label>
                <select
                  value={startGravity}
                  onChange={(e) => setStartGravity(Number(e.target.value) as 1 | -1)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value={1}>Bình thường (Xuống)</option>
                  <option value={-1}>Đảo ngược (Lên)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">Chủ đề màu nền & mặt đất</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BG_THEMES.map((th) => (
                  <button
                    key={th.name}
                    type="button"
                    onClick={() => {
                      setBgColor(th.bg);
                      setGroundColor(th.ground);
                    }}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs text-white cursor-pointer ${
                      bgColor === th.bg ? 'border-cyan-400' : 'border-slate-700'
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: th.bg }} />
                    <span className="truncate">{th.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drafts Modal */}
      {showDrafts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0D1322] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-white">Bản nháp của bạn</h3>
              <button
                type="button"
                onClick={() => setShowDrafts(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {drafts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Chưa có bản nháp nào được lưu.
              </p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {drafts.map((d) => (
                  <div
                    key={d.draftId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3"
                  >
                    <div>
                      <div className="font-semibold text-sm text-white">{d.name}</div>
                      <div className="text-xs text-slate-400 font-mono-num">
                        {d.objects.length} vật thể · {d.startMode} · {d.startSpeed}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => loadDraftIntoEditor(d)}
                        className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                      >
                        Mở
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDraft(d.draftId)}
                        className="rounded-lg border border-slate-700 p-1.5 text-rose-400 hover:bg-slate-800 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Publish to Server Modal */}
      {showPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handlePublish}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0D1322] p-6 space-y-4"
          >
            <h3 className="font-display text-xl font-bold text-white">Đăng màn chơi lên Server</h3>
            {!uid && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                Bạn cần đăng nhập Google để xuất bản màn chơi lên cơ sở dữ liệu Server cộng đồng.
              </p>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Mô tả ngắn</label>
              <textarea
                rows={3}
                maxLength={160}
                value={pubDesc}
                onChange={(e) => setPubDesc(e.target.value)}
                placeholder="Mô tả phong cách gameplay hoặc bí mật của màn chơi..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Độ khó đề xuất</label>
              <select
                value={pubDiff}
                onChange={(e) => setPubDiff(e.target.value as Difficulty)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {(['Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Demon'] as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {d} ({DIFFICULTY_META[d].stars}★)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPublish(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Đang đăng...' : uid ? 'Xuất bản ngay' : 'Đăng nhập Google'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
