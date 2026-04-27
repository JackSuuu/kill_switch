import React from 'react';
import { type AppStorage, formatHHMMSS } from '../hooks/useStorage';

interface HistoryPanelProps {
  storage: AppStorage;
  onClear: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ storage, onClear }) => {
  const todaySessions = storage.sessions.filter(
    s => s.date === new Date().toISOString().slice(0, 10)
  );

  const totalHours = Math.floor(storage.totalFocusSeconds / 3600);
  const totalMins  = Math.floor((storage.totalFocusSeconds % 3600) / 60);

  return (
    <div className="pip-panel history-panel">
      <span className="screw-bl">✦</span>
      <span className="screw-br">✦</span>

      <div className="history-header">
        <span className="phase-label glow-green">// SESSION LOG //</span>
        <button
          className="pip-btn danger"
          onClick={onClear}
          style={{ fontSize: '10px', padding: '3px 10px' }}
        >
          PURGE
        </button>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value glow-green">{storage.todayPomodoros}</div>
          <div className="stat-label">POMODOROS TODAY</div>
        </div>
        <div className="stat-card">
          <div className="stat-value glow-amber">
            {totalHours}h {totalMins}m
          </div>
          <div className="stat-label">TOTAL FOCUS</div>
        </div>
        <div className="stat-card">
          <div className="stat-value glow-green">{storage.sessions.length}</div>
          <div className="stat-label">ALL SESSIONS</div>
        </div>
      </div>

      {/* Session list */}
      <div className="session-list">
        {todaySessions.length === 0 && (
          <div className="empty-log">
            <span style={{ opacity: 0.35 }}>NO RECORDS. BEGIN SEQUENCE.</span>
          </div>
        )}
        {todaySessions.slice(0, 8).map(s => (
          <div key={s.id} className="session-row">
            <span
              className={
                s.type === 'pomodoro' && s.phase === 'focus'
                  ? 'glow-green'
                  : s.type === 'pomodoro'
                  ? 'glow-amber'
                  : ''
              }
            >
              {s.type === 'pomodoro'
                ? s.phase === 'focus' ? '● FOCUS' : '◌ BREAK'
                : '▷ CHRONO'}
            </span>
            <span>{formatHHMMSS(s.durationSeconds)}</span>
            <span style={{ opacity: 0.45, fontSize: '11px' }}>
              {new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;
