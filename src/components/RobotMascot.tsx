import React from 'react';

const RobotMascot: React.FC<{ mood?: 'idle' | 'focus' | 'break' | 'done' }> = ({ mood = 'idle' }) => {
  const expressions: Record<string, { eyes: string; mouth: string; label: string; color: string }> = {
    idle:  { eyes: '◉ ◉', mouth: '―――', label: 'UNIT-K ONLINE',    color: '#7fff5f' },
    focus: { eyes: '▣ ▣', mouth: '▬▬▬', label: 'PROCESSING...',   color: '#7fff5f' },
    break: { eyes: '◕ ◕', mouth: '⌣⌣⌣', label: 'REST MODE',       color: '#ffb830' },
    done:  { eyes: '★ ★', mouth: '◡◡◡', label: 'TASK COMPLETE!',  color: '#7fff5f' },
  };

  const expr = expressions[mood];

  return (
    <div className="robot-mascot" style={{ color: expr.color }}>
      <div className="robot-ascii" style={{ textShadow: `0 0 8px ${expr.color}88` }}>
        <pre>{`
 ╔═══════╗
 ║ ${expr.eyes} ║
 ║  ${expr.mouth}  ║
 ╚══╤═╤══╝
    │ │
  ╔═╧═╧═╗
  ║  K  ║
  ╚═════╝`}
        </pre>
      </div>
      <div
        className="robot-label"
        style={{
          color: expr.color,
          textShadow: `0 0 6px ${expr.color}88`,
          animation: mood === 'focus' ? 'pulse-glow 1.5s infinite' : undefined,
        }}
      >
        {expr.label}
      </div>
    </div>
  );
};

export default RobotMascot;
