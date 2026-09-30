import React from 'react';
import { Activity, RefreshCw, Sun, Moon, Monitor, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  isConnected: boolean;
  states: string[];
  districts: Array<{ district: string; state: string }>;
  selectedState: string;
  selectedDistrict: string;
  onStateChange: (state: string) => void;
  onDistrictChange: (district: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  states,
  districts,
  selectedState,
  selectedDistrict,
  onStateChange,
  onDistrictChange,
  onRefresh,
  isRefreshing = false,
}) => {
  const { theme, toggleTheme } = useTheme();
  const hasActiveFilters = Boolean(selectedState || selectedDistrict);

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-[var(--color-line)] bg-[var(--color-surface)]/95 backdrop-blur-md transition-colors">
      <div className="max-w-[1440px] mx-auto h-full px-6 flex items-center justify-between gap-4">
        
        {/* Brand & Context */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-brand)] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-[var(--color-ink)] truncate">
                PulseCare
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand)] border border-[var(--color-brand)]/20 hidden sm:inline-block">
                District Operations
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-muted)] truncate hidden md:block leading-tight">
              Federated Primary Health Centre Network Intelligence
            </p>
          </div>
        </div>

        {/* Filter Controls & System Status */}
        <div className="flex items-center gap-3 flex-shrink-0">
          
          {/* Location Filters */}
          <div className="flex items-center gap-1.5 bg-[var(--color-raised)] p-1 rounded-lg border border-[var(--color-line)]">
            <select
              value={selectedState}
              onChange={(e) => onStateChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-[var(--color-ink)] px-2 py-1 rounded focus:outline-none cursor-pointer"
            >
              <option value="">All States</option>
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <span className="text-[var(--color-line)]">/</span>

            <select
              value={selectedDistrict}
              onChange={(e) => onDistrictChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-[var(--color-ink)] px-2 py-1 rounded focus:outline-none cursor-pointer max-w-[130px] truncate"
            >
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d.district} value={d.district}>{d.district}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  onStateChange('');
                  onDistrictChange('');
                }}
                title="Clear filter"
                className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-line)] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Connection Status Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-ink)]">
            <span
              className={
                isConnected
                  ? 'live-pulse-dot'
                  : 'w-2 h-2 rounded-full bg-[var(--color-critical)]'
              }
            />
            <span className="text-[11px] font-medium text-[var(--color-muted)] hidden sm:inline">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            title={`Current theme: ${theme}. Click to switch.`}
            className="p-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
          >
            {theme === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
            {theme === 'dark' && <Moon className="w-4 h-4 text-sky-400" />}
            {theme === 'system' && <Monitor className="w-4 h-4" />}
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh live data"
            className="p-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--color-brand)]' : ''}`}
            />
          </button>

        </div>
      </div>
    </header>
  );
};
