import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
        color: 'var(--text-muted)',
        marginBottom: '1rem',
      }}
    >
      {items.map((item, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {item.path ? (
            <Link
              to={item.path}
              style={{
                color: 'var(--text-muted)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--gold)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              {item.label}
            </Link>
          ) : (
            <span style={{ color: '#000', fontWeight: 500 }}>{item.label}</span>
          )}
          {index < items.length - 1 && (
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
      ))}
    </nav>
  );
}
