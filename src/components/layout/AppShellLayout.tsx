import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/contexts/SettingsContext';

const navItems = [
  // Section 1: Core Workflow
  { label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { label: 'Clients', icon: '🏢', path: '/clients', agentOnly: true },
  { label: 'Onboarding', icon: '🧭', path: '/onboarding', agentOnly: true },
  { label: 'Services', icon: '🧩', path: '/services' },
  { label: 'Compliance', icon: '🛡️', path: '/compliance' },
  { label: 'divider', icon: '', path: '' },
  
  // Section 2: Data & Analysis
  { label: 'Companies House', icon: '🏛️', path: '/companies-house', agentOnly: true },
  { label: 'Contacts', icon: '👥', path: '/contacts', agentOnly: true },
  { label: 'Documents', icon: '🗂️', path: '/documents', agentOnly: true },
  { label: 'divider', icon: '', path: '' },
  
  // Section 3: Resources & Settings
  { label: 'Reports', icon: '📑', path: '/reports', agentOnly: true },
  { label: 'Letter Templates', icon: '📄', path: '/documents/templates', agentOnly: true },
  { label: 'Knowledge Centre', icon: '📘', path: '/knowledge' },
  { label: 'Settings', icon: '⚙️', path: '/settings' },
];

export const ShellLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Full-width topbar with centered title */}
      <header className="header">
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.2em',
            color: 'var(--text-light)',
            fontSize: '0.95rem',
          }}
        >
          M PRACTICE MANAGER
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          <button
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--text-light)',
              cursor: 'pointer',
              padding: '0.5rem 0.9rem',
              fontSize: '0.875rem',
              borderRadius: '8px',
              transition: 'background 0.2s ease',
            }}
            onClick={() => navigate('/services')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Add Service
          </button>
          <button
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--text-light)',
              cursor: 'pointer',
              padding: '0.5rem 0.9rem',
              fontSize: '0.875rem',
              borderRadius: '8px',
              transition: 'background 0.2s ease',
            }}
            onClick={() => navigate('/reports')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Reports
          </button>
          <span style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>
            {user?.username || 'User'}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(193, 143, 28, 0.2)',
              border: '1px solid var(--gold)',
              borderRadius: '999px',
              color: 'var(--gold)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(193, 143, 28, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(193, 143, 28, 0.2)';
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Sidebar below topbar - no branding */}
      <aside className="sidebar">
        <nav className="suite-navlist">
          {navItems.map((item, index) => {
            // Render divider
            if (item.label === 'divider') {
              return (
                <div
                  key={`divider-${index}`}
                  style={{
                    height: '1px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    margin: '1rem 0.75rem',
                  }}
                />
              );
            }

            const userType =
              settings.userType === 'self'
                ? 'SELF'
                : settings.userType === 'agent'
                  ? 'AGENT'
                  : settings.userType;
            const isDisabled = item.agentOnly && userType === 'SELF';
            const isHovered = hoveredItem === item.label;

            return (
              <div
                key={item.label}
                style={{ position: 'relative' }}
                onMouseEnter={() => setHoveredItem(item.label)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <button
                  className={`suite-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => !isDisabled && navigate(item.path)}
                  style={{
                    opacity: isDisabled ? 0.4 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    pointerEvents: isDisabled ? 'none' : 'auto',
                  }}
                  disabled={isDisabled}
                >
                  <span className="suite-nav-icon">{item.icon}</span>
                  <span className="suite-nav-label">{item.label}</span>
                </button>

                {/* Tooltip for disabled items */}
                {isDisabled && isHovered && (
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
                    }}
                  >
                    This section is only available for Agent users
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
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="main">{children}</main>
    </div>
  );
};
