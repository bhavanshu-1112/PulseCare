import { useState } from 'react';
import { Brain, Zap, Loader2, CheckCircle2, AlertCircle, Sparkles, RefreshCw, Cpu, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Panel } from '../ui/Panel';
import { API_BASE } from '../services/api';

interface AIControlPanelProps {
  onComplete: () => void;
}

type PipelineStatus = 'idle' | 'running' | 'success' | 'error';

interface PipelineResult {
  forecasting?: {
    alerts_created: number;
    summary: string;
    at_risk_count: number;
    total_items_analyzed: number;
  };
  redistribution?: {
    recommendations_count: number;
    overall_plan: string;
    saved_count: number;
    deficits_found?: number;
    surpluses_found?: number;
  };
}

export function AIControlPanel({ onComplete }: AIControlPanelProps) {
  const [forecastStatus, setForecastStatus] = useState<PipelineStatus>('idle');
  const [redistStatus, setRedistStatus] = useState<PipelineStatus>('idle');
  const [result, setResult] = useState<PipelineResult>({});
  const [errorMsg, setErrorMsg] = useState('');

  const runForecasting = async () => {
    setForecastStatus('running');
    setErrorMsg('');
    const toastId = toast.loading('Running Gemini demand forecasting...');
    try {
      const res = await fetch(`${API_BASE}/ai/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setForecastStatus('success');
        setResult(prev => ({ ...prev, forecasting: data.data }));
        toast.success(`Forecast Complete: ${data.data.alerts_created || 0} alert(s) generated`, {
          id: toastId,
          description: `${data.data.at_risk_count || 0} items at risk across ${data.data.total_items_analyzed || 0} analyzed`,
        });
        onComplete();
      } else {
        throw new Error(data.error || 'Forecast failed');
      }
    } catch (err: any) {
      setForecastStatus('error');
      setErrorMsg(err.message);
      toast.error('Forecasting failed: ' + (err.message || 'Unknown error'), { id: toastId });
    }
  };

  const runRedistribution = async () => {
    setRedistStatus('running');
    setErrorMsg('');
    const toastId = toast.loading('Optimizing cross-district redistribution...');
    try {
      const res = await fetch(`${API_BASE}/ai/redistribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setRedistStatus('success');
        setResult(prev => ({ ...prev, redistribution: data.data }));
        toast.success(`Optimization Complete: ${data.data.saved_count || data.data.recommendations_count || 0} transfer route(s) calculated`, {
          id: toastId,
          description: `Balanced deficits against surplus facilities`,
        });
        onComplete();
      } else {
        throw new Error(data.error || 'Redistribution failed');
      }
    } catch (err: any) {
      setRedistStatus('error');
      setErrorMsg(err.message);
      toast.error('Redistribution failed: ' + (err.message || 'Unknown error'), { id: toastId });
    }
  };

  const runAll = async () => {
    setResult({});
    setErrorMsg('');
    await runForecasting();
    await runRedistribution();
  };

  const isRunning = forecastStatus === 'running' || redistStatus === 'running';

  return (
    <Panel
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span>AI Intelligence Engine</span>
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-[var(--color-brand-tint)] text-[var(--color-brand)]">
            <Sparkles className="w-3 h-3" />
            Gemini LLM
          </span>
        </div>
      }
      subtitle="Demand forecasting, stockout early warning, and cross-district resource rebalancing"
      actions={
        <div className="flex items-center gap-2 bg-[var(--color-raised)] px-3 py-1.5 rounded-xl border border-[var(--color-line)] text-xs">
          <Cpu className="w-3.5 h-3.5 text-[var(--color-brand)]" />
          <span className="text-[var(--color-muted)]">Model:</span>
          <span className="font-semibold text-[var(--color-ink)]">gemini-2.5-flash</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-[var(--color-muted)]">
            fallback: lite / 3.8
          </span>
        </div>
      }
    >
      {/* Action Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
        {/* Step 1: Forecast */}
        <button
          onClick={runForecasting}
          disabled={isRunning}
          className="group relative flex flex-col items-start p-4 rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand-tint)] hover:border-[var(--color-brand)]/40 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-brand-tint)] text-[var(--color-brand)]">
              {forecastStatus === 'running' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : forecastStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--color-ok-text)]" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand)]">
              Step 1
            </span>
          </div>
          <span className="text-sm font-bold text-[var(--color-ink)] mb-0.5">
            {forecastStatus === 'running' ? 'Analyzing Burn Rates...' : 'Run Demand Forecast'}
          </span>
          <span className="text-xs text-[var(--color-muted)] leading-snug">
            Calculates 14-day stockout risks & generates automated alerts
          </span>
        </button>

        {/* Step 2: Redistribution */}
        <button
          onClick={runRedistribution}
          disabled={isRunning}
          className="group relative flex flex-col items-start p-4 rounded-xl border border-[var(--color-ok-text)]/20 bg-[var(--color-ok-bg)] hover:border-[var(--color-ok-text)]/40 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-ok-bg)] text-[var(--color-ok-text)]">
              {redistStatus === 'running' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : redistStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--color-ok-text)]" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ok-text)]">
              Step 2
            </span>
          </div>
          <span className="text-sm font-bold text-[var(--color-ink)] mb-0.5">
            {redistStatus === 'running' ? 'Computing Transfer Graph...' : 'Optimize Redistribution'}
          </span>
          <span className="text-xs text-[var(--color-muted)] leading-snug">
            Pairs surplus facilities with deficit centers via distance-aware AI
          </span>
        </button>

        {/* Combined Pipeline */}
        <button
          onClick={runAll}
          disabled={isRunning}
          className="group relative flex flex-col items-start p-4 rounded-xl border border-[var(--color-medium-text)]/25 bg-[var(--color-medium-bg)] hover:border-[var(--color-medium-text)]/50 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-medium-bg)] text-[var(--color-medium-text)]">
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-medium-text)]">
              Combined
            </span>
          </div>
          <span className="text-sm font-bold text-[var(--color-ink)] mb-0.5">
            Run Full AI Pipeline
          </span>
          <span className="text-xs text-[var(--color-muted)] leading-snug">
            Synchronize telemetry, forecast risks, and recompute transfers
          </span>
        </button>
      </div>

      {/* Results */}
      {(result.forecasting || result.redistribution || errorMsg) && (
        <div className="rounded-xl p-4 space-y-3 bg-[var(--color-raised)] border border-[var(--color-line)]">

          {result.forecasting && (
            <div className="flex items-start gap-3 pb-3 border-b border-[var(--color-line-subtle)] last:border-0 last:pb-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-brand-tint)] text-[var(--color-brand)] flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand)]">
                    Demand Forecast Summary
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand)] font-medium">
                    {result.forecasting.total_items_analyzed} Evaluated
                  </span>
                </div>
                <p className="text-xs text-[var(--color-ink)] opacity-80 leading-relaxed mb-2">
                  {result.forecasting.summary}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="text-[var(--color-muted)]">
                    At Risk: <strong className="text-[var(--color-critical-text)]">{result.forecasting.at_risk_count}</strong>
                  </span>
                  <span className="text-[var(--color-muted)]">
                    Alerts: <strong className="text-[var(--color-high-text)]">{result.forecasting.alerts_created}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}

          {result.redistribution && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-ok-bg)] text-[var(--color-ok-text)] flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-ok-text)]">
                    Redistribution Plan Generated
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-ok-bg)] text-[var(--color-ok-text)] font-medium">
                    {result.redistribution.recommendations_count} Transfers
                  </span>
                </div>
                <p className="text-xs text-[var(--color-ink)] opacity-80 leading-relaxed">
                  {result.redistribution.overall_plan}
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-critical-bg)] border border-[var(--color-critical-bg)] text-[var(--color-critical-text)] text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
