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

const FOCUS_DURATION = 25 * 60;   // 25 minutes
const BREAK_DURATION = 10 * 60;   // 10 minutes

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
  const [phase, setPhase] = useState<Phase>('focus');
  const [status, setStatus] = useState<Status>('idle');
  const [remaining, setRemaining] = useState(FOCUS_DURATION);
  const [sessionCount, setSessionCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { beep, beepDone } = useBeep();

  const total = phase === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
  const progress = 1 - remaining / total;

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
      setRemaining(nextPhase === 'focus' ? FOCUS_DURATION : BREAK_DURATION);
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
    setRemaining(phase === 'focus' ? FOCUS_DURATION : BREAK_DURATION);
    tauriInvoke('update_tray_title', { text: '☢' });
  };

  const handleSkip = () => {
    clearTick();
    const next: Phase = phase === 'focus' ? 'break' : 'focus';
    setPhase(next);
    setRemaining(next === 'focus' ? FOCUS_DURATION : BREAK_DURATION);
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
      </div>

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
        {status === 'idle' && (
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
