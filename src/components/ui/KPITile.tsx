import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPITileProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: LucideIcon;
  color?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'slate';
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
}

const colorClasses = {
  emerald: 'text-emerald-500',
  amber: 'text-amber-500',
  rose: 'text-rose-500',
  blue: 'text-blue-500',
  purple: 'text-purple-500',
  slate: 'text-slate-500',
};

export const KPITile: React.FC<KPITileProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'slate',
  trend,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <Icon className={`h-8 w-8 ${colorClasses[color]}`} />
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        {trend && (
          <p className="mt-1 text-sm font-semibold text-slate-600">{trend.value}</p>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">{subtext}</p>
    </div>
  );
};

export default KPITile;
