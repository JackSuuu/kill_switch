import React from 'react';

interface AnalogDialProps {
  /** 0–1 progress fraction */
  progress: number;
  /** radius in px */
  size?: number;
  color?: 'green' | 'amber' | 'red';
  label?: string;
  sublabel?: string;
}

const COLOR_MAP = {
  green: { stroke: '#7fff5f', glow: '#7fff5f88', dim: '#1e3b18', text: '#7fff5f' },
  amber: { stroke: '#ffb830', glow: '#ffb83088', dim: '#3b2a00', text: '#ffb830' },
  red:   { stroke: '#ff3c3c', glow: '#ff3c3c88', dim: '#3b0000', text: '#ff3c3c' },
};

const AnalogDial: React.FC<AnalogDialProps> = ({
  progress,
  size = 220,
  color = 'green',
  label,
  sublabel,
}) => {
  const c = COLOR_MAP[color];
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) - 18;
  const strokeW = 8;

  // Full circle circumference
  const circum = 2 * Math.PI * R;
  const dashOffset = circum * (1 - Math.max(0, Math.min(1, progress)));

  // Tick marks
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
    const major = i % 5 === 0;
    const inner = major ? R - 16 : R - 10;
    const outer = R - 4;
    return {
      x1: cx + inner * Math.cos(angle),
      y1: cy + inner * Math.sin(angle),
      x2: cx + outer * Math.cos(angle),
      y2: cy + outer * Math.sin(angle),
      major,
    };
  });

  // Hand angle based on progress
  const handAngle = progress * 2 * Math.PI - Math.PI / 2;
  const handLen = R - 24;
  const hx = cx + handLen * Math.cos(handAngle);
  const hy = cy + handLen * Math.sin(handAngle);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', filter: `drop-shadow(0 0 8px ${c.glow})` }}
    >
      <defs>
        <filter id={`glow-${color}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer ring background */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={c.dim} strokeWidth={strokeW} />

      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={R}
        fill="none"
        stroke={c.stroke}
        strokeWidth={strokeW}
        strokeDasharray={circum}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        filter={`url(#glow-${color})`}
      />

      {/* Tick marks */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={t.major ? c.stroke : c.dim}
          strokeWidth={t.major ? 2 : 1}
          opacity={t.major ? 0.9 : 0.5}
        />
      ))}

      {/* Hand */}
      <line
        x1={cx} y1={cy}
        x2={hx} y2={hy}
        stroke={c.stroke}
        strokeWidth={3}
        strokeLinecap="round"
        filter={`url(#glow-${color})`}
        style={{ transition: 'x2 0.8s cubic-bezier(0.4,0,0.2,1), y2 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={5} fill={c.stroke} filter={`url(#glow-${color})`} />
      <circle cx={cx} cy={cy} r={3} fill="#0d0f0b" />

      {/* Label */}
      {label && (
        <text
          x={cx} y={cy + R * 0.45}
          textAnchor="middle"
          fill={c.text}
          fontFamily="'VT323', monospace"
          fontSize="28"
          opacity="0.9"
        >
          {label}
        </text>
      )}
      {sublabel && (
        <text
          x={cx} y={cy + R * 0.45 + 20}
          textAnchor="middle"
          fill={c.text}
          fontFamily="'Share Tech Mono', monospace"
          fontSize="11"
          opacity="0.6"
          letterSpacing="0.05em"
        >
          {sublabel}
        </text>
      )}
    </svg>
  );
};

export default AnalogDial;
