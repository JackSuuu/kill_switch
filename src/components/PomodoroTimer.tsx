import React, { useState, useEffect, useRef, useCallback } from 'react';
import AnalogDial from './AnalogDial';
import {
  formatMMSS,
  useBeep,
  addSession,
  loadStorage,
  ensureDailyReset,
  type AppStorage,
} from '../hooks/useStorage';
import { tauriInvoke } from '../hooks/useTauri';

const SETTINGS_KEY = 'kill_switch_pomodoro_settings';

interface PomodoroSettings {
  focusMinutes: number;
  breakMinutes: number;
}

function loadSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as PomodoroSettings;
  } catch {}
  return { focusMinutes: 25, breakMinutes: 10 };
}

function saveSettings(s: PomodoroSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

interface PomodoroTimerProps {
  storage: AppStorage;
  onStorageUpdate: (s: AppStorage) => void;
}

type Phase = 'focus' | 'break';
type Status = 'idle' | 'running' | 'paused' | 'done';

const PHASE_LABEL: Record<Phase, string> = {
  focus: '// FOCUS SEQUENCE //',
  break: '// REST CYCLE //',
};

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ storage, onStorageUpdate }) => {
  const [settings, setSettings] = useState<PomodoroSettings>(loadSettings);
  const [editingSettings, setEditingSettings] = useState(false);
  const [draftFocus, setDraftFocus] = useState(String(settings.focusMinutes));
  const [draftBreak, setDraftBreak] = useState(String(settings.breakMinutes));

  const focusDuration = settings.focusMinutes * 60;
  const breakDuration = settings.breakMinutes * 60;

  const [phase, setPhase] = useState<Phase>('focus');
  const [status, setStatus] = useState<Status>('idle');
  const [remaining, setRemaining] = useState(focusDuration);
  const [sessionCount, setSessionCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { beep, beepDone } = useBeep();

  const total = phase === 'focus' ? focusDuration : breakDuration;
  const progress = 1 - remaining / total;

  // Apply new settings (only when idle)
  const applySettings = () => {
    const fm = Math.max(1, Math.min(99, parseInt(draftFocus) || 25));
    const bm = Math.max(1, Math.min(99, parseInt(draftBreak) || 10));
    const next: PomodoroSettings = { focusMinutes: fm, breakMinutes: bm };
    setSettings(next);
    saveSettings(next);
    setDraftFocus(String(fm));
    setDraftBreak(String(bm));
    setRemaining(phase === 'focus' ? fm * 60 : bm * 60);
    setEditingSettings(false);
  };

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleDone = useCallback(() => {
    clearTick();
    beepDone();
    setStatus('done');

    // ── macOS notification ──────────────────────────────────────
    if (phase === 'focus') {
      tauriInvoke('notify_focus_done');
    } else {
      tauriInvoke('notify_break_done');
    }
    // Reset tray title to idle icon after completion
    tauriInvoke('update_tray_title', { text: '☢' });

    // Save session record
    const fresh = ensureDailyReset(loadStorage());
    const updated = addSession(fresh, {
      date: new Date().toISOString().slice(0, 10),
      type: 'pomodoro',
      phase,
      durationSeconds: total,
    });
    onStorageUpdate(updated);

    if (phase === 'focus') {
      setSessionCount(c => c + 1);
    }

    // Auto-advance after 2s
    setTimeout(() => {
      const nextPhase: Phase = phase === 'focus' ? 'break' : 'focus';
      setPhase(nextPhase);
      setRemaining(nextPhase === 'focus' ? focusDuration : breakDuration);
      setStatus('idle');
    }, 2000);
  }, [phase, total, beepDone, onStorageUpdate]);

  useEffect(() => {
    if (status !== 'running') return;
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          handleDone();
          return 0;
        }
        if (r <= 6) beep(440, 0.1, 0.2); // warning beeps
        const next = r - 1;
        // Update tray title with live countdown
        const icon = phase === 'focus' ? '☢' : '◌';
        tauriInvoke('update_tray_title', { text: `${icon} ${formatMMSS(next)}` });
        return next;
      });
    }, 1000);
    return clearTick;
  }, [status, handleDone, beep, phase]);

  const handleStart = () => {
    if (status === 'idle' || status === 'paused') {
      beep(660, 0.1, 0.2);
      setStatus('running');
    }
  };

  const handlePause = () => {
    if (status === 'running') {
      beep(440, 0.1, 0.15);
      setStatus('paused');
      clearTick();
      tauriInvoke('update_tray_title', { text: '⏸ ' + formatMMSS(remaining) });
    }
  };

  const handleReset = () => {
    clearTick();
    setStatus('idle');
    setRemaining(phase === 'focus' ? focusDuration : breakDuration);
    tauriInvoke('update_tray_title', { text: '☢' });
  };

  const handleSkip = () => {
    clearTick();
    const next: Phase = phase === 'focus' ? 'break' : 'focus';
    setPhase(next);
    setRemaining(next === 'focus' ? focusDuration : breakDuration);
    setStatus('idle');
    tauriInvoke('update_tray_title', { text: '☢' });
  };

  const dialColor = phase === 'focus' ? 'green' : 'amber';
  const isDone = status === 'done';

  return (
    <div className="pip-panel pomodoro-panel">
      <span className="screw-bl">✦</span>
      <span className="screw-br">✦</span>

      {/* Header */}
      <div className="pomodoro-header">
        <span className={`phase-label ${phase === 'focus' ? 'glow-green' : 'glow-amber'}`}>
          {PHASE_LABEL[phase]}
        </span>
        <div className="session-badges">
          {Array.from({ length: Math.max(sessionCount, 4) }, (_, i) => (
            <span
              key={i}
              className={`session-dot ${i < sessionCount ? 'filled' : ''}`}
            />
          ))}
          <span className="session-count">&nbsp;×{storage.todayPomodoros} TODAY</span>
        </div>
      </div>

      {/* Dial + Time */}
      <div className="pomodoro-center">
        <div className="dial-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
          <AnalogDial
            progress={progress}
            size={240}
            color={dialColor}
            label={isDone ? '✓ DONE' : formatMMSS(remaining)}
            sublabel={phase === 'focus' ? 'FOCUS' : 'BREAK'}
          />
          {isDone && (
            <div className="done-flash" />
          )}
        </div>
      </div>

      {/* Phase indicator bar */}
      <div className="phase-bar">
        <div
          className={`phase-bar-fill ${dialColor}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="pomodoro-controls">
        {(status === 'idle' || status === 'paused') && (
          <button className="pip-btn" onClick={handleStart}>
            {status === 'paused' ? '▶ RESUME' : '▶ START'}
          </button>
        )}
        {status === 'running' && (
          <button className="pip-btn amber" onClick={handlePause}>
            ⏸ PAUSE
          </button>
        )}
        <button className="pip-btn danger" onClick={handleReset}>
          ↺ RESET
        </button>
        <button className="pip-btn" onClick={handleSkip} style={{ opacity: 0.7 }}>
          ⏭ SKIP
        </button>
        {status === 'idle' && !editingSettings && (
          <button
            className="pip-btn"
            onClick={() => { setDraftFocus(String(settings.focusMinutes)); setDraftBreak(String(settings.breakMinutes)); setEditingSettings(true); }}
            style={{ opacity: 0.6 }}
            title="Configure durations"
          >
            ⚙ SET
          </button>
        )}
      </div>

      {/* Inline settings editor — only when idle */}
      {editingSettings && status === 'idle' && (
        <div className="pomodoro-settings">
          <div className="settings-row">
            <label className="settings-label">FOCUS</label>
            <input
              className="settings-input"
              type="number"
              min={1}
              max={99}
              value={draftFocus}
              onChange={e => setDraftFocus(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySettings()}
            />
            <span className="settings-unit">MIN</span>

            <label className="settings-label" style={{ marginLeft: '1.2rem' }}>BREAK</label>
            <input
              className="settings-input"
              type="number"
              min={1}
              max={99}
              value={draftBreak}
              onChange={e => setDraftBreak(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySettings()}
            />
            <span className="settings-unit">MIN</span>
          </div>
          <div className="settings-actions">
            <button className="pip-btn" onClick={applySettings}>✓ APPLY</button>
            <button className="pip-btn danger" onClick={() => setEditingSettings(false)}>✕ CANCEL</button>
          </div>
        </div>
      )}

      {/* Status message */}
      <div className="pomodoro-status">
        {status === 'running' && (
          <span className={`status-text ${phase === 'focus' ? 'glow-green' : 'glow-amber'}`}>
            ● ACTIVE
          </span>
        )}
        {status === 'paused' && (
          <span className="status-text glow-amber" style={{ animation: 'blink 1.2s infinite' }}>
            ⏸ PAUSED
          </span>
        )}
        {status === 'idle' && !editingSettings && (
          <span className="status-text" style={{ opacity: 0.4 }}>
            ○ STANDBY
          </span>
        )}
        {isDone && (
          <span className="status-text glow-green" style={{ animation: 'pulse-glow 0.8s infinite' }}>
            ✓ SEQUENCE COMPLETE
          </span>
        )}
      </div>
    </div>
  );
};

export default PomodoroTimer;
