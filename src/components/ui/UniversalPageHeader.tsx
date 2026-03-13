import React from 'react';
import clsx from 'clsx';

export interface UniversalPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  theme?: 'purple' | 'black';
  hideOnPrint?: boolean;
  meta?: React.ReactNode;
}

const THEME_STYLES = {
  purple: {
    accent: '#6A1B9A',
    ring: 'rgba(106, 27, 154, 0.12)',
    logo: '/M_Logo_PurpleD.png',
  },
  black: {
    accent: '#1F2937',
    ring: 'rgba(15, 23, 42, 0.12)',
    logo: '/M_Logo_Black.png',
  },
} as const;

export const UniversalPageHeader: React.FC<UniversalPageHeaderProps> = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  theme = 'purple',
  hideOnPrint = false,
  meta,
}) => {
  const themeStyles = THEME_STYLES[theme];

  return (
    <header
      className={clsx('border-b bg-white', hideOnPrint && 'print:hidden')}
      style={{
        borderBottomColor: themeStyles.ring,
        boxShadow: `inset 0 -3px 0 ${themeStyles.accent}`,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <div
                className="hidden h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 sm:flex"
                style={{ boxShadow: `0 0 0 4px ${themeStyles.ring}` }}
              >
                <img
                  src={themeStyles.logo}
                  alt="Practice Logo"
                  className="max-h-9 w-auto object-contain"
                />
              </div>

              <div className="min-w-0 flex-1">
                {breadcrumbs && breadcrumbs.length > 0 && (
                  <nav
                    aria-label="Breadcrumb"
                    className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500"
                  >
                    {breadcrumbs.map((breadcrumb, index) => (
                      <React.Fragment key={`${breadcrumb.label}-${index}`}>
                        {breadcrumb.href ? (
                          <a
                            href={breadcrumb.href}
                            className="transition-colors hover:text-slate-700 hover:underline"
                          >
                            {breadcrumb.label}
                          </a>
                        ) : (
                          <span className="text-slate-600">{breadcrumb.label}</span>
                        )}
                        {index < breadcrumbs.length - 1 && (
                          <span className="text-slate-300" aria-hidden="true">
                            /
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </nav>
                )}

                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]"
                        style={{
                          backgroundColor: themeStyles.ring,
                          color: themeStyles.accent,
                        }}
                      >
                        Workspace
                      </span>
                    </div>

                    {subtitle && (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
                    )}
                  </div>

                  {meta && (
                    <div className="max-w-xl rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600 shadow-sm xl:min-w-[240px]">
                      {meta}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {actions && (
            <div className="flex flex-wrap items-center gap-2 print:hidden lg:justify-end">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default UniversalPageHeader;
