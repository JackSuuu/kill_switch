import React, { useState } from 'react';
import './styles/global.css';
import './styles/layout.css';
import PomodoroTimer from './components/PomodoroTimer';
import CountUpTimer from './components/CountUpTimer';
import QuoteTicker from './components/QuoteTicker';
import RobotMascot from './components/RobotMascot';
import HistoryPanel from './components/HistoryPanel';
import {
  loadStorage,
  saveStorage,
  ensureDailyReset,
  type AppStorage,
} from './hooks/useStorage';

type Tab = 'pomodoro' | 'chrono' | 'logs';

function App() {
  const [tab, setTab] = useState<Tab>('pomodoro');
  const [storage, setStorage] = useState<AppStorage>(() =>
    ensureDailyReset(loadStorage())
  );

  const handleStorageUpdate = (s: AppStorage) => {
    setStorage(s);
  };

  const handleClearHistory = () => {
    const cleared: AppStorage = {
      sessions: [],
      todayPomodoros: 0,
      lastResetDate: new Date().toISOString().slice(0, 10),
      totalFocusSeconds: 0,
    };
    saveStorage(cleared);
    setStorage(cleared);
  };

  const isTimer = tab === 'pomodoro' || tab === 'chrono';

  return (
    <div className="app-root">
      {/* ── TOP HEADER ── */}
      <header className="app-header pip-panel">
        <span className="screw-bl">✦</span>
        <span className="screw-br">✦</span>
        <div className="header-left">
          <span className="app-title glow-green">KILL_SWITCH</span>
          <span className="app-subtitle">PRODUCTIVITY SYSTEM v2.7</span>
        </div>
        <div className="header-center">
          <div className="tab-bar">
            <button
              className={`tab-btn ${tab === 'pomodoro' ? 'active' : ''}`}
              onClick={() => setTab('pomodoro')}
            >
              ◉ POMODORO
            </button>
            <button
              className={`tab-btn ${tab === 'chrono' ? 'active' : ''}`}
              onClick={() => setTab('chrono')}
            >
              ▷ CHRONO
            </button>
            <button
              className={`tab-btn ${tab === 'logs' ? 'active' : ''}`}
              onClick={() => setTab('logs')}
            >
              ≡ LOGS
            </button>
          </div>
        </div>
        <div className="header-right">
          <LiveClock />
        </div>
      </header>

      {/* ── MAIN: timer tabs (full width, both kept mounted) ── */}
      {isTimer && (
        <main className="app-main app-main--solo">
          <section className="col-timer">
            <div style={{ display: tab === 'pomodoro' ? 'contents' : 'none' }}>
              <PomodoroTimer storage={storage} onStorageUpdate={handleStorageUpdate} />
            </div>
            <div style={{ display: tab === 'chrono' ? 'contents' : 'none' }}>
              <CountUpTimer storage={storage} onStorageUpdate={handleStorageUpdate} />
            </div>
          </section>
        </main>
      )}

      {/* ── LOGS tab ── */}
      {tab === 'logs' && (
        <main className="app-main app-main--logs">
          <aside className="col-aside col-aside--full">
            <div className="pip-panel mascot-wrapper">
              <span className="screw-bl">✦</span>
              <span className="screw-br">✦</span>
              <RobotMascot mood="idle" />
            </div>
            <HistoryPanel storage={storage} onClear={handleClearHistory} />
          </aside>
          <footer className="logs-quote">
            <QuoteTicker />
          </footer>
        </main>
      )}
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');
  const ss = String(time.getSeconds()).padStart(2, '0');
  return (
    <span className="seg-display glow-green" style={{ fontSize: '30px' }}>
      {hh}:{mm}:{ss}
    </span>
  );
}

export default App;
