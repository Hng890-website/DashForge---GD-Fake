import React, { useEffect, useRef, useState } from 'react';
import { Check, Save, Volume2 } from 'lucide-react';
import { ICON_COLORS } from '../game/constants';
import { drawPlayerIcon } from '../game/renderer';
import { GameMode, IconConfig, PlayerPublicProfile, PlayerSettings, TrailStyle } from '../types/game';

interface IconKitProps {
  profile: PlayerPublicProfile;
  settings: PlayerSettings;
  isSignedIn: boolean;
  onSaveProfile: (nextProfile: PlayerPublicProfile, nextSettings: PlayerSettings) => Promise<void>;
}

const MODES: { id: GameMode; label: string; skins: number }[] = [
  { id: 'cube', label: 'Cube', skins: 4 },
  { id: 'ship', label: 'Ship', skins: 2 },
  { id: 'ball', label: 'Ball', skins: 3 },
  { id: 'ufo', label: 'UFO', skins: 2 },
  { id: 'wave', label: 'Wave', skins: 2 },
  { id: 'robot', label: 'Robot', skins: 2 },
  { id: 'spider', label: 'Spider', skins: 2 },
];

const TRAILS: { id: TrailStyle; label: string }[] = [
  { id: 'classic', label: 'Classic Glow' },
  { id: 'neon', label: 'Secondary Neon' },
  { id: 'spark', label: 'Spark Pulse' },
  { id: 'rainbow', label: 'Rainbow Spectrum' },
];

