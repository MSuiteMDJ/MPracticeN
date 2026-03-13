'use client';

import React, { useEffect, useRef } from 'react';
import { DEFAULT_LOGO } from '@/contexts/BrandingContext';

interface AssistDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}

export const AssistDrawer: React.FC<AssistDrawerProps> = ({
  open,
  onClose,
  children,
  ariaLabel = 'M Assist Drawer',
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (open) {
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
    } else {
      el.style.transform = 'translateY(16px)';
      el.style.opacity = '0';
    }
  }, [open]);

  return (
    <>
      <div
        className="suite-drawer-overlay"
        onMouseDown={handleOverlayClick}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          inset: 0,
          background: open ? 'transparent' : 'transparent',
          zIndex: 9998,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'background .25s ease',
        }}
      />

      <div
        role="dialog"
        aria-label={ariaLabel}
        aria-modal="true"
        ref={panelRef}
        className="suite-drawer"
        style={{
          position: 'fixed',
          right: '2rem',
          bottom: '6rem',
          width: 420,
          maxWidth: 'calc(100vw - 2rem)',
          height: 560,
          maxHeight: 'calc(100vh - 8rem)',
          display: 'flex',
          flexDirection: 'column',
          transform: 'translateY(16px)',
          opacity: 0,
          transition: 'transform .25s ease, opacity .25s ease',
          zIndex: 9999,
          background: 'rgba(31,31,31,0.70)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: '16px',
          boxShadow: '0 18px 48px rgba(0,0,0,0.35), 0 0 24px rgba(200,166,82,0.25)',
          overflow: 'hidden',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderBottom: '1px solid rgba(212,175,55,0.25)',
            color: '#f9f9f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src={DEFAULT_LOGO}
              alt="M Assist Lion"
              style={{ width: 22, height: 22, filter: 'none' }}
            />
            <span
              className="suite-brand-text"
              style={{
                color: 'var(--gold)',
                fontWeight: 800,
                letterSpacing: '.3px',
              }}
            >
              M Assist
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close M Assist"
            className="suite-drawer-close"
            style={{
              background: 'transparent',
              color: '#f9f9f9',
              border: '1px solid rgba(212,175,55,0.35)',
              borderRadius: 8,
              padding: '4px 8px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </>
  );
};

export default AssistDrawer;
