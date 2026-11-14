import { signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_ICON_CONFIG, DEFAULT_SETTINGS, SONG_CATALOG } from '../game/constants';
import {
  Difficulty,
  IconConfig,
  LevelData,
  LevelObject,
  PlayerDraftLevel,
  PlayerLevelProgress,
  PlayerPublicProfile,
  PlayerSettings,
  ServerLevelComment,
} from '../types/game';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

function clampObjects(objects: LevelObject[]): LevelObject[] {
  return objects.slice(0, 1500).map((o) => ({
    id: String(o.id).slice(0, 64),
    type: o.type,
    x: Math.round(o.x * 100) / 100,
    y: Math.round(o.y * 100) / 100,
    ...(o.rotation !== undefined ? { rotation: o.rotation } : {}),
    ...(o.color ? { color: String(o.color).slice(0, 16) } : {}),
  }));
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutPlayer(): Promise<void> {
  await signOut(auth);
}

export async function ensurePlayerProfile(user: User): Promise<{
  publicProfile: PlayerPublicProfile;
  settings: PlayerSettings;
}> {
  const uid = user.uid;
  const pubPath = `playersPublic/${uid}`;
  const privPath = `playersPrivate/${uid}`;

  let publicProfile: PlayerPublicProfile | null = null;
  let settings: PlayerSettings = { ...DEFAULT_SETTINGS };

  try {
    const pubSnap = await getDoc(doc(db, 'playersPublic', uid));
    if (pubSnap.exists()) {
      publicProfile = pubSnap.data() as PlayerPublicProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pubPath);
  }

  try {
    const privSnap = await getDoc(doc(db, 'playersPrivate', uid));
    if (privSnap.exists()) {
      const privData = privSnap.data() as { settings?: PlayerSettings };
      if (privData.settings) {
        settings = { ...DEFAULT_SETTINGS, ...privData.settings };
      }
    } else if (user.emailVerified) {
      await setDoc(doc(db, 'playersPrivate', uid), {
        uid,
        email: (user.email || 'player@dashforge.app').slice(0, 254),
        settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privPath);
  }

  if (!publicProfile) {
    const fallbackName = (user.displayName || user.email?.split('@')[0] || 'Dasher').slice(0, 32);
    publicProfile = {
      uid,
      displayName: fallbackName,
      stars: 0,
      coins: 0,
      completedCount: 0,
      totalAttempts: 0,
      totalJumps: 0,
      iconConfig: { ...DEFAULT_ICON_CONFIG },
    };
    if (user.emailVerified) {
      try {
        await setDoc(doc(db, 'playersPublic', uid), {
          ...publicProfile,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, pubPath);
      }
    }
  }

  return { publicProfile, settings };
}

export async function savePlayerPublicProfile(profile: PlayerPublicProfile): Promise<void> {
  const path = `playersPublic/${profile.uid}`;
  try {
    await setDoc(doc(db, 'playersPublic', profile.uid), {
      uid: profile.uid,
      displayName: profile.displayName.trim().slice(0, 32) || 'Dasher',
      stars: Math.max(0, Math.min(100000, Math.floor(profile.stars))),
      coins: Math.max(0, Math.min(10000, Math.floor(profile.coins))),
      completedCount: Math.max(0, Math.min(10000, Math.floor(profile.completedCount))),
      totalAttempts: Math.max(0, Math.min(10000000, Math.floor(profile.totalAttempts))),
      totalJumps: Math.max(0, Math.min(100000000, Math.floor(profile.totalJumps))),
      iconConfig: profile.iconConfig,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function savePlayerSettings(uid: string, email: string, settings: PlayerSettings): Promise<void> {
  const path = `playersPrivate/${uid}`;
  try {
    const existing = await getDoc(doc(db, 'playersPrivate', uid));
    if (!existing.exists()) {
      await setDoc(doc(db, 'playersPrivate', uid), {
        uid,
        email: (email || 'player@dashforge.app').slice(0, 254),
        settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        doc(db, 'playersPrivate', uid),
        {
          uid,
          email: (email || 'player@dashforge.app').slice(0, 254),
          settings,
          createdAt: existing.data().createdAt,
          updatedAt: serverTimestamp(),
        }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadAllPlayerProgress(uid: string): Promise<Record<string, PlayerLevelProgress>> {
  const path = `playersPrivate/${uid}/progress`;
  try {
    const q = query(collection(db, 'playersPrivate', uid, 'progress'), where('uid', '==', uid));
    const snap = await getDocs(q);
    const map: Record<string, PlayerLevelProgress> = {};
    snap.forEach((d) => {
      const data = d.data() as PlayerLevelProgress;
      map[data.levelId] = data;
    });
    return map;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function savePlayerLevelProgress(progress: PlayerLevelProgress): Promise<void> {
  const safeLevelId = sanitizeId(progress.levelId);
  const path = `playersPrivate/${progress.uid}/progress/${safeLevelId}`;
  try {
    await setDoc(doc(db, 'playersPrivate', progress.uid, 'progress', safeLevelId), {
      uid: progress.uid,
      levelId: safeLevelId,
      normalPercent: Math.max(0, Math.min(100, Math.floor(progress.normalPercent))),
      practicePercent: Math.max(0, Math.min(100, Math.floor(progress.practicePercent))),
      attempts: Math.max(0, Math.min(10000000, Math.floor(progress.attempts))),
      coinsCollected: progress.coinsCollected.slice(0, 3).map((c) => Math.floor(c)),
      completed: Boolean(progress.completed),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadPlayerDrafts(uid: string): Promise<PlayerDraftLevel[]> {
  const path = `playersPrivate/${uid}/drafts`;
  try {
    const q = query(
      collection(db, 'playersPrivate', uid, 'drafts'),
      where('uid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PlayerDraftLevel);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function savePlayerDraft(draft: Omit<PlayerDraftLevel, 'createdAt' | 'updatedAt'>): Promise<void> {
  const safeDraftId = sanitizeId(draft.draftId);
  const path = `playersPrivate/${draft.uid}/drafts/${safeDraftId}`;
  try {
    const ref = doc(db, 'playersPrivate', draft.uid, 'drafts', safeDraftId);
    const existing = await getDoc(ref);
    const payload = {
      uid: draft.uid,
      draftId: safeDraftId,
      name: draft.name.trim().slice(0, 40) || 'Untitled Level',
      songId: draft.songId.slice(0, 32),
      bgColor: draft.bgColor.slice(0, 16),
      groundColor: draft.groundColor.slice(0, 16),
      startMode: draft.startMode,
      startSpeed: draft.startSpeed,
      startGravity: draft.startGravity,
      objects: clampObjects(draft.objects),
      verified: Boolean(draft.verified),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePlayerDraft(uid: string, draftId: string): Promise<void> {
  const safeId = sanitizeId(draftId);
  const path = `playersPrivate/${uid}/drafts/${safeId}`;
  try {
    await deleteDoc(doc(db, 'playersPrivate', uid, 'drafts', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function publishLevelToServer(params: {
  levelId?: string;
  authorUid: string;
  authorName: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  stars: number;
  songId: string;
  bgColor: string;
  groundColor: string;
  startMode: LevelData['startMode'];
  startSpeed: LevelData['startSpeed'];
  startGravity: 1 | -1;
  objects: LevelObject[];
  verified: boolean;
}): Promise<string> {
  const levelId = sanitizeId(params.levelId || `lvl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `serverLevels/${levelId}`;
  const cleanObjects = clampObjects(params.objects);
  if (cleanObjects.length === 0) {
    throw new Error('Level must contain at least 1 object before publishing.');
  }

  try {
    const ref = doc(db, 'serverLevels', levelId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const data = existing.data();
      await setDoc(ref, {
        levelId,
        authorUid: data.authorUid,
        authorName: params.authorName.trim().slice(0, 32) || 'Dasher',
        name: params.name.trim().slice(0, 40) || 'Custom Level',
        description: params.description.trim().slice(0, 160),
        difficulty: params.difficulty,
        stars: Math.max(1, Math.min(10, Math.floor(params.stars))),
        songId: params.songId.slice(0, 32),
        bgColor: params.bgColor.slice(0, 16),
        groundColor: params.groundColor.slice(0, 16),
        startMode: params.startMode,
        startSpeed: params.startSpeed,
        startGravity: params.startGravity,
        objects: cleanObjects,
        plays: data.plays ?? 0,
        likes: data.likes ?? 0,
        verified: true,
        createdAt: data.createdAt,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        levelId,
        authorUid: params.authorUid,
        authorName: params.authorName.trim().slice(0, 32) || 'Dasher',
        name: params.name.trim().slice(0, 40) || 'Custom Level',
        description: params.description.trim().slice(0, 160),
        difficulty: params.difficulty,
        stars: Math.max(1, Math.min(10, Math.floor(params.stars))),
        songId: params.songId.slice(0, 32),
        bgColor: params.bgColor.slice(0, 16),
        groundColor: params.groundColor.slice(0, 16),
        startMode: params.startMode,
        startSpeed: params.startSpeed,
        startGravity: params.startGravity,
        objects: cleanObjects,
        plays: 0,
        likes: 0,
        verified: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return levelId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchServerLevels(): Promise<LevelData[]> {
  const path = 'serverLevels';
  try {
    const q = query(
      collection(db, 'serverLevels'),
      where('verified', '==', true),
      limit(60)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => {
      const raw = d.data();
      const song = SONG_CATALOG.find((s) => s.id === raw.songId) || SONG_CATALOG[0];
      return {
        id: raw.levelId,
        name: raw.name,
        authorName: raw.authorName,
        authorUid: raw.authorUid,
        description: raw.description || '',
        difficulty: raw.difficulty,
        stars: raw.stars,
        songId: raw.songId,
        bpm: song.bpm,
        bgColor: raw.bgColor,
        groundColor: raw.groundColor,
        startMode: raw.startMode,
        startSpeed: raw.startSpeed,
        startGravity: raw.startGravity,
        objects: raw.objects || [],
        isOfficial: false,
        verified: raw.verified,
        plays: raw.plays ?? 0,
        likes: raw.likes ?? 0,
      } as LevelData;
    });
    return results.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function toggleLikeServerLevel(levelId: string, uid: string): Promise<{ liked: boolean; likes: number }> {
  const safeId = sanitizeId(levelId);
  const levelRef = doc(db, 'serverLevels', safeId);
  const likeRef = doc(db, 'serverLevels', safeId, 'likes', uid);
  const path = `serverLevels/${safeId}/likes/${uid}`;

  try {
    const [levelSnap, likeSnap] = await Promise.all([getDoc(levelRef), getDoc(likeRef)]);
    if (!levelSnap.exists()) throw new Error('Level not found on server.');
    const currentLikes = Number(levelSnap.data().likes || 0);
    const batch = writeBatch(db);

    if (likeSnap.exists()) {
      const nextLikes = Math.max(0, currentLikes - 1);
      batch.delete(likeRef);
      batch.update(levelRef, { likes: nextLikes, updatedAt: serverTimestamp() });
      await batch.commit();
      return { liked: false, likes: nextLikes };
    } else {
      const nextLikes = currentLikes + 1;
      batch.set(likeRef, { uid, levelId: safeId, createdAt: serverTimestamp() });
      batch.update(levelRef, { likes: nextLikes, updatedAt: serverTimestamp() });
      await batch.commit();
      return { liked: true, likes: nextLikes };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function checkUserLikedLevel(levelId: string, uid: string): Promise<boolean> {
  const safeId = sanitizeId(levelId);
  const path = `serverLevels/${safeId}/likes/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'serverLevels', safeId, 'likes', uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function incrementServerLevelPlay(levelId: string): Promise<void> {
  const safeId = sanitizeId(levelId);
  const path = `serverLevels/${safeId}`;
  try {
    const ref = doc(db, 'serverLevels', safeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const plays = Number(snap.data().plays || 0);
    await updateDoc(ref, {
      plays: plays + 1,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchLevelComments(levelId: string): Promise<ServerLevelComment[]> {
  const safeId = sanitizeId(levelId);
  const path = `serverLevels/${safeId}/comments`;
  try {
    const q = query(
      collection(db, 'serverLevels', safeId, 'comments'),
      where('levelId', '==', safeId),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ServerLevelComment);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function postLevelComment(params: {
  levelId: string;
  authorUid: string;
  authorName: string;
  text: string;
  percent: number;
}): Promise<ServerLevelComment> {
  const safeLevelId = sanitizeId(params.levelId);
  const commentId = sanitizeId(`cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `serverLevels/${safeLevelId}/comments/${commentId}`;
  const payload = {
    commentId,
    levelId: safeLevelId,
    authorUid: params.authorUid,
    authorName: params.authorName.trim().slice(0, 32) || 'Dasher',
    text: params.text.trim().slice(0, 200),
    percent: Math.max(0, Math.min(100, Math.floor(params.percent))),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'serverLevels', safeLevelId, 'comments', commentId), payload);
    return { ...payload, createdAt: new Date().toISOString() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchLeaderboard(): Promise<PlayerPublicProfile[]> {
  const path = 'playersPublic';
  try {
    const q = query(
      collection(db, 'playersPublic'),
      where('stars', '>=', 0),
      orderBy('stars', 'desc'),
      limit(25)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PlayerPublicProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
