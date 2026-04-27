import React, { useState, useEffect, useRef } from 'react';
import { quotes } from '../data/quotes';

const QuoteTicker: React.FC = () => {
  const [quoteIndex, setQuoteIndex] = useState(() =>
    Math.floor(Math.random() * quotes.length)
  );
  const [displayText, setDisplayText] = useState('');
  const [typing, setTyping] = useState(true);
  const typeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuote = quotes[quoteIndex];

  // Typewriter effect
  useEffect(() => {
    setDisplayText('');
    setTyping(true);
    let i = 0;
    const text = `"${currentQuote.text}"`;

    const tick = () => {
      i++;
      setDisplayText(text.slice(0, i));
      if (i < text.length) {
        typeRef.current = setTimeout(tick, 28);
      } else {
        setTyping(false);
        // Schedule next quote after 12s
        cycleRef.current = setTimeout(() => {
          setQuoteIndex(idx => (idx + 1) % quotes.length);
        }, 12000);
      }
    };

    typeRef.current = setTimeout(tick, 300);
    return () => {
      if (typeRef.current) clearTimeout(typeRef.current);
      if (cycleRef.current) clearTimeout(cycleRef.current);
    };
  }, [quoteIndex, currentQuote.text]);

  const handleNext = () => {
    if (typeRef.current) clearTimeout(typeRef.current);
    if (cycleRef.current) clearTimeout(cycleRef.current);
    setQuoteIndex(idx => (idx + 1) % quotes.length);
  };

  return (
    <div className="quote-panel pip-panel">
      <span className="screw-bl">✦</span>
      <span className="screw-br">✦</span>

      <div className="quote-label">// PHILOSOPHER'S TRANSMISSION //</div>

      <blockquote className="quote-text glow-green">
        {displayText}
        {typing && <span className="cursor-blink">▌</span>}
      </blockquote>

      {!typing && (
        <div className="quote-attr" style={{ animation: 'fadeIn 0.6s ease' }}>
          <span className="quote-author glow-amber">— {currentQuote.author}</span>
          {currentQuote.era && (
            <span className="quote-era">&nbsp;&nbsp;[{currentQuote.era}]</span>
          )}
        </div>
      )}

      <div className="quote-footer">
        <div className="quote-progress">
          {quotes.map((_, i) => (
            <span
              key={i}
              className={`quote-pip ${i === quoteIndex ? 'active' : ''}`}
              onClick={() => {
                if (typeRef.current) clearTimeout(typeRef.current);
                if (cycleRef.current) clearTimeout(cycleRef.current);
                setQuoteIndex(i);
              }}
            />
          ))}
        </div>
        <button className="pip-btn" onClick={handleNext} style={{ fontSize: '11px', padding: '4px 12px' }}>
          NEXT ▶
        </button>
      </div>
    </div>
  );
};

export default QuoteTicker;
