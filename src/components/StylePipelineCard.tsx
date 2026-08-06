import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { StylePipelineRow } from '../types';
import { StyleImage } from './StyleImage';

interface StylePipelineCardProps {
  pipeline: StylePipelineRow;
  isDark?: boolean;
  extraBadge?: React.ReactNode;
}

export const StylePipelineCard: React.FC<StylePipelineCardProps> = ({ pipeline, isDark = false, extraBadge }) => {
  const {
    style_code,
    style_name,
    buyer_name,
    image_url,
    order_qty,
    requires_cutting,
    qty_cut,
    qty_sewn,
    qty_in_finishing,
    qty_ready,
    pct_cut,
    pct_sewn,
    pct_finishing,
    pct_ready,
    bottleneck,
  } = pipeline;

  const targetQty = order_qty || 1;
  const pctReadyClamped = Math.min(100, Math.max(0, Math.round(pct_ready)));

  // Data Sanity Check
  const warnings: string[] = [];
  if (qty_ready > qty_sewn) {
    warnings.push(`Ready qty (${qty_ready.toLocaleString()}) exceeds Sewn qty (${qty_sewn.toLocaleString()})`);
  }
  if (requires_cutting !== false && qty_sewn > qty_cut) {
    warnings.push(`Sewn qty (${qty_sewn.toLocaleString()}) exceeds Cut qty (${qty_cut.toLocaleString()})`);
  }
  if (qty_ready > targetQty) {
    warnings.push(`Ready qty (${qty_ready.toLocaleString()}) exceeds Order Target (${targetQty.toLocaleString()})`);
  }

  // Bottleneck matcher
  const isStageBottleneck = (stageKey: string) => {
    if (!bottleneck) return false;
    const b = bottleneck.trim().toUpperCase();
    const s = stageKey.trim().toUpperCase();
    if (b === s) return true;
    if (s === 'CUTTING' && b.includes('CUT')) return true;
    if (s === 'SEWING' && b.includes('SEW')) return true;
    if (s === 'FINISHING' && (b.includes('FINISH') || b.includes('IRON') || b.includes('PACK'))) return true;
    if (s === 'READY' && (b.includes('READY') || b.includes('DELIV'))) return true;
    return false;
  };

  const cardBg = isDark ? 'bg-stone-900 border-stone-700/80 text-white' : 'bg-stone-50 border-stone-200 text-stone-900';
  const subText = isDark ? 'text-stone-400' : 'text-stone-600';
  const dividerBorder = isDark ? 'border-stone-800' : 'border-stone-200';
  const mainBarBg = isDark ? 'bg-stone-800' : 'bg-stone-200';

  return (
    <div className={`border rounded-2xl p-4 shadow-2xs space-y-3 ${cardBg}`}>
      {/* Header Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center space-x-3 min-w-0">
          <StyleImage
            imageUrl={image_url}
            styleName={style_name || style_code}
            className="w-12 h-12 rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{style_name || style_code}</h4>
            <p className={`text-xs font-mono truncate ${subText}`}>
              {style_code} • {buyer_name || 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {extraBadge}

          {/* Data Sanity Warning */}
          {warnings.length > 0 && (
            <div
              className="relative group cursor-help flex items-center gap-1 px-2 py-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold"
              title={warnings.join(' • ')}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="text-[10px] uppercase tracking-wide hidden sm:inline">Data Warning</span>

              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-30 w-64 p-2.5 bg-stone-950 text-stone-100 text-[11px] rounded-xl shadow-xl border border-rose-800/50 pointer-events-none font-normal">
                <div className="font-bold text-rose-400 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>Data Mismatch Warning:</span>
                </div>
                <ul className="space-y-1 list-disc list-inside text-stone-300">
                  {warnings.map((w, idx) => (
                    <li key={idx} className="leading-tight">{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* pct_ready badge */}
          <span className={
            isDark
              ? 'text-xs font-bold px-2.5 py-1 bg-indigo-950/80 text-indigo-300 rounded-lg border border-indigo-800/80 font-mono'
              : 'text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-lg border border-indigo-200 font-mono'
          }>
            {pctReadyClamped}% Done
          </span>
        </div>
      </div>

      {/* Main Overall Progress Bar */}
      <div>
        <div className={`w-full ${mainBarBg} h-2.5 rounded-full overflow-hidden mt-1`}>
          <div
            className="bg-gradient-to-r from-indigo-600 via-amber-600 to-emerald-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${pctReadyClamped}%` }}
          />
        </div>

        <div className={`flex justify-between text-xs font-mono mt-1.5 ${subText}`}>
          <span>{qty_ready.toLocaleString()} completed</span>
          <span>Target: {targetQty.toLocaleString()} pcs</span>
        </div>
      </div>

      {/* Production Pipeline Stage Flow */}
      <div className={`pt-3 border-t ${dividerBorder}`}>
        <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
          <span>Pipeline Stage Flow</span>
          {requires_cutting === false && (
            <span className={
              isDark
                ? 'text-[10px] font-bold text-stone-400 bg-stone-800 px-1.5 py-0.5 rounded border border-stone-700'
                : 'text-[10px] font-bold text-stone-500 bg-stone-200/70 px-1.5 py-0.5 rounded'
            }>
              Starts at Sewing
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          {/* STAGE 1: CUTTING */}
          {requires_cutting === false ? (
            <div className={
              isDark
                ? 'bg-stone-800/60 text-stone-400 border border-stone-700 rounded-lg p-2 flex flex-col items-center justify-between h-20'
                : 'bg-stone-200/60 text-stone-500 border border-stone-300 rounded-lg p-2 flex flex-col items-center justify-between h-20'
            }>
              <span className="text-[9px] font-bold uppercase tracking-tight text-stone-400">Cutting</span>
              <span className="text-[11px] font-bold text-stone-400 my-auto">Pre-cut</span>
              <div className="w-full h-1 bg-transparent" />
            </div>
          ) : (
            <StageBox
              stageName="Cutting"
              qty={qty_cut}
              pct={pct_cut}
              isBottleneck={isStageBottleneck('CUTTING')}
              isDark={isDark}
              colorTheme="indigo"
            />
          )}

          {/* STAGE 2: SEWING */}
          <StageBox
            stageName="Sewing"
            qty={qty_sewn}
            pct={pct_sewn}
            isBottleneck={isStageBottleneck('SEWING')}
            isDark={isDark}
            colorTheme="amber"
          />

          {/* STAGE 3: FINISHING */}
          <StageBox
            stageName="Finishing"
            qty={qty_in_finishing}
            pct={pct_finishing}
            isBottleneck={isStageBottleneck('FINISHING')}
            isDark={isDark}
            colorTheme="purple"
          />

          {/* STAGE 4: READY */}
          <StageBox
            stageName="Ready"
            qty={qty_ready}
            pct={pct_ready}
            isBottleneck={isStageBottleneck('READY')}
            isDark={isDark}
            colorTheme="emerald"
          />
        </div>
      </div>
    </div>
  );
};

interface StageBoxProps {
  stageName: string;
  qty: number;
  pct: number;
  isBottleneck: boolean;
  isDark: boolean;
  colorTheme: 'indigo' | 'amber' | 'purple' | 'emerald';
}

const StageBox: React.FC<StageBoxProps> = ({
  stageName,
  qty,
  pct,
  isBottleneck,
  isDark,
  colorTheme,
}) => {
  const clampPct = Math.min(100, Math.max(0, Math.round(pct)));

  const themeStyles = {
    indigo: {
      light: {
        bg: 'bg-indigo-50/90 text-indigo-950 border-indigo-200',
        header: 'text-indigo-700',
        qty: 'text-indigo-950',
        pct: 'text-indigo-600',
        barBg: 'bg-indigo-200/80',
        barFill: 'bg-indigo-600',
      },
      dark: {
        bg: 'bg-indigo-950/50 text-indigo-200 border-indigo-800/60',
        header: 'text-indigo-400',
        qty: 'text-indigo-100',
        pct: 'text-indigo-300',
        barBg: 'bg-indigo-900/80',
        barFill: 'bg-indigo-500',
      },
    },
    amber: {
      light: {
        bg: 'bg-amber-50/90 text-amber-950 border-amber-200',
        header: 'text-amber-700',
        qty: 'text-amber-950',
        pct: 'text-amber-600',
        barBg: 'bg-amber-200/80',
        barFill: 'bg-amber-500',
      },
      dark: {
        bg: 'bg-amber-950/50 text-amber-200 border-amber-800/60',
        header: 'text-amber-400',
        qty: 'text-amber-100',
        pct: 'text-amber-300',
        barBg: 'bg-amber-900/80',
        barFill: 'bg-amber-500',
      },
    },
    purple: {
      light: {
        bg: 'bg-purple-50/90 text-purple-950 border-purple-200',
        header: 'text-purple-700',
        qty: 'text-purple-950',
        pct: 'text-purple-600',
        barBg: 'bg-purple-200/80',
        barFill: 'bg-purple-600',
      },
      dark: {
        bg: 'bg-purple-950/50 text-purple-200 border-purple-800/60',
        header: 'text-purple-400',
        qty: 'text-purple-100',
        pct: 'text-purple-300',
        barBg: 'bg-purple-900/80',
        barFill: 'bg-purple-500',
      },
    },
    emerald: {
      light: {
        bg: 'bg-emerald-50/90 text-emerald-950 border-emerald-200',
        header: 'text-emerald-700',
        qty: 'text-emerald-950',
        pct: 'text-emerald-600',
        barBg: 'bg-emerald-200/80',
        barFill: 'bg-emerald-600',
      },
      dark: {
        bg: 'bg-emerald-950/50 text-emerald-200 border-emerald-800/60',
        header: 'text-emerald-400',
        qty: 'text-emerald-100',
        pct: 'text-emerald-300',
        barBg: 'bg-emerald-900/80',
        barFill: 'bg-emerald-500',
      },
    },
  };

  const currentTheme = isDark ? themeStyles[colorTheme].dark : themeStyles[colorTheme].light;

  const bottleneckClass = isBottleneck
    ? 'ring-2 ring-amber-500 border-amber-500 shadow-sm relative'
    : '';

  return (
    <div className={`border rounded-lg p-2 flex flex-col justify-between h-20 ${currentTheme.bg} ${bottleneckClass}`}>
      {isBottleneck && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-stone-950 font-black text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full shadow-xs whitespace-nowrap z-10">
          Bottleneck
        </span>
      )}

      {/* Stage Header */}
      <span className={`text-[9px] font-bold uppercase tracking-tight truncate ${currentTheme.header}`}>
        {stageName}
      </span>

      {/* Prominent Quantity & Percentage */}
      <div className="my-auto">
        <span className={`text-xs font-black font-mono leading-tight block truncate ${currentTheme.qty}`}>
          {qty.toLocaleString()} pcs
        </span>
        <span className={`text-[10px] font-semibold block leading-tight ${currentTheme.pct}`}>
          {clampPct}%
        </span>
      </div>

      {/* Thin Progress Bar */}
      <div className={`w-full ${currentTheme.barBg} h-1 rounded-full overflow-hidden shrink-0 mt-1`}>
        <div
          className={`${currentTheme.barFill} h-full rounded-full transition-all duration-300`}
          style={{ width: `${clampPct}%` }}
        />
      </div>
    </div>
  );
};
