import React from 'react';
import { Scissors, Shirt, PackageCheck, Info, Calendar } from 'lucide-react';
import { TodaySectionRow } from '../types';

interface TodaysPerformanceSectionProps {
  rows: TodaySectionRow[];
  loading?: boolean;
  theme?: 'dark' | 'light';
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  title?: string;
}

export const TodaysPerformanceSection: React.FC<TodaysPerformanceSectionProps> = ({
  rows,
  loading = false,
  theme = 'dark',
  selectedDate,
  onDateChange,
  title = "Today's Performance"
}) => {
  const isDark = theme === 'dark';

  // Categorize rows safely
  const cuttingRows = rows.filter(r => {
    const s = (r.section || '').toLowerCase();
    return s.includes('cut');
  });

  const productionRows = rows.filter(r => {
    const s = (r.section || '').toLowerCase();
    return s.includes('prod') || s.includes('sew') || s.includes('oper');
  });

  const finishingRows = rows.filter(r => {
    const s = (r.section || '').toLowerCase();
    return s.includes('finish') || s.includes('pack') || s.includes('iron');
  });

  const totalCutting = cuttingRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  const totalProduction = productionRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  const totalFinishing = finishingRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);

  // Container styling based on theme
  const containerBg = isDark ? 'bg-stone-800 border-stone-700/80' : 'bg-white border-stone-200';
  const headingText = isDark ? 'text-white' : 'text-stone-900';
  const subText = isDark ? 'text-stone-400' : 'text-stone-500';

  return (
    <div className={`${containerBg} border rounded-3xl p-5 sm:p-6 shadow-md space-y-5`}>
      {/* Title Header with Date Picker if needed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-700/50 pb-4">
        <div>
          <h3 className={`text-base sm:text-lg font-black tracking-tight ${headingText} flex items-center gap-2`}>
            <span>{title}</span>
          </h3>
          <p className={`text-xs ${subText} mt-0.5`}>
            Section output overview from supervisor & worker entries
          </p>
        </div>

        {selectedDate && onDateChange && (
          <div className="flex items-center space-x-2 shrink-0">
            <Calendar className={`w-4 h-4 ${subText}`} />
            <input
              type="date"
              value={selectedDate}
              onChange={e => onDateChange(e.target.value)}
              className={
                isDark
                  ? "bg-stone-900 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  : "bg-stone-50 border border-stone-300 rounded-xl px-3 py-1.5 text-xs text-stone-900 font-mono font-bold focus:outline-none focus:border-indigo-600"
              }
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className={`p-8 text-center text-xs font-mono ${subText}`}>
          Loading section metrics...
        </div>
      ) : (
        /* Three Cards Grid: side-by-side on desktop (lg:grid-cols-3), stacked on mobile */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* ==================== 1. CUTTING CARD (AMBER) ==================== */}
          <div className={
            isDark
              ? "bg-stone-900/90 border border-amber-500/20 rounded-2xl p-4.5 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-colors"
              : "bg-amber-50/40 border border-amber-200/80 rounded-2xl p-4.5 flex flex-col justify-between space-y-4 hover:border-amber-300 transition-colors"
          }>
            <div className="space-y-3">
              {/* Card Header: CUTTING amber matching nav icons */}
              <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
                <div className="flex items-center space-x-2.5">
                  <div className={
                    isDark
                      ? "w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 font-bold"
                      : "w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 font-bold"
                  }>
                    <Scissors className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={isDark ? "text-xs font-black uppercase tracking-wider text-amber-400" : "text-xs font-black uppercase tracking-wider text-amber-800"}>
                      CUTTING
                    </h4>
                    <span className={`text-[10px] font-medium ${subText}`}>Daily fabric cut</span>
                  </div>
                </div>

                {/* Total pieces as a large number beside header */}
                <div className="text-right">
                  <div className={isDark ? "text-2xl font-black font-mono text-amber-300 tabular-nums" : "text-2xl font-black font-mono text-amber-900 tabular-nums"}>
                    {totalCutting.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-tight">pieces</div>
                </div>
              </div>

              {/* Styles List */}
              {cuttingRows.length === 0 ? (
                <div className={`py-6 text-center text-xs font-medium italic ${subText}`}>
                  No output recorded
                </div>
              ) : (
                <div className="space-y-2.5 divide-y divide-stone-700/30">
                  {cuttingRows.map((r, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 space-y-0.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="truncate min-w-0">
                          <span className={isDark ? "font-bold font-mono text-amber-200 mr-1.5" : "font-bold font-mono text-stone-900 mr-1.5"}>
                            {r.style_code}
                          </span>
                          {r.style_name && (
                            <span className={isDark ? "text-stone-400 truncate" : "text-stone-600 truncate"}>
                              {r.style_name}
                            </span>
                          )}
                        </div>
                        <div className={isDark ? "font-mono font-bold text-amber-300 shrink-0 text-right" : "font-mono font-bold text-amber-900 shrink-0 text-right"}>
                          {Number(r.qty).toLocaleString()} <span className="text-[10px] font-normal opacity-70">pcs</span>
                        </div>
                      </div>
                      {r.detail && (
                        <div className={`text-[11px] leading-tight ${subText} pl-0.5 font-sans`}>
                          {r.detail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ==================== 2. PRODUCTION CARD (INDIGO) ==================== */}
          <div className={
            isDark
              ? "bg-stone-900/90 border border-indigo-500/20 rounded-2xl p-4.5 flex flex-col justify-between space-y-4 hover:border-indigo-500/40 transition-colors"
              : "bg-indigo-50/40 border border-indigo-200/80 rounded-2xl p-4.5 flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-colors"
          }>
            <div className="space-y-3">
              {/* Card Header: PRODUCTION indigo matching nav icons */}
              <div className="flex items-center justify-between pb-3 border-b border-indigo-500/20">
                <div className="flex items-center space-x-2.5">
                  <div className={
                    isDark
                      ? "w-8 h-8 rounded-xl bg-indigo-400/10 border border-indigo-400/20 flex items-center justify-center text-indigo-400 font-bold"
                      : "w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700 font-bold"
                  }>
                    <Shirt className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={isDark ? "text-xs font-black uppercase tracking-wider text-indigo-400" : "text-xs font-black uppercase tracking-wider text-indigo-800"}>
                      PRODUCTION
                    </h4>
                    <span className="text-[10px] font-bold text-indigo-400/90 block">
                      Operations logged today
                    </span>
                  </div>
                </div>

                {/* Total count beside header */}
                <div className="text-right">
                  <div className={isDark ? "text-2xl font-black font-mono text-indigo-300 tabular-nums" : "text-2xl font-black font-mono text-indigo-900 tabular-nums"}>
                    {totalProduction.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-tight">steps</div>
                </div>
              </div>

              {/* Helper text calling out operation steps */}
              <div className={
                isDark 
                  ? "bg-indigo-950/50 border border-indigo-800/40 rounded-xl px-2.5 py-1.5 text-[11px] text-indigo-300 flex items-start space-x-1.5"
                  : "bg-indigo-100/60 border border-indigo-200 rounded-xl px-2.5 py-1.5 text-[11px] text-indigo-900 flex items-start space-x-1.5"
              }>
                <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span className="font-medium leading-tight">Operation steps completed, not finished garments.</span>
              </div>

              {/* Styles List */}
              {productionRows.length === 0 ? (
                <div className={`py-6 text-center text-xs font-medium italic ${subText}`}>
                  No output recorded
                </div>
              ) : (
                <div className="space-y-2.5 divide-y divide-stone-700/30">
                  {productionRows.map((r, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 space-y-0.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="truncate min-w-0">
                          <span className={isDark ? "font-bold font-mono text-indigo-200 mr-1.5" : "font-bold font-mono text-stone-900 mr-1.5"}>
                            {r.style_code}
                          </span>
                          {r.style_name && (
                            <span className={isDark ? "text-stone-400 truncate" : "text-stone-600 truncate"}>
                              {r.style_name}
                            </span>
                          )}
                        </div>
                        <div className={isDark ? "font-mono font-bold text-indigo-300 shrink-0 text-right" : "font-mono font-bold text-indigo-900 shrink-0 text-right"}>
                          {Number(r.qty).toLocaleString()} <span className="text-[10px] font-normal opacity-70">ops</span>
                        </div>
                      </div>
                      {r.detail && (
                        <div className={`text-[11px] leading-tight ${subText} pl-0.5 font-sans`}>
                          {r.detail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ==================== 3. FINISHING CARD (PURPLE) ==================== */}
          <div className={
            isDark
              ? "bg-stone-900/90 border border-purple-500/20 rounded-2xl p-4.5 flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition-colors"
              : "bg-purple-50/40 border border-purple-200/80 rounded-2xl p-4.5 flex flex-col justify-between space-y-4 hover:border-purple-300 transition-colors"
          }>
            <div className="space-y-3">
              {/* Card Header: FINISHING purple matching nav icons */}
              <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                <div className="flex items-center space-x-2.5">
                  <div className={
                    isDark
                      ? "w-8 h-8 rounded-xl bg-purple-400/10 border border-purple-400/20 flex items-center justify-center text-purple-400 font-bold"
                      : "w-8 h-8 rounded-xl bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-700 font-bold"
                  }>
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={isDark ? "text-xs font-black uppercase tracking-wider text-purple-400" : "text-xs font-black uppercase tracking-wider text-purple-800"}>
                      FINISHING
                    </h4>
                    <span className={`text-[10px] font-medium ${subText}`}>Ironing & packing</span>
                  </div>
                </div>

                {/* Total pieces beside header */}
                <div className="text-right">
                  <div className={isDark ? "text-2xl font-black font-mono text-purple-300 tabular-nums" : "text-2xl font-black font-mono text-purple-900 tabular-nums"}>
                    {totalFinishing.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-semibold text-purple-500 uppercase tracking-tight">pieces</div>
                </div>
              </div>

              {/* Styles List */}
              {finishingRows.length === 0 ? (
                <div className={`py-6 text-center text-xs font-medium italic ${subText}`}>
                  No output recorded
                </div>
              ) : (
                <div className="space-y-2.5 divide-y divide-stone-700/30">
                  {finishingRows.map((r, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 space-y-0.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="truncate min-w-0">
                          <span className={isDark ? "font-bold font-mono text-purple-200 mr-1.5" : "font-bold font-mono text-stone-900 mr-1.5"}>
                            {r.style_code}
                          </span>
                          {r.style_name && (
                            <span className={isDark ? "text-stone-400 truncate" : "text-stone-600 truncate"}>
                              {r.style_name}
                            </span>
                          )}
                        </div>
                        <div className={isDark ? "font-mono font-bold text-purple-300 shrink-0 text-right" : "font-mono font-bold text-purple-900 shrink-0 text-right"}>
                          {Number(r.qty).toLocaleString()} <span className="text-[10px] font-normal opacity-70">pcs</span>
                        </div>
                      </div>
                      {r.detail && (
                        <div className={`text-[11px] leading-tight ${subText} pl-0.5 font-sans`}>
                          {r.detail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
