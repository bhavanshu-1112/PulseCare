import { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import {
  api,
  StockItem,
  BedSummary,
  AttendanceSummary,
  Alert,
  Redistribution,
  FilterOptions,
} from './services/api';
import { useWebSocket } from './hooks/useWebSocket';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { StockHeatmap } from './components/StockHeatmap';
import { BedOccupancy } from './components/BedOccupancy';
import { AttendancePanel } from './components/AttendancePanel';
import { AlertsPanel } from './components/AlertsPanel';
import { RedistributionPanel } from './components/RedistributionPanel';
import { LiveFeed } from './components/LiveFeed';
import { AIControlPanel } from './components/AIControlPanel';
import { DistrictSummary } from './components/DistrictSummary';
import {
  LayoutDashboard,
  Pill,
  Building2,
  Cpu,
  BellRing,
  Activity,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Panel } from './ui/Panel';
import { StatusBadge } from './ui/StatusBadge';
import { RelativeTime } from './ui/RelativeTime';

export type TabKey = 'overview' | 'medicine' | 'facilities' | 'ai' | 'alerts';

export default function App() {
  // Sync tab with URL query parameter
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'medicine' || tabParam === 'facilities' || tabParam === 'ai' || tabParam === 'alerts' || tabParam === 'overview') {
      return tabParam as TabKey;
    }
    // Backward compatibility with previous tab names
    if (tabParam === 'inventory') return 'medicine';
    if (tabParam === 'ai-engine') return 'ai';
    return 'overview';
  });

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  };

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [beds, setBeds] = useState<BedSummary[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [redistributions, setRedistributions] = useState<Redistribution[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({ states: [], districts: [] });
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { isConnected, messages } = useWebSocket();

  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsRefreshing(true);
      const [stockData, bedData, attendData, alertData, redistData, filterData] = await Promise.all([
        api.getStockSummary(selectedState, selectedDistrict),
        api.getBedSummary(selectedState, selectedDistrict),
        api.getAttendanceSummary(selectedState, selectedDistrict),
        api.getAlerts(),
        api.getRedistributions(),
        api.getFilters(),
      ]);

      setStocks(stockData);
      setBeds(bedData);
      setAttendance(attendData);
      setAlerts(alertData);
      setRedistributions(redistData);
      setFilters(filterData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Network sync error: Unable to fetch live PHC telemetry');
    } finally {
      setLoading(false);
      if (!isSilent) setIsRefreshing(false);
    }
  }, [selectedState, selectedDistrict]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle incoming live websocket messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[0];
      if (lastMsg.updateType === 'ALERT_TRIGGERED' && lastMsg.data) {
        toast.warning(lastMsg.data.title || 'New health alert triggered', {
          description: `${lastMsg.data.facility_name || 'PHC'} (${lastMsg.data.district || ''})`,
        });
      }
      const timer = setTimeout(() => {
        loadData(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [messages, loadData]);

  // Global Keyboard Shortcuts for District Health Officers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '1') {
        e.preventDefault();
        handleTabChange('overview');
      } else if (e.key === '2') {
        e.preventDefault();
        handleTabChange('medicine');
      } else if (e.key === '3') {
        e.preventDefault();
        handleTabChange('facilities');
      } else if (e.key === '4') {
        e.preventDefault();
        handleTabChange('ai');
      } else if (e.key === '5') {
        e.preventDefault();
        handleTabChange('alerts');
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        loadData(false);
        toast.info('Telemetry data refreshed');
      } else if (e.key === '?') {
        e.preventDefault();
        toast('Operations Shortcuts', {
          description: '1: Overview | 2: Medicine | 3: Facilities | 4: AI Engine | 5: Alerts | R: Refresh Telemetry',
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadData]);

  const filteredDistricts = selectedState
    ? filters.districts.filter((d) => d.state === selectedState)
    : filters.districts;

  const activeAlertsCount = alerts.filter((a) => !a.is_resolved).length;
  const criticalAlertsCount = alerts.filter((a) => !a.is_resolved && a.severity === 'critical').length;
  const stockoutCount = stocks.filter((s) => s.stock_status === 'stockout' || s.quantity <= 0).length;
  const pendingRedistributionsCount = redistributions.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] text-[var(--color-ink)]">
        <div className="text-center p-8 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] max-w-sm mx-auto shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-[var(--color-brand-tint)] text-[var(--color-brand)] flex items-center justify-center mx-auto mb-4">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-base font-semibold text-[var(--color-ink)] mb-1">
            Loading PulseCare Dashboard
          </h2>
          <p className="text-xs text-[var(--color-muted)]">
            Syncing PHC telemetry and inventory state...
          </p>
        </div>
      </div>
    );
  }

  const tabs: Array<{
    id: TabKey;
    label: string;
    shortcut: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    countSeverity?: 'critical' | 'high' | 'info';
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      shortcut: '1',
      icon: LayoutDashboard,
    },
    {
      id: 'medicine',
      label: 'Medicine Stock',
      shortcut: '2',
      icon: Pill,
      count: stockoutCount > 0 ? stockoutCount : undefined,
      countSeverity: 'critical',
    },
    {
      id: 'facilities',
      label: 'Facilities & Capacity',
      shortcut: '3',
      icon: Building2,
    },
    {
      id: 'ai',
      label: 'AI Redistribution',
      shortcut: '4',
      icon: Cpu,
      count: pendingRedistributionsCount > 0 ? pendingRedistributionsCount : undefined,
      countSeverity: 'info',
    },
    {
      id: 'alerts',
      label: 'Alerts & Telemetry',
      shortcut: '5',
      icon: BellRing,
      count: activeAlertsCount > 0 ? activeAlertsCount : undefined,
      countSeverity: criticalAlertsCount > 0 ? 'critical' : 'high',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] flex flex-col font-sans">
      <Toaster position="top-right" richColors />

      {/* Global Header */}
      <Header
        isConnected={isConnected}
        states={filters.states}
        districts={filteredDistricts}
        selectedState={selectedState}
        selectedDistrict={selectedDistrict}
        onStateChange={(s) => {
          setSelectedState(s);
          setSelectedDistrict('');
        }}
        onDistrictChange={setSelectedDistrict}
        onRefresh={() => loadData(false)}
        isRefreshing={isRefreshing}
      />

      {/* Tab Navigation Bar */}
      <div className="border-b border-[var(--color-line)] bg-[var(--color-surface)] sticky top-16 z-40">
        <div className="max-w-[1440px] mx-auto px-6">
          <nav className="flex items-center gap-1 overflow-x-auto py-0 scrollbar-none" aria-label="Dashboard Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  title={`Switch to ${tab.label} (Press ${tab.shortcut})`}
                  className={`relative flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] border-b-2 border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span className="hidden lg:inline-block text-[10px] opacity-40 font-mono px-1 rounded bg-[var(--color-raised)]">
                    {tab.shortcut}
                  </span>
                  {tab.count !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                        tab.countSeverity === 'critical'
                          ? 'bg-[var(--color-critical-bg)] text-[var(--color-critical-text)]'
                          : tab.countSeverity === 'high'
                          ? 'bg-[var(--color-high-bg)] text-[var(--color-high-text)]'
                          : 'bg-[var(--color-brand-tint)] text-[var(--color-brand)]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Workspace Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 min-w-0">
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top KPI row */}
            <StatsOverview
              stocks={stocks}
              beds={beds}
              attendance={attendance}
              alerts={alerts}
            />

            {/* Split row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              {/* Left 2 cols */}
              <div className="xl:col-span-2 min-w-0">
                <DistrictSummary
                  stocks={stocks}
                  beds={beds}
                  attendance={attendance}
                />
              </div>

              {/* Right 1 col: Triage cards */}
              <div className="space-y-6 min-w-0">
                {/* AI Transfers CTA */}
                <Panel
                  title="AI Redistribution"
                  subtitle={`${pendingRedistributionsCount} recommended transfers pending approval`}
                  actions={
                    <span className="text-xs font-semibold text-[var(--color-brand)]">
                      Active
                    </span>
                  }
                >
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed mb-4">
                    The forecasting engine identified surplus inventories to balance PHCs facing imminent stockout risks.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTabChange('ai')}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>Review AI Transfers</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </Panel>

                {/* Priority Alerts Summary */}
                <Panel
                  title="Active Alerts"
                  subtitle={`${activeAlertsCount} unresolved alerts`}
                  actions={
                    <button
                      type="button"
                      onClick={() => handleTabChange('alerts')}
                      className="text-xs font-medium text-[var(--color-brand)] hover:underline cursor-pointer"
                    >
                      View all
                    </button>
                  }
                >
                  <div className="space-y-2">
                    {alerts
                      .filter((a) => !a.is_resolved)
                      .slice(0, 4)
                      .map((alert) => (
                        <div
                          key={alert.id}
                          className="p-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[var(--color-ink)] truncate">
                              {alert.title}
                            </span>
                            <StatusBadge
                              severity={
                                alert.severity === 'critical'
                                  ? 'critical'
                                  : alert.severity === 'high'
                                  ? 'high'
                                  : 'medium'
                              }
                              size="sm"
                              label={alert.severity}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                            <span className="truncate">
                              {alert.facility_name} · {alert.district}
                            </span>
                            <RelativeTime timestamp={alert.created_at} />
                          </div>
                        </div>
                      ))}

                    {activeAlertsCount === 0 && (
                      <div className="text-center py-6 text-xs text-[var(--color-muted)]">
                        <ShieldCheck className="w-6 h-6 text-[var(--color-ok)] mx-auto mb-1" />
                        No active critical alerts.
                      </div>
                    )}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEDICINE STOCK */}
        {activeTab === 'medicine' && (
          <div className="space-y-6">
            <StockHeatmap stocks={stocks} />
          </div>
        )}

        {/* TAB 3: FACILITIES & CAPACITY */}
        {activeTab === 'facilities' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <BedOccupancy beds={beds} />
            <AttendancePanel attendance={attendance} />
          </div>
        )}

        {/* TAB 4: AI REDISTRIBUTION */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <AIControlPanel onComplete={() => loadData(false)} />
            <RedistributionPanel
              redistributions={redistributions}
              onStatusUpdate={() => loadData(false)}
            />
          </div>
        )}

        {/* TAB 5: ALERTS & TELEMETRY */}
        {activeTab === 'alerts' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <AlertsPanel alerts={alerts} onAlertUpdated={() => loadData(false)} />
            <LiveFeed messages={messages} />
          </div>
        )}
      </main>

      {/* Global Footer */}
      {/* Global Footer */}
      <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface)] py-3 mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-muted)]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />
            <span className="font-medium text-[var(--color-ink)] opacity-90">PulseCare</span>
            <span>·</span>
            <span>District Health Operations Intelligence</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[var(--color-muted)] flex-wrap justify-center">
            <span className="hidden md:inline-flex items-center gap-1 opacity-75">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] border border-[var(--color-line)] font-mono text-[10px]">1-5</kbd> Tabs
            </span>
            <span className="hidden md:inline-flex items-center gap-1 opacity-75">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] border border-[var(--color-line)] font-mono text-[10px]">R</kbd> Refresh
            </span>
            <span className="hidden md:inline-flex items-center gap-1 opacity-75">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] border border-[var(--color-line)] font-mono text-[10px]">?</kbd> Shortcuts
            </span>
            <span>·</span>
            <span className="tabular-nums">Synced: {lastUpdated.toLocaleTimeString('en-IN')}</span>
            <span>·</span>
            <span className="tabular-nums">{new Set(stocks.map(s => s.facility_id)).size} PHCs Connected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
