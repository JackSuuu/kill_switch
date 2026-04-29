import React, { useState, useEffect, useRef } from 'react';
import AnalogDial from './AnalogDial';
import {
  formatHHMMSS,
  useBeep,
  addSession,
  loadStorage,
  ensureDailyReset,
  type AppStorage,
} from '../hooks/useStorage';

interface CountUpTimerProps {
  storage: AppStorage;
  onStorageUpdate: (s: AppStorage) => void;
}

const CountUpTimer: React.FC<CountUpTimerProps> = ({ storage, onStorageUpdate }) => {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { beep } = useBeep();

  // Dial: loop every 3600s (1 hour)
  const progress = (elapsed % 3600) / 3600;

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setElapsed(e => e + 1);
    }, 1000);
    return clearTick;
  }, [running]);

  const handleStart = () => {
    beep(660, 0.1, 0.2);
    setRunning(true);
  };

  const handleStop = () => {
    beep(440, 0.1, 0.15);
    setRunning(false);
    clearTick();
  };

  const handleSave = () => {
    if (elapsed === 0) return;
    beep(880, 0.15, 0.25);
    const fresh = ensureDailyReset(loadStorage());
    const updated = addSession(fresh, {
      date: new Date().toISOString().slice(0, 10),
      type: 'countup',
      durationSeconds: elapsed,
    });
    onStorageUpdate(updated);
    handleReset();
  };

  const handleReset = () => {
    clearTick();
    setRunning(false);
    setElapsed(0);
  };

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <div className="pip-panel countup-panel">
      <span className="screw-bl">✦</span>
      <span className="screw-br">✦</span>

      {/* Header */}
      <div className="pomodoro-header">
        <span className="phase-label glow-green">// CHRONO LOGGER //</span>
        <span className="session-count" style={{ opacity: 0.5 }}>
          TOTAL SAVED: {Math.floor(storage.totalFocusSeconds / 60)}m
        </span>
      </div>

      {/* Main display */}
      <div className="pomodoro-center">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <AnalogDial
            progress={progress}
            size={200}
            color="green"
            label={`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`}
            sublabel={hours > 0 ? `+${hours}H` : 'ELAPSED'}
          />
        </div>
      </div>

      {/* Big digit display */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <span
          className="seg-display"
          style={{ fontSize: '48px', letterSpacing: '0.06em' }}
        >
          {formatHHMMSS(elapsed)}
        </span>
      </div>

      {/* Controls */}
      <div className="pomodoro-controls">
        {!running ? (
          <button className="pip-btn" onClick={handleStart}>
            ▶ START
          </button>
        ) : (
          <button className="pip-btn amber" onClick={handleStop}>
            ⏹ STOP
          </button>
        )}
        {!running && elapsed > 0 && (
          <button className="pip-btn" onClick={handleSave}>
            ✦ SAVE
          </button>
        )}
        <button className="pip-btn danger" onClick={handleReset} disabled={elapsed === 0}>
          ↺ RESET
        </button>
      </div>
    </div>
  );
};

export default CountUpTimer;
