import { useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────
export type PomodoroPhase = 'focus' | 'break';

export interface SessionRecord {
  id: string;
  date: string;        // ISO date string
  type: 'pomodoro' | 'countup';
  phase?: PomodoroPhase;
  durationSeconds: number;
  completedAt: string; // ISO datetime
}

export interface AppStorage {
  sessions: SessionRecord[];
  todayPomodoros: number;
  lastResetDate: string; // YYYY-MM-DD
  totalFocusSeconds: number;
}

const STORAGE_KEY = 'kill_switch_v1';

// ─── Helpers ─────────────────────────────────────────────────────
export function loadStorage(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppStorage;
  } catch {}
  return {
    sessions: [],
    todayPomodoros: 0,
    lastResetDate: todayStr(),
    totalFocusSeconds: 0,
  };
}

export function saveStorage(data: AppStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ensureDailyReset(data: AppStorage): AppStorage {
  const today = todayStr();
  if (data.lastResetDate !== today) {
    return { ...data, todayPomodoros: 0, lastResetDate: today };
  }
  return data;
}

export function addSession(
  data: AppStorage,
  record: Omit<SessionRecord, 'id' | 'completedAt'>
): AppStorage {
  const newRecord: SessionRecord = {
    ...record,
    id: crypto.randomUUID(),
    completedAt: new Date().toISOString(),
  };
  const updated: AppStorage = {
    ...data,
    sessions: [newRecord, ...data.sessions].slice(0, 200), // keep last 200
    todayPomodoros:
      record.type === 'pomodoro' && record.phase === 'focus'
        ? data.todayPomodoros + 1
        : data.todayPomodoros,
    totalFocusSeconds:
      record.type === 'pomodoro' && record.phase === 'focus'
        ? data.totalFocusSeconds + record.durationSeconds
        : record.type === 'countup'
        ? data.totalFocusSeconds + record.durationSeconds
        : data.totalFocusSeconds,
  };
  saveStorage(updated);
  return updated;
}

// ─── Web Audio Beep ──────────────────────────────────────────────
export function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);

  const beep = useCallback((freq = 880, duration = 0.3, volume = 0.3) => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, []);

  const beepDone = useCallback(() => {
    beep(660, 0.15, 0.25);
    setTimeout(() => beep(880, 0.15, 0.25), 180);
    setTimeout(() => beep(1100, 0.3, 0.3), 360);
  }, [beep]);

  return { beep, beepDone };
}

// ─── Format helpers ──────────────────────────────────────────────
export function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatHHMMSS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
