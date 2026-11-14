import React from 'react';
import { Award, CheckCircle2, Coins, Flag, Play, Star } from 'lucide-react';
import { DIFFICULTY_META } from '../game/constants';
import { LevelData, PlayerLevelProgress, PlayerPublicProfile } from '../types/game';

interface OfficialLevelsViewProps {
  levels: LevelData[];
  progressMap: Record<string, PlayerLevelProgress>;
  profile: PlayerPublicProfile;
  isSignedIn: boolean;
  onPlayLevel: (level: LevelData, practice: boolean) => void;
  onSignIn: () => void;
}

export const OfficialLevelsView: React.FC<OfficialLevelsViewProps> = ({
  levels,
  progressMap,
  profile,
  isSignedIn,
  onPlayLevel,
  onSignIn,
}) => {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      {/* Hero Header & Player Summary Strip */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-slate-800/80 pb-8">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
            Official Campaign
          </h1>
          <p className="mt-2 text-base text-slate-400 leading-relaxed">
            Chinh phục 6 màn chơi chính thức với hệ thống vật lý 240Hz chuẩn Geometry Dash qua đầy đủ 7 chế độ: Cube, Ship, Ball, UFO, Wave, Robot và Spider.
          </p>
        </div>

        {/* 4-metric tabular stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 rounded-xl border border-slate-800 bg-[#0D1322] px-6 py-4 shrink-0">
          <div>
            <div className="text-xs text-slate-400">Stars</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono-num text-xl font-bold text-amber-400">
              <Star className="h-4 w-4 fill-amber-400" />
              <span>{profile.stars}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Secret Coins</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono-num text-xl font-bold text-yellow-300">
              <Coins className="h-4 w-4" />
              <span>{profile.coins}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Hoàn thành</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono-num text-xl font-bold text-cyan-400">
              <Award className="h-4 w-4" />
              <span>{profile.completedCount}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Lần thử</div>
            <div className="mt-1 font-mono-num text-xl font-bold text-white">
              {profile.totalAttempts}
            </div>
          </div>
        </div>
      </div>

      {!isSignedIn && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-5 py-3.5">
          <p className="text-sm text-slate-300">
            Tiến độ đang lưu tạm trên trình duyệt. Đăng nhập Google để đồng bộ dữ liệu lên cơ sở dữ liệu đám mây và đăng màn chơi lên Server.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Đăng nhập đồng bộ
          </button>
        </div>
      )}

      {/* Official Levels Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {levels.map((lvl, idx) => {
          const prog = progressMap[lvl.id];
          const normalPct = prog?.normalPercent ?? 0;
          const practicePct = prog?.practicePercent ?? 0;
          const coinsCount = prog?.coinsCollected?.length ?? 0;
          const diff = DIFFICULTY_META[lvl.difficulty];

          return (
            <div
              key={lvl.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0D1322] p-6 transition-colors hover:border-slate-700"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono-num">Level {String(idx + 1).padStart(2, '0')}</span>
                      <span aria-hidden="true">·</span>
                      <span style={{ color: diff.color }} className="font-semibold">
                        {lvl.difficulty}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num text-amber-400">{lvl.stars}★</span>
                    </div>
                    <h2 className="mt-1.5 font-display text-xl font-bold text-white">
                      {lvl.name}
                    </h2>
                  </div>

                  {prog?.completed && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>100%</span>
                    </span>
                  )}
                </div>

                <p className="mt-2.5 text-sm text-slate-400 leading-relaxed min-h-[42px]">
                  {lvl.description}
                </p>

                {/* Progress Bars */}
                <div className="mt-5 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">Normal Mode</span>
                      <span className="font-mono-num font-semibold text-cyan-400">{normalPct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full bg-cyan-400 transition-all duration-300"
                        style={{ width: `${normalPct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">Practice Mode</span>
                      <span className="font-mono-num font-semibold text-emerald-400">{practicePct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${practicePct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Metadata footer line (no pills) */}
                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num">{lvl.bpm} BPM</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">{prog?.attempts ?? 0} lần thử</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-300 font-mono-num">
                    <Coins className="h-3.5 w-3.5" />
                    <span>{coinsCount}/3</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onPlayLevel(lvl, false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-4 w-4 fill-slate-950" />
                  <span>Chơi ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPlayLevel(lvl, true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Flag className="h-4 w-4" />
                  <span>Practice</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
