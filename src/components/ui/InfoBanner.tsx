import React, { useState } from 'react';
import { Info, AlertTriangle, X } from 'lucide-react';

export type InfoBannerVariant = 'info' | 'warning';

interface InfoBannerProps {
  message: string;
  variant?: InfoBannerVariant;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const InfoBanner: React.FC<InfoBannerProps> = ({
  message,
  variant = 'info',
  dismissible = false,
  onDismiss,
  className = '',
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  const styles = {
    info: {
      background: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      color: '#3b82f6',
      iconColor: '#3b82f6',
    },
    warning: {
      background: 'rgba(234, 179, 8, 0.1)',
      border: '1px solid rgba(234, 179, 8, 0.3)',
      color: '#eab308',
      iconColor: '#eab308',
    },
  };

  const style = styles[variant];
  const Icon = variant === 'info' ? Info : AlertTriangle;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        background: style.background,
        border: style.border,
        borderRadius: '8px',
        marginBottom: '1rem',
      }}
      role="alert"
      aria-live="polite"
    >
      <Icon
        size={20}
        style={{
          color: style.iconColor,
          flexShrink: 0,
          marginTop: '0.125rem',
        }}
        aria-hidden="true"
      />

      <div
        style={{
          flex: 1,
          color: style.color,
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      >
        {message}
      </div>

      {dismissible && (
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '0.25rem',
            cursor: 'pointer',
            color: style.iconColor,
            opacity: 0.7,
            transition: 'opacity 0.2s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
          }}
          aria-label="Dismiss banner"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};
