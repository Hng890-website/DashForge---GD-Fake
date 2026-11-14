import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { GameCanvasView } from './components/GameCanvasView';
import { IconKit } from './components/IconKit';
import { LevelEditor } from './components/LevelEditor';
import { AppTab, Navbar } from './components/Navbar';
import { OfficialLevelsView } from './components/OfficialLevelsView';
import { ServerBrowser } from './components/ServerBrowser';
import { FEATURED_SERVER_LEVELS, OFFICIAL_LEVELS } from './data/officialLevels';
import { DEFAULT_ICON_CONFIG, DEFAULT_SETTINGS } from './game/constants';
import { auth } from './services/firebase';
import {
  deletePlayerDraft,
  ensurePlayerProfile,
  incrementServerLevelPlay,
  loadAllPlayerProgress,
  loadPlayerDrafts,
  publishLevelToServer,
  savePlayerDraft,
  savePlayerLevelProgress,
  savePlayerPublicProfile,
  savePlayerSettings,
  signInWithGoogle,
  signOutPlayer,
} from './services/firebaseService';
import {
  LevelData,
  PlayerDraftLevel,
  PlayerLevelProgress,
  PlayerPublicProfile,
  PlayerSettings,
} from './types/game';

const LOCAL_PROFILE_KEY = 'dashforge_guest_profile_v1';
const LOCAL_PROGRESS_KEY = 'dashforge_guest_progress_v1';
const LOCAL_DRAFTS_KEY = 'dashforge_guest_drafts_v1';
const LOCAL_SETTINGS_KEY = 'dashforge_guest_settings_v1';