export const IconKit: React.FC<IconKitProps> = ({
  profile,
  settings,
  isSignedIn,
  onSaveProfile,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('cube');
  const [iconConfig, setIconConfig] = useState<IconConfig>(profile.iconConfig);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [localSettings, setLocalSettings] = useState<PlayerSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setIconConfig(profile.iconConfig);
    setDisplayName(profile.displayName);
  }, [profile]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Animated Canvas Preview of the selected vehicle
  useEffect(() => {
    let raf = 0;
    const render = (now: number) => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Grid background
          ctx.fillStyle = '#070B14';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.lineWidth = 1;
          for (let gx = 0; gx < w; gx += 28) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, h);
            ctx.stroke();
          }
          for (let gy = 0; gy < h; gy += 28) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
          }

          const t = now / 1000;
          const bob = Math.sin(t * 2.5) * 6;
          const rot = selectedMode === 'cube' || selectedMode === 'ball' ? (t * 45) % 360 : bob * 1.4;
          drawPlayerIcon(ctx, w / 2, h / 2 + bob, 86, selectedMode, rot, 1, iconConfig, t);
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [iconConfig, selectedMode]);

  const getSkinValue = (mode: GameMode): number => {
    switch (mode) {
      case 'cube': return iconConfig.cubeId;
      case 'ship': return iconConfig.shipId;
      case 'ball': return iconConfig.ballId;
      case 'ufo': return iconConfig.ufoId;
      case 'wave': return iconConfig.waveId;
      case 'robot': return iconConfig.robotId;
      case 'spider': return iconConfig.spiderId;
    }
  };

  const setSkinValue = (mode: GameMode, val: number) => {
    setIconConfig((prev) => {
      const next = { ...prev };
      if (mode === 'cube') next.cubeId = val;
      else if (mode === 'ship') next.shipId = val;
      else if (mode === 'ball') next.ballId = val;
      else if (mode === 'ufo') next.ufoId = val;
      else if (mode === 'wave') next.waveId = val;
      else if (mode === 'robot') next.robotId = val;
      else if (mode === 'spider') next.spiderId = val;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveProfile(
        {
          ...profile,
          displayName: displayName.trim().slice(0, 32) || 'Dasher',
          iconConfig,
        },
        localSettings
      );
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  const activeModeMeta = MODES.find((m) => m.id === selectedMode) || MODES[0];

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Icon Kit & Cài đặt</h1>
          <p className="mt-1 text-sm text-slate-400">
            Tùy chỉnh nhân vật cho cả 7 chế độ chơi, màu sắc, hiệu ứng đuôi và âm thanh.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
        >
          {savedNotice ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          <span>{saving ? 'Đang lưu...' : savedNotice ? 'Đã lưu' : isSignedIn ? 'Lưu lên Database' : 'Lưu cục bộ'}</span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Live Vehicle Preview & Mode Tabs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0D1322]">
            <canvas ref={previewCanvasRef} width={480} height={260} className="w-full h-[240px] block" />
            <div className="border-t border-slate-800 p-4">
              <div className="flex flex-wrap gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMode(m.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedMode === m.id
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="text-xs font-medium text-slate-400 mb-2">
                  Kiểu dáng {activeModeMeta.label}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: activeModeMeta.skins }).map((_, idx) => {
                    const active = getSkinValue(selectedMode) === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSkinValue(selectedMode, idx)}
                        className={`rounded-lg border px-4 py-2 text-xs font-mono-num font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        Style #{idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Player Name */}
          <div className="rounded-2xl border border-slate-800 bg-[#0D1322] p-5">
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Tên hiển thị trên Bảng xếp hạng & Server
            </label>
            <input
              type="text"
              maxLength={32}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              placeholder="Nhập tên người chơi..."
            />
          </div>
        </div>

        {/* Right: Colors, Trails & Settings */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-[#0D1322] p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Màu chính (Primary)</h3>
              <div className="flex flex-wrap gap-2.5">
                {ICON_COLORS.map((hex) => (
                  <button
                    key={`p_${hex}`}
                    type="button"
                    onClick={() => setIconConfig((c) => ({ ...c, primaryColor: hex }))}
                    aria-label={`Primary color ${hex}`}
                    className={`h-9 w-9 rounded-lg border-2 transition-transform cursor-pointer ${
                      iconConfig.primaryColor === hex ? 'border-white scale-110' : 'border-slate-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Màu phụ (Secondary)</h3>
              <div className="flex flex-wrap gap-2.5">
                {ICON_COLORS.map((hex) => (
                  <button
                    key={`s_${hex}`}
                    type="button"
                    onClick={() => setIconConfig((c) => ({ ...c, secondaryColor: hex }))}
                    aria-label={`Secondary color ${hex}`}
                    className={`h-9 w-9 rounded-lg border-2 transition-transform cursor-pointer ${
                      iconConfig.secondaryColor === hex ? 'border-white scale-110' : 'border-slate-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Hiệu ứng vệt di chuyển (Trail)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {TRAILS.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => setIconConfig((c) => ({ ...c, trailStyle: tr.id }))}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                      iconConfig.trailStyle === tr.id
                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audio & Gameplay Settings */}
          <div className="rounded-2xl border border-slate-800 bg-[#0D1322] p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Volume2 className="h-4 w-4 text-cyan-400" />
              <span>Âm thanh & Gameplay</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Nhạc nền (Music)</span>
                  <span className="font-mono-num text-white">{Math.round(localSettings.musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={localSettings.musicVolume}
                  onChange={(e) =>
                    setLocalSettings((s) => ({ ...s, musicVolume: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Hiệu ứng (SFX)</span>
                  <span className="font-mono-num text-white">{Math.round(localSettings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={localSettings.sfxVolume}
                  onChange={(e) =>
                    setLocalSettings((s) => ({ ...s, sfxVolume: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.autoCheckpoints}
                  onChange={(e) =>
                    setLocalSettings((s) => ({ ...s, autoCheckpoints: e.target.checked }))
                  }
                  className="h-4 w-4 rounded accent-cyan-400"
                />
                <span>Tự động đặt Checkpoint trong Practice Mode</span>
              </label>

              <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.showHitboxes}
                  onChange={(e) =>
                    setLocalSettings((s) => ({ ...s, showHitboxes: e.target.checked }))
                  }
                  className="h-4 w-4 rounded accent-rose-400"
                />
                <span>Hiển thị Hitbox mặc định (phím H)</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
