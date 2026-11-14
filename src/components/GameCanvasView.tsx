import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { DIFFICULTY_META } from '../game/constants';
import { GeometryDashSimulation, SoundCallbacks } from '../game/physics';
import { renderSimulation } from '../game/renderer';
import { IconConfig, LevelData, PlayerSettings } from '../types/game';

interface GameCanvasViewProps {
  level: LevelData;
  iconConfig: IconConfig;
  settings: PlayerSettings;
  initialPractice?: boolean;
  isPlaytest?: boolean;
  onExit: () => void;
  onProgressReport?: (stats: {
    levelId: string;
    percent: number;
    isPractice: boolean;
    completed: boolean;
    coins: number[];
    attemptsDelta: number;
    jumpsDelta: number;
  }) => void;
  onVerifiedComplete?: () => void;
  onUpdateSettings?: (next: PlayerSettings) => void;
}

export const GameCanvasView: React.FC<GameCanvasViewProps> = ({
  level,
  iconConfig,
  settings,
  initialPractice = false,
  isPlaytest = false,
  onExit,
  onProgressReport,
  onVerifiedComplete,
  onUpdateSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<GeometryDashSimulation | null>(null);
  const inputHeldRef = useRef(false);
  const pausedRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [isPractice, setIsPractice] = useState(initialPractice);
  const [showHitboxes, setShowHitboxes] = useState(settings.showHitboxes);
  const [muted, setMuted] = useState(false);
  const [hudState, setHudState] = useState({
    percent: 0,
    attempt: 1,
    mode: level.startMode,
    speed: level.startSpeed,
    checkpointsCount: 0,
    won: false,
    coins: [] as number[],
  });

  const bestPercentRef = useRef(0);
  const reportedWinRef = useRef(false);
  const attemptsSinceSyncRef = useRef(0);
  const jumpsSinceSyncRef = useRef(0);

  const flushProgress = useCallback(
    (forceWin = false) => {
      const sim = simRef.current;
      if (!sim || !onProgressReport || isPlaytest) return;
      const pct = sim.getProgressPercent();
      if (pct > bestPercentRef.current) {
        bestPercentRef.current = pct;
      }
      const wonNow = forceWin || sim.player.won;
      onProgressReport({
        levelId: level.id,
        percent: wonNow ? 100 : bestPercentRef.current,
        isPractice: sim.isPractice,
        completed: wonNow && !sim.isPractice,
        coins: wonNow && !sim.isPractice ? [...sim.player.collectedCoins] : [],
        attemptsDelta: attemptsSinceSyncRef.current,
        jumpsDelta: jumpsSinceSyncRef.current,
      });
      attemptsSinceSyncRef.current = 0;
      jumpsSinceSyncRef.current = 0;
    },
    [isPlaytest, level.id, onProgressReport]
  );

  // Initialize simulation
  useEffect(() => {
    const sim = new GeometryDashSimulation(level, initialPractice, settings.autoCheckpoints);
    simRef.current = sim;
    bestPercentRef.current = 0;
    reportedWinRef.current = false;
    attemptsSinceSyncRef.current = 1;
    jumpsSinceSyncRef.current = 0;
    soundEngine.resetSong(level.songId);
    soundEngine.setVolumes(muted ? 0 : settings.musicVolume, muted ? 0 : settings.sfxVolume);

    return () => {
      flushProgress(false);
    };
  }, [level, initialPractice]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    soundEngine.setVolumes(muted ? 0 : settings.musicVolume, muted ? 0 : settings.sfxVolume);
  }, [muted, settings.musicVolume, settings.sfxVolume]);

  useEffect(() => {
    if (simRef.current) {
      simRef.current.isPractice = isPractice;
    }
  }, [isPractice]);

  useEffect(() => {
    if (simRef.current) {
      simRef.current.autoCheckpoints = settings.autoCheckpoints;
    }
  }, [settings.autoCheckpoints]);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);

  const handleRestartFull = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.attempt += 1;
    attemptsSinceSyncRef.current += 1;
    sim.restart(false);
    reportedWinRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    soundEngine.resetSong(level.songId);
  }, [level.songId]);

  const handleTogglePractice = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    const next = !isPractice;
    setIsPractice(next);
    sim.isPractice = next;
    if (!next) {
      sim.checkpoints = [];
      sim.restart(false);
      soundEngine.resetSong(level.songId);
    }
    pausedRef.current = false;
    setPaused(false);
  }, [isPractice, level.songId]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        inputHeldRef.current = true;
      } else if (e.code === 'Escape') {
        e.preventDefault();
        togglePause();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleRestartFull();
      } else if (e.code === 'KeyZ' && simRef.current?.isPractice) {
        e.preventDefault();
        simRef.current.placeCheckpoint();
      } else if (e.code === 'KeyX' && simRef.current?.isPractice) {
        e.preventDefault();
        simRef.current.removeLastCheckpoint();
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        setShowHitboxes((prev) => {
          const next = !prev;
          if (onUpdateSettings) {
            onUpdateSettings({ ...settings, showHitboxes: next });
          }
          return next;
        });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        inputHeldRef.current = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleRestartFull, onUpdateSettings, settings, togglePause]);

  // Main 60/120fps render loop driving 240Hz fixed-timestep physics
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let hudTimer = 0;

    const sfx: SoundCallbacks = {
      onJump: () => {
        jumpsSinceSyncRef.current += 1;
        soundEngine.playJump();
      },
      onOrb: () => {
        jumpsSinceSyncRef.current += 1;
        soundEngine.playOrb();
      },
      onPad: () => soundEngine.playPad(),
      onPortal: () => soundEngine.playPortal(),
      onCoin: () => soundEngine.playCoin(),
      onDeath: () => soundEngine.playDeath(),
      onWin: () => soundEngine.playWin(),
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const canvas = canvasRef.current;
      const sim = simRef.current;
      if (canvas && sim) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.max(300, Math.floor(rect.width * dpr));
        const targetH = Math.max(240, Math.floor(rect.height * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        if (!pausedRef.current) {
          const { justRespawned } = sim.step(dt, inputHeldRef.current, sfx);
          if (justRespawned) {
            attemptsSinceSyncRef.current += 1;
            soundEngine.resetSong(level.songId);
            flushProgress(false);
          }
          if (!sim.player.dead && !sim.player.won) {
            soundEngine.tickSong(sim.player.songTime, sim.isPractice);
          }
          if (sim.player.won && !reportedWinRef.current) {
            reportedWinRef.current = true;
            flushProgress(true);
            if (!sim.isPractice && onVerifiedComplete) {
              onVerifiedComplete();
            }
          }
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          renderSimulation(
            ctx,
            sim,
            iconConfig,
            rect.width,
            rect.height,
            showHitboxes,
            now / 1000
          );
          ctx.restore();
        }

        hudTimer += dt;
        if (hudTimer >= 0.04 || sim.player.won) {
          hudTimer = 0;
          const pct = sim.getProgressPercent();
          if (pct > bestPercentRef.current) bestPercentRef.current = pct;
          setHudState({
            percent: sim.player.won ? 100 : pct,
            attempt: sim.attempt,
            mode: sim.player.mode,
            speed: sim.player.speed,
            checkpointsCount: sim.checkpoints.length,
            won: sim.player.won,
            coins: [...sim.player.collectedCoins],
          });
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [flushProgress, iconConfig, level.songId, onVerifiedComplete, showHitboxes]);

  const diffMeta = DIFFICULTY_META[level.difficulty];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 sm:px-6">
      {/* Unobtrusive Top Game HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0D1322] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              flushProgress(false);
              onExit();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{isPlaytest ? 'Quay lại Editor' : 'Danh sách'}</span>
          </button>

          <div>
            <h2 className="font-display text-base font-bold text-white leading-tight">{level.name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span style={{ color: diffMeta.color }}>{level.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">Attempt #{hudState.attempt}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize text-cyan-300">{hudState.mode}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">{hudState.speed}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex flex-1 min-w-[200px] max-w-md items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-900 border border-slate-700">
            <div
              className={`h-full transition-[width] duration-75 ${
                isPractice ? 'bg-emerald-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${hudState.percent}%` }}
            />
          </div>
          <span className="font-mono-num text-sm font-bold text-white w-12 text-right">
            {hudState.percent}%
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTogglePractice}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              isPractice
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Flag className="h-3.5 w-3.5" />
            <span>{isPractice ? 'Practice' : 'Normal'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHitboxes((v) => !v)}
            title="Hiện Hitbox (H)"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              showHitboxes
                ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Hitbox</span>
          </button>

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label="Toggle sound"
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={handleRestartFull}
            title="Chơi lại từ đầu (R)"
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={togglePause}
            title="Tạm dừng (Esc)"
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            {paused ? <Play className="h-4 w-4 text-cyan-400" /> : <Pause className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Canvas Stage */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#050914] shadow-2xl">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            e.preventDefault();
            inputHeldRef.current = true;
          }}
          onPointerUp={() => {
            inputHeldRef.current = false;
          }}
          onPointerLeave={() => {
            inputHeldRef.current = false;
          }}
          onPointerCancel={() => {
            inputHeldRef.current = false;
          }}
          className="block h-[500px] sm:h-[580px] w-full touch-none select-none cursor-pointer"
        />

        {/* Practice Checkpoint Quick Bar */}
        {isPractice && !hudState.won && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-[#070B14]/85 px-3 py-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => simRef.current?.placeCheckpoint()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Đặt mốc (Z)</span>
            </button>
            <button
              type="button"
              onClick={() => simRef.current?.removeLastCheckpoint()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa mốc (X)</span>
            </button>
            <span className="font-mono-num text-xs text-emerald-300 px-1">
              {hudState.checkpointsCount} mốc
            </span>
          </div>
        )}

        {/* Controls Hint */}
        <div className="pointer-events-none absolute bottom-4 right-4 hidden sm:flex items-center gap-2 rounded-lg bg-[#070B14]/80 px-3 py-1.5 text-xs text-slate-300 border border-slate-800/80">
          <span>Space / Chuột trái để nhảy hoặc giữ bay</span>
          <span aria-hidden="true">·</span>
          <span>R chơi lại</span>
          <span aria-hidden="true">·</span>
          <span>Esc tạm dừng</span>
        </div>

        {/* Pause Overlay */}
        {paused && !hudState.won && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#040711]/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#0D1322] p-6 text-center shadow-2xl">
              <h3 className="font-display text-2xl font-bold text-white">Tạm dừng</h3>
              <p className="mt-1 text-sm text-slate-400">
                {level.name} · {hudState.percent}%
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={togglePause}
                  className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  Tiếp tục chơi
                </button>
                <button
                  type="button"
                  onClick={handleRestartFull}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 cursor-pointer"
                >
                  Chơi lại từ đầu
                </button>
                <button
                  type="button"
                  onClick={handleTogglePractice}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-slate-800 cursor-pointer"
                >
                  {isPractice ? 'Chuyển sang Normal Mode' : 'Chuyển sang Practice Mode'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    flushProgress(false);
                    onExit();
                  }}
                  className="w-full rounded-xl border border-slate-800 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white cursor-pointer"
                >
                  Thoát màn chơi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory Overlay */}
        {hudState.won && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#040711]/85 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-[#0D1322] p-7 text-center shadow-2xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Trophy className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-display text-3xl font-bold text-white">
                {isPractice ? 'Hoàn thành Practice!' : 'Level Complete!'}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {level.name} · {isPractice ? 'Hãy thử sức ở Normal Mode để nhận sao' : `+${level.stars} Stars`}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 text-center">
                <div>
                  <div className="text-xs text-slate-400">Tiến độ</div>
                  <div className="font-mono-num text-lg font-bold text-cyan-400">100%</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Lần thử</div>
                  <div className="font-mono-num text-lg font-bold text-white">{hudState.attempt}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Coins</div>
                  <div className="font-mono-num text-lg font-bold text-amber-400">
                    {hudState.coins.length}/3
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRestartFull}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 cursor-pointer"
                >
                  Chơi lại
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="flex-1 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  {isPlaytest ? 'Quay lại Editor' : 'Tiếp tục'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
