import React, { useState } from 'react';
import { Lock } from 'lucide-react';

interface LockIconProps {
  tooltip?: string;
  size?: number;
  className?: string;
}

export const LockIcon: React.FC<LockIconProps> = ({
  tooltip = 'This field is locked and cannot be changed',
  size = 16,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Lock
        size={size}
        className={className}
        style={{
          color: 'var(--gold, #c8a652)',
          opacity: 0.7,
          cursor: 'help',
        }}
        aria-label="Locked field"
      />

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginLeft: '0.5rem',
            padding: '0.5rem 0.75rem',
            background: 'rgba(0, 0, 0, 0.9)',
            color: '#fff',
            fontSize: '0.75rem',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxWidth: '250px',
          }}
        >
          {tooltip}
          <div
            style={{
              position: 'absolute',
              left: '-4px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderRight: '4px solid rgba(0, 0, 0, 0.9)',
            }}
          />
        </div>
      )}
    </div>
  );
};
