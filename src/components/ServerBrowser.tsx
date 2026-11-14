import React, { useEffect, useState } from 'react';
import {
  Copy,
  Flag,
  Heart,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Send,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import { DIFFICULTY_META } from '../game/constants';
import {
  checkUserLikedLevel,
  fetchLeaderboard,
  fetchLevelComments,
  fetchServerLevels,
  postLevelComment,
  toggleLikeServerLevel,
} from '../services/firebaseService';
import {
  Difficulty,
  LevelData,
  PlayerLevelProgress,
  PlayerPublicProfile,
  ServerLevelComment,
} from '../types/game';

interface ServerBrowserProps {
  featuredLevels: LevelData[];
  uid: string | null;
  displayName: string;
  progressMap: Record<string, PlayerLevelProgress>;
  onPlayLevel: (level: LevelData, practice: boolean) => void;
  onCloneToEditor: (level: LevelData) => void;
  onSignIn: () => void;
}

export const ServerBrowser: React.FC<ServerBrowserProps> = ({
  featuredLevels,
  uid,
  displayName,
  progressMap,
  onPlayLevel,
  onCloneToEditor,
  onSignIn,
}) => {
  const [subTab, setSubTab] = useState<'levels' | 'leaderboard'>('levels');
  const [levels, setLevels] = useState<LevelData[]>(featuredLevels);
  const [leaderboard, setLeaderboard] = useState<PlayerPublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [diffFilter, setDiffFilter] = useState<'All' | Difficulty>('All');
  const [sortBy, setSortBy] = useState<'likes' | 'plays' | 'stars'>('likes');

  const [selectedLevel, setSelectedLevel] = useState<LevelData | null>(null);
  const [comments, setComments] = useState<ServerLevelComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [likedByMe, setLikedByMe] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [srvLvls, lb] = await Promise.all([fetchServerLevels(), fetchLeaderboard()]);
      const combined = [...srvLvls];
      for (const f of featuredLevels) {
        if (!combined.some((l) => l.id === f.id)) {
          combined.push(f);
        }
      }
      setLevels(combined);
      setLeaderboard(lb);
    } catch {
      setLevels(featuredLevels);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openLevelDetails = async (lvl: LevelData) => {
    setSelectedLevel(lvl);
    setComments([]);
    setLikedByMe(false);
    const isFeaturedStatic = featuredLevels.some((f) => f.id === lvl.id && !lvl.authorUid);
    if (isFeaturedStatic) return;

    try {
      const [cmts, liked] = await Promise.all([
        fetchLevelComments(lvl.id),
        uid ? checkUserLikedLevel(lvl.id, uid) : Promise.resolve(false),
      ]);
      setComments(cmts);
      setLikedByMe(liked);
    } catch {
      // Ignore read errors on offline featured items
    }
  };

  const handleLike = async () => {
    if (!selectedLevel) return;
    if (!uid) {
      onSignIn();
      return;
    }
    const isStaticShowcase = featuredLevels.some((f) => f.id === selectedLevel.id && !selectedLevel.authorUid);
    if (isStaticShowcase) return;

    try {
      const res = await toggleLikeServerLevel(selectedLevel.id, uid);
      setLikedByMe(res.liked);
      setSelectedLevel((prev) => (prev ? { ...prev, likes: res.likes } : null));
      setLevels((prev) => prev.map((l) => (l.id === selectedLevel.id ? { ...l, likes: res.likes } : l)));
    } catch {
      // Error logged in service
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLevel || !commentText.trim()) return;
    if (!uid) {
      onSignIn();
      return;
    }
    setCommentBusy(true);
    try {
      const pct = progressMap[selectedLevel.id]?.normalPercent ?? 0;
      const newComment = await postLevelComment({
        levelId: selectedLevel.id,
        authorUid: uid,
        authorName: displayName,
        text: commentText.trim(),
        percent: pct,
      });
      setComments((prev) => [newComment, ...prev]);
      setCommentText('');
    } finally {
      setCommentBusy(false);
    }
  };

  const filteredLevels = levels
    .filter((l) => {
      if (diffFilter !== 'All' && l.difficulty !== diffFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return l.name.toLowerCase().includes(q) || l.authorName.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
      if (sortBy === 'plays') return (b.plays || 0) - (a.plays || 0);
      return b.stars - a.stars;
    });

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      {/* Header & Sub-tabs */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Online Server & Bảng xếp hạng</h1>
          <p className="mt-1 text-sm text-slate-400">
            Khám phá màn chơi do cộng đồng sáng tạo, thả tim, bình luận và đua top Stars toàn cầu.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-slate-900 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab('levels')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'levels' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Community Levels
          </button>
          <button
            type="button"
            onClick={() => setSubTab('leaderboard')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'leaderboard' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Top Players
          </button>
          <button
            type="button"
            onClick={loadData}
            title="Làm mới dữ liệu"
            className="rounded-lg p-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {subTab === 'levels' ? (
        <div className="mt-6 space-y-6">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên màn chơi hoặc tác giả..."
                className="w-full rounded-xl border border-slate-800 bg-[#0D1322] pl-10 pr-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Demon'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiffFilter(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    diffFilter === d
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {d}
                </button>
              ))}

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'likes' | 'plays' | 'stars')}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 cursor-pointer"
              >
                <option value="likes">Nhiều Tim nhất</option>
                <option value="plays">Nhiều Lượt chơi</option>
                <option value="stars">Nhiều Sao nhất</option>
              </select>
            </div>
          </div>

          {/* Levels Grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredLevels.map((lvl) => {
              const diff = DIFFICULTY_META[lvl.difficulty];
              const prog = progressMap[lvl.id];
              return (
                <div
                  key={lvl.id}
                  onClick={() => openLevelDetails(lvl)}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0D1322] p-5 hover:border-cyan-500/40 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span style={{ color: diff.color }} className="font-semibold">
                            {lvl.difficulty}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num text-amber-400">{lvl.stars}★</span>
                          <span aria-hidden="true">·</span>
                          <span>by {lvl.authorName}</span>
                        </div>
                        <h3 className="mt-1 font-display text-lg font-bold text-white">{lvl.name}</h3>
                      </div>
                      {prog?.normalPercent ? (
                        <span className="font-mono-num text-xs font-semibold text-cyan-400">
                          {prog.normalPercent}%
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                      {lvl.description || 'Community Geometry Dash level.'}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                    <div className="flex items-center gap-3 font-mono-num">
                      <span className="inline-flex items-center gap-1">
                        <Play className="h-3.5 w-3.5 text-slate-400" />
                        {lvl.plays ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1 text-rose-400">
                        <Heart className="h-3.5 w-3.5" />
                        {lvl.likes ?? 0}
                      </span>
                      <span>{lvl.objects.length} obj</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayLevel(lvl, false);
                      }}
                      className="rounded-lg bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                    >
                      Chơi
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Leaderboard Table */
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-[#0D1322]">
          <div className="grid grid-cols-12 border-b border-slate-800 bg-slate-900/60 px-6 py-3 text-xs font-semibold text-slate-400">
            <div className="col-span-2">Hạng</div>
            <div className="col-span-4">Người chơi</div>
            <div className="col-span-2 text-right">Stars</div>
            <div className="col-span-2 text-right">Coins</div>
            <div className="col-span-2 text-right">Hoàn thành</div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              Chưa có dữ liệu bảng xếp hạng. Hãy đăng nhập Google và hoàn thành màn chơi đầu tiên!
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {leaderboard.map((p, idx) => (
                <div key={p.uid} className="grid grid-cols-12 items-center px-6 py-3.5 text-sm">
                  <div className="col-span-2 font-mono-num font-bold text-slate-300">
                    {idx === 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Trophy className="h-4 w-4" /> #1
                      </span>
                    ) : (
                      `#${idx + 1}`
                    )}
                  </div>
                  <div className="col-span-4 font-semibold text-white truncate">{p.displayName}</div>
                  <div className="col-span-2 text-right font-mono-num text-amber-400">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400" />
                      {p.stars}
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-mono-num text-yellow-300">{p.coins}</div>
                  <div className="col-span-2 text-right font-mono-num text-cyan-400">{p.completedCount}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Level Detail Modal */}
      {selectedLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0D1322] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span style={{ color: DIFFICULTY_META[selectedLevel.difficulty].color }} className="font-semibold">
                    {selectedLevel.difficulty}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-amber-400">{selectedLevel.stars}★</span>
                  <span aria-hidden="true">·</span>
                  <span>Tác giả: {selectedLevel.authorName}</span>
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold text-white">{selectedLevel.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLevel(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              {selectedLevel.description || 'Màn chơi cộng đồng được tạo trên DashForge.'}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const lvl = selectedLevel;
                  setSelectedLevel(null);
                  onPlayLevel(lvl, false);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                <span>Chơi Normal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const lvl = selectedLevel;
                  setSelectedLevel(null);
                  onPlayLevel(lvl, true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-slate-800 cursor-pointer"
              >
                <Flag className="h-4 w-4" />
                <span>Practice</span>
              </button>

              <button
                type="button"
                onClick={handleLike}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium cursor-pointer ${
                  likedByMe
                    ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Heart className={`h-4 w-4 ${likedByMe ? 'fill-rose-400' : ''}`} />
                <span className="font-mono-num">{selectedLevel.likes ?? 0}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const lvl = selectedLevel;
                  setSelectedLevel(null);
                  onCloneToEditor(lvl);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                <Copy className="h-4 w-4" />
                <span>Sao chép vào Editor</span>
              </button>
            </div>

            {/* Comments Section */}
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquare className="h-4 w-4 text-cyan-400" />
                <span>Bình luận ({comments.length})</span>
              </div>

              {selectedLevel.authorUid && (
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input
                    type="text"
                    maxLength={200}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={uid ? 'Viết bình luận về màn chơi...' : 'Đăng nhập Google để bình luận...'}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={commentBusy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Gửi</span>
                  </button>
                </form>
              )}

              <div className="space-y-2.5 max-h-56 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có bình luận nào cho màn chơi này.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.commentId} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{c.authorName}</span>
                        <span className="font-mono-num text-cyan-400">{c.percent}%</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