const DEFAULT_GUEST_PROFILE: PlayerPublicProfile = {
  uid: 'guest',
  displayName: 'Guest Dasher',
  stars: 0,
  coins: 0,
  completedCount: 0,
  totalAttempts: 0,
  totalJumps: 0,
  iconConfig: { ...DEFAULT_ICON_CONFIG },
};

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('official');
  const [profile, setProfile] = useState<PlayerPublicProfile>(() =>
    readLocalJson(LOCAL_PROFILE_KEY, DEFAULT_GUEST_PROFILE)
  );
  const [settings, setSettings] = useState<PlayerSettings>(() =>
    readLocalJson(LOCAL_SETTINGS_KEY, DEFAULT_SETTINGS)
  );
  const [progressMap, setProgressMap] = useState<Record<string, PlayerLevelProgress>>(() =>
    readLocalJson(LOCAL_PROGRESS_KEY, {})
  );
  const [drafts, setDrafts] = useState<PlayerDraftLevel[]>(() =>
    readLocalJson(LOCAL_DRAFTS_KEY, [])
  );

  // Active gameplay state
  const [playingConfig, setPlayingConfig] = useState<{
    level: LevelData;
    practice: boolean;
    isPlaytest: boolean;
    onVerified?: () => void;
  } | null>(null);

  // Level cloned from Server into Editor
  const [clonedForEditor, setClonedForEditor] = useState<LevelData | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const [{ publicProfile, settings: loadedSettings }, loadedProgress, loadedDrafts] =
            await Promise.all([
              ensurePlayerProfile(nextUser),
              loadAllPlayerProgress(nextUser.uid),
              loadPlayerDrafts(nextUser.uid),
            ]);
          setProfile(publicProfile);
          setSettings(loadedSettings);
          setProgressMap(loadedProgress);
          setDrafts(loadedDrafts);
        } catch (err) {
          console.error('Error loading player data:', err);
        }
      } else {
        setProfile(readLocalJson(LOCAL_PROFILE_KEY, DEFAULT_GUEST_PROFILE));
        setSettings(readLocalJson(LOCAL_SETTINGS_KEY, DEFAULT_SETTINGS));
        setProgressMap(readLocalJson(LOCAL_PROGRESS_KEY, {}));
        setDrafts(readLocalJson(LOCAL_DRAFTS_KEY, []));
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthLoading(true);
    setGlobalError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutPlayer();
    setPlayingConfig(null);
  }, []);

  const handlePlayLevel = useCallback(
    (level: LevelData, practice: boolean) => {
      setPlayingConfig({ level, practice, isPlaytest: false });
      if (user?.emailVerified && level.authorUid) {
        incrementServerLevelPlay(level.id).catch(() => {});
      }
    },
    [user]
  );

  const handlePlaytest = useCallback((level: LevelData, onVerified: () => void) => {
    setPlayingConfig({ level, practice: false, isPlaytest: true, onVerified });
  }, []);

  const handleProgressReport = useCallback(
    async (stats: {
      levelId: string;
      percent: number;
      isPractice: boolean;
      completed: boolean;
      coins: number[];
      attemptsDelta: number;
      jumpsDelta: number;
    }) => {
      const targetUid = user?.uid || 'guest';
      const existing = progressMap[stats.levelId] || {
        uid: targetUid,
        levelId: stats.levelId,
        normalPercent: 0,
        practicePercent: 0,
        attempts: 0,
        coinsCollected: [],
        completed: false,
      };

      const mergedCoins = Array.from(new Set([...existing.coinsCollected, ...stats.coins])).slice(0, 3);
      const newlyCompleted = !existing.completed && stats.completed;
      const newCoinsDelta = Math.max(0, mergedCoins.length - existing.coinsCollected.length);

      const updatedProgress: PlayerLevelProgress = {
        uid: targetUid,
        levelId: stats.levelId,
        normalPercent: stats.isPractice
          ? existing.normalPercent
          : Math.max(existing.normalPercent, stats.percent),
        practicePercent: stats.isPractice
          ? Math.max(existing.practicePercent, stats.percent)
          : existing.practicePercent,
        attempts: existing.attempts + stats.attemptsDelta,
        coinsCollected: mergedCoins,
        completed: existing.completed || stats.completed,
      };

      const nextMap = { ...progressMap, [stats.levelId]: updatedProgress };
      setProgressMap(nextMap);

      // Find level star value if newly completed
      const levelMeta =
        OFFICIAL_LEVELS.find((l) => l.id === stats.levelId) ||
        FEATURED_SERVER_LEVELS.find((l) => l.id === stats.levelId) ||
        playingConfig?.level;
      const earnedStars = newlyCompleted ? levelMeta?.stars || 2 : 0;

      const updatedProfile: PlayerPublicProfile = {
        ...profile,
        stars: profile.stars + earnedStars,
        coins: profile.coins + newCoinsDelta,
        completedCount: profile.completedCount + (newlyCompleted ? 1 : 0),
        totalAttempts: profile.totalAttempts + stats.attemptsDelta,
        totalJumps: profile.totalJumps + stats.jumpsDelta,
      };
      setProfile(updatedProfile);

      if (user?.emailVerified) {
        try {
          await Promise.all([
            savePlayerLevelProgress(updatedProgress),
            savePlayerPublicProfile(updatedProfile),
          ]);
        } catch (err) {
          console.error('Failed to sync progress:', err);
        }
      } else {
        localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(nextMap));
        localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(updatedProfile));
      }
    },
    [playingConfig?.level, profile, progressMap, user]
  );

  const handleSaveProfileAndSettings = useCallback(
    async (nextProfile: PlayerPublicProfile, nextSettings: PlayerSettings) => {
      setProfile(nextProfile);
      setSettings(nextSettings);
      if (user?.emailVerified) {
        await Promise.all([
          savePlayerPublicProfile(nextProfile),
          savePlayerSettings(user.uid, user.email || '', nextSettings),
        ]);
      } else {
        localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(nextSettings));
      }
    },
    [user]
  );

  const handleSaveDraft = useCallback(
    async (draft: Omit<PlayerDraftLevel, 'createdAt' | 'updatedAt'>) => {
      if (user?.emailVerified) {
        await savePlayerDraft({ ...draft, uid: user.uid });
        const fresh = await loadPlayerDrafts(user.uid);
        setDrafts(fresh);
      } else {
        const nextDrafts = [
          draft as PlayerDraftLevel,
          ...drafts.filter((d) => d.draftId !== draft.draftId),
        ];
        setDrafts(nextDrafts);
        localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(nextDrafts));
      }
    },
    [drafts, user]
  );

  const handleDeleteDraft = useCallback(
    async (draftId: string) => {
      if (user?.emailVerified) {
        await deletePlayerDraft(user.uid, draftId);
        setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
      } else {
        const next = drafts.filter((d) => d.draftId !== draftId);
        setDrafts(next);
        localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(next));
      }
    },
    [drafts, user]
  );

  const handleCloneToEditor = useCallback((lvl: LevelData) => {
    setClonedForEditor(lvl);
    setActiveTab('editor');
  }, []);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070B14] text-slate-300">
        <div className="font-display text-xl tracking-wide">Đang khởi tạo DashForge...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setPlayingConfig(null);
          setActiveTab(tab);
        }}
        profile={profile}
        isSignedIn={Boolean(user)}
        authLoading={authLoading}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {globalError && (
        <div className="mx-auto mt-4 max-w-[1400px] px-6 w-full">
          <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
            <span>{globalError}</span>
            <button type="button" onClick={() => setGlobalError(null)} className="underline cursor-pointer">
              Đóng
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {playingConfig ? (
          <GameCanvasView
            level={playingConfig.level}
            iconConfig={profile.iconConfig}
            settings={settings}
            initialPractice={playingConfig.practice}
            isPlaytest={playingConfig.isPlaytest}
            onExit={() => setPlayingConfig(null)}
            onProgressReport={handleProgressReport}
            onVerifiedComplete={playingConfig.onVerified}
            onUpdateSettings={(next) => handleSaveProfileAndSettings(profile, next)}
          />
        ) : activeTab === 'official' ? (
          <OfficialLevelsView
            levels={OFFICIAL_LEVELS}
            progressMap={progressMap}
            profile={profile}
            isSignedIn={Boolean(user)}
            onPlayLevel={handlePlayLevel}
            onSignIn={handleSignIn}
          />
        ) : activeTab === 'server' ? (
          <ServerBrowser
            featuredLevels={FEATURED_SERVER_LEVELS}
            uid={user?.uid || null}
            displayName={profile.displayName}
            progressMap={progressMap}
            onPlayLevel={handlePlayLevel}
            onCloneToEditor={handleCloneToEditor}
            onSignIn={handleSignIn}
          />
        ) : activeTab === 'editor' ? (
          <LevelEditor
            uid={user?.uid || null}
            displayName={profile.displayName}
            drafts={drafts}
            initialLevel={clonedForEditor}
            onSaveDraft={handleSaveDraft}
            onDeleteDraft={handleDeleteDraft}
            onPublishLevel={publishLevelToServer}
            onPlaytest={handlePlaytest}
            onSignIn={handleSignIn}
          />
        ) : (
          <IconKit
            profile={profile}
            settings={settings}
            isSignedIn={Boolean(user)}
            onSaveProfile={handleSaveProfileAndSettings}
          />
        )}
      </main>
    </div>
  );
}
