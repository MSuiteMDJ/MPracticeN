'use client';

import React, { useState, useRef } from 'react';
import { DEFAULT_LOGO } from '@/contexts/BrandingContext';

interface AssistFabProps {
  onClick?: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  disabled?: boolean;
  badge?: number;
  status?: 'ok' | 'warn' | 'error';
  inline?: boolean;
  sizePx?: number;
}

export const AssistFab: React.FC<AssistFabProps> = ({
  onClick,
  position = 'bottom-left',
  disabled = false,
  badge,
  status = 'ok',
  inline = false,
  sizePx,
}) => {
  const [hover, setHover] = useState(false);
  const ringRef = useRef<HTMLDivElement | null>(null);

  const resolvedSize = typeof sizePx === 'number' ? sizePx : inline ? 36 : 54;
  const ringSize = inline ? resolvedSize - 8 : resolvedSize - 8;

  const posStyle: React.CSSProperties = inline
    ? {}
    : {
        position: 'fixed',
        zIndex: 9999,
        ...(position.includes('bottom') ? { bottom: '2rem' } : { top: '2rem' }),
        ...(position.includes('right') ? { right: '2rem' } : { left: '2rem' }),
      };

  const statusColor =
    status === 'error' ? '#ef4444' : status === 'warn' ? '#eab308' : 'var(--gold, #c8a652)';

  return (
    <div style={posStyle}>
      <style>{`@keyframes suite-ring-spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }`}</style>

      <button
        onClick={disabled ? undefined : onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={disabled}
        aria-label="Open M Assist"
        aria-expanded={false}
        className="suite-fab"
        style={{
          position: 'relative',
          width: resolvedSize,
          height: resolvedSize,
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: 'none',
          transform: hover ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform .2s ease',
          outline: 'none',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div
            ref={ringRef}
            aria-hidden
            className={`suite-fab-ring suite-fab-ring-${status}`}
            style={{
              position: 'absolute',
              width: ringSize,
              height: ringSize,
              borderRadius: '50%',
              border: `2px solid ${statusColor}`,
              boxShadow: 'none',
              animation:
                status === 'error'
                  ? 'suite-ring-spin 1.2s linear infinite'
                  : status === 'warn'
                    ? 'suite-ring-spin 3s linear infinite'
                    : hover
                      ? 'suite-ring-spin 2.2s linear infinite'
                      : 'none',
              transition: 'border-color .2s ease',
            }}
          >
            <span
              className="suite-fab-status-dot"
              style={{
                position: 'absolute',
                top: -4,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusColor,
                boxShadow: '0 0 6px rgba(0,0,0,0.25)',
              }}
            />
          </div>

          <img
            src={DEFAULT_LOGO}
            alt="M Assist Lion"
            style={{
              width: inline ? resolvedSize - 14 : 28,
              height: inline ? resolvedSize - 14 : 28,
              filter: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>

        {badge && badge > 0 && !inline && (
          <div
            className="suite-fab-badge"
            style={{
              position: 'absolute',
              right: -2,
              top: -2,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: '#ef4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 0 8px rgba(0,0,0,0.3)',
            }}
          >
            {badge > 99 ? '99+' : badge}
          </div>
        )}
      </button>
    </div>
  );
};

export default AssistFab;
