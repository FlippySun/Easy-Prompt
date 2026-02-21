import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { ACHIEVEMENTS } from '../data/achievements';

interface PromptStore {
  liked: Set<string>;
  saved: Set<string>;
  copied: Record<string, number>;
  viewed: string[];
  achievements: Set<string>;
  visitedCategories: Set<string>;
}

const STORAGE_KEY = 'prompthub_store';

function loadStore(): PromptStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { liked: new Set(), saved: new Set(), copied: {}, viewed: [], achievements: new Set(), visitedCategories: new Set() };
    const parsed = JSON.parse(raw);
    return {
      liked: new Set(parsed.liked || []),
      saved: new Set(parsed.saved || []),
      copied: parsed.copied || {},
      viewed: parsed.viewed || [],
      achievements: new Set(parsed.achievements || []),
      visitedCategories: new Set(parsed.visitedCategories || []),
    };
  } catch {
    return { liked: new Set(), saved: new Set(), copied: {}, viewed: [], achievements: new Set(), visitedCategories: new Set() };
  }
}

function saveStore(store: PromptStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      liked: [...store.liked],
      saved: [...store.saved],
      copied: store.copied,
      viewed: store.viewed,
      achievements: [...store.achievements],
      visitedCategories: [...store.visitedCategories],
    }));
  } catch {}
}

// Singleton store
let _store = loadStore();
let _compare: string[] = [];
let _listeners: Array<() => void> = [];

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

function checkAndUnlock(achievementId: string) {
  if (_store.achievements.has(achievementId)) return;
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return;

  const newAchievements = new Set(_store.achievements);
  newAchievements.add(achievementId);
  _store = { ..._store, achievements: newAchievements };
  saveStore(_store);
  notifyListeners();

  // Show achievement toast
  toast.success(`${achievement.icon} ${achievement.title}`, {
    description: `🏆 成就解锁！${achievement.description}`,
    duration: 4500,
  });

  // Confetti for rare+ achievements
  if (achievement.rarity === 'legendary') {
    confetti({ particleCount: 180, spread: 90, origin: { y: 0.9, x: 0.15 }, colors: [achievement.color, '#ffffff', '#ffd700', '#ff6b6b'] });
    setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { y: 0.85, x: 0.5 }, colors: ['#a78bfa', '#60a5fa', '#f472b6'] }), 400);
  } else if (achievement.rarity === 'epic') {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.9, x: 0.15 }, colors: [achievement.color, '#ffffff', '#e879f9'] });
  } else if (achievement.rarity === 'rare') {
    confetti({ particleCount: 50, spread: 55, origin: { y: 0.9, x: 0.15 }, colors: [achievement.color, '#ffffff'] });
  }

  // Check for power_user (10+ achievements)
  if (newAchievements.size >= 10 && !newAchievements.has('power_user')) {
    setTimeout(() => checkAndUnlock('power_user'), 1200);
  }
}

function getTotalCopies() {
  return Object.values(_store.copied).reduce((s, n) => s + n, 0);
}

export function usePromptStore() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const fn = () => forceUpdate(n => n + 1);
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }, []);

  const toggleLike = useCallback((id: string) => {
    const isLiked = _store.liked.has(id);
    const newLiked = new Set(_store.liked);
    if (isLiked) newLiked.delete(id);
    else newLiked.add(id);
    _store = { ..._store, liked: newLiked };
    saveStore(_store);
    notifyListeners();

    if (!isLiked) {
      if (newLiked.size >= 1) checkAndUnlock('first_like');
      if (newLiked.size >= 5) checkAndUnlock('like_5');
      if (newLiked.size >= 10) checkAndUnlock('like_10');
    }
  }, []);

  const toggleSave = useCallback((id: string) => {
    const isSaved = _store.saved.has(id);
    const newSaved = new Set(_store.saved);
    if (isSaved) newSaved.delete(id);
    else newSaved.add(id);
    _store = { ..._store, saved: newSaved };
    saveStore(_store);
    notifyListeners();

    if (!isSaved) {
      if (newSaved.size >= 1) checkAndUnlock('first_save');
      if (newSaved.size >= 5) checkAndUnlock('save_5');
      if (newSaved.size >= 10) checkAndUnlock('save_10');
    }
  }, []);

  const recordCopy = useCallback((id: string) => {
    const newCopied = { ..._store.copied, [id]: (_store.copied[id] || 0) + 1 };
    const newViewed = [id, ..._store.viewed.filter(v => v !== id)].slice(0, 50);
    _store = { ..._store, copied: newCopied, viewed: newViewed };
    saveStore(_store);
    notifyListeners();

    const total = getTotalCopies();
    if (total >= 1) checkAndUnlock('first_copy');
    if (total >= 5) checkAndUnlock('copy_5');
    if (total >= 10) checkAndUnlock('copy_10');
    if (total >= 25) checkAndUnlock('copy_25');
  }, []);

  const recordView = useCallback((id: string) => {
    const newViewed = [id, ..._store.viewed.filter(v => v !== id)].slice(0, 50);
    _store = { ..._store, viewed: newViewed };
    saveStore(_store);
    notifyListeners();

    const unique = newViewed.length;
    if (unique >= 1) checkAndUnlock('first_view');
    if (unique >= 10) checkAndUnlock('explorer_10');
    if (unique >= 20) checkAndUnlock('explorer_20');
  }, []);

  const recordCategory = useCallback((cat: string) => {
    if (_store.visitedCategories.has(cat)) return;
    const newCats = new Set(_store.visitedCategories);
    newCats.add(cat);
    _store = { ..._store, visitedCategories: newCats };
    saveStore(_store);
    notifyListeners();
    // 8 non-'all' categories
    if (newCats.size >= 8) checkAndUnlock('all_categories');
  }, []);

  const toggleCompare = useCallback((id: string) => {
    if (_compare.includes(id)) {
      _compare = _compare.filter(c => c !== id);
    } else if (_compare.length < 2) {
      _compare = [..._compare, id];
    }
    notifyListeners();
  }, []);

  const clearCompare = useCallback(() => {
    _compare = [];
    notifyListeners();
  }, []);

  const unlockAchievement = useCallback((id: string) => {
    checkAndUnlock(id);
  }, []);

  return {
    liked: _store.liked,
    saved: _store.saved,
    copied: _store.copied,
    viewed: _store.viewed,
    compare: _compare,
    achievements: _store.achievements,
    visitedCategories: _store.visitedCategories,
    isLiked: (id: string) => _store.liked.has(id),
    isSaved: (id: string) => _store.saved.has(id),
    isInCompare: (id: string) => _compare.includes(id),
    hasAchievement: (id: string) => _store.achievements.has(id),
    getCopyCount: (id: string) => _store.copied[id] || 0,
    toggleLike,
    toggleSave,
    recordCopy,
    recordView,
    recordCategory,
    toggleCompare,
    clearCompare,
    unlockAchievement,
  };
}