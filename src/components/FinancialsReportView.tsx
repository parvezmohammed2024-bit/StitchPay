import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, Filter, FileSpreadsheet, Info, TrendingUp, PackageCheck, Truck, AlertCircle } from 'lucide-react';
import { dataService } from '../lib/dataService';
import { GarmentStyle, StyleFinancialRecord, FactorySettings } from '../types';

interface FinancialsReportViewProps {
  currencySymbol?: string;
}

export const FinancialsReportView: React.FC<FinancialsReportViewProps> = ({ currencySymbol = 'MYR' }) => {
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [financials, setFinancials] = useState<StyleFinancialRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    dataService.getStyles().then(setStyles);
  }, []);

  useEffect(() => {
    loadFinancials();
  }, [selectedStyleId, fromDate, toDate]);

  const loadFinancials = async () => {
    setLoading(true);
    try {
      const records = await dataService.getStyleFinancials(
        selectedStyleId || null,
        fromDate || null,
        toDate || null
      );
      setFinancials(records);
    } catch (err) {
      console.error('Error loading financials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (type: 'today' | 'this_month' | 'all') => {
    const now = new Date();
    if (type === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (type === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(todayStr);
    } else {
      setFromDate('');
      setToDate('');
    }
  };

  // Totals calculation
  const totalProductionValue = financials.reduce((sum, f) => sum + Number(f.production_value || 0), 0);
  const totalDeliverableValue = financials.reduce((sum, f) => sum + Number(f.deliverable_value || 0), 0);
  const totalLabourCost = financials.reduce((sum, f) => sum + Number(f.labour_cost || 0), 0);
  const totalGrossMargin = totalDeliverableValue - totalLabourCost;
  const overallMarginPct = totalDeliverableValue > 0 ? (totalGrossMargin / totalDeliverableValue) * 100 : 0;

  const handleExportCSV = () => {
    let csv = 'Style,Buyer,Order Qty,Price per Piece,Garments Sewn,Ready to Deliver,Production Value,Deliverable Value,Labour Cost,Gross Margin,Margin %\n';
    financials.forEach(f => {
      const styleName = f.style || `${f.style_code || ''} ${f.style_name || ''}`.trim();
      const buyer = f.buyer || f.buyer_name || 'N/A';
      csv += `"${styleName}","${buyer}",${f.order_qty},${f.price || 0},${f.garments_sewn},${f.ready_to_deliver},${f.production_value},${f.deliverable_value},${f.labour_cost},${f.gross_margin},${f.margin_pct.toFixed(2)}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `style_financials_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white border border-stone-200 p-5 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
              Admin Exclusive
            </span>
            <h2 className="text-xl font-black text-stone-900 tracking-tight">Style Financials Summary</h2>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Order costings, garment production values, deliverable totals, and labour gross margins
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl transition-all text-xs shrink-0 shadow-xs"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
          <span>Export Financials CSV</span>
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Production Value */}
        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">Production Value</span>
            <PackageCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black font-mono text-stone-900">
            {currencySymbol} {totalProductionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-stone-500 flex items-center gap-1">
            <Info className="w-3 h-3 text-stone-400 shrink-0" />
            <span>Value of garments produced. Not yet delivered or invoiced.</span>
          </p>
        </div>

        {/* Deliverable Value */}
        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">Deliverable Value</span>
            <Truck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-900">
            {currencySymbol} {totalDeliverableValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-stone-500">Ready to deliver × price (billable value)</p>
        </div>

        {/* Labour Cost */}
        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">Labour Cost</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-900">
            {currencySymbol} {totalLabourCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-stone-500">Total piece-rate labour cost paid</p>
        </div>

        {/* Gross Margin */}
        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Margin</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <div className={`text-2xl font-black font-mono ${totalGrossMargin >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>
            {currencySymbol} {totalGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-stone-500">
            Margin: <span className="font-bold font-mono text-stone-800">{overallMarginPct.toFixed(1)}%</span> (deliverable minus labour)
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-stone-100 border border-stone-200 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Style Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-stone-500" />
            <select
              value={selectedStyleId}
              onChange={e => setSelectedStyleId(e.target.value)}
              className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Styles</option>
              {styles.map(s => (
                <option key={s.id} value={s.id}>
                  {s.style_code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-stone-500" />
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="bg-white border border-stone-200 rounded-xl px-2.5 py-1 text-xs text-stone-800 font-medium"
            />
            <span className="text-stone-400 text-xs">to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="bg-white border border-stone-200 rounded-xl px-2.5 py-1 text-xs text-stone-800 font-medium"
            />
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => handleQuickFilter('today')}
            className="px-2.5 py-1 bg-white hover:bg-stone-200 border border-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-all"
          >
            Today
          </button>
          <button
            onClick={() => handleQuickFilter('this_month')}
            className="px-2.5 py-1 bg-white hover:bg-stone-200 border border-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-all"
          >
            This Month
          </button>
          <button
            onClick={() => handleQuickFilter('all')}
            className="px-2.5 py-1 bg-white hover:bg-stone-200 border border-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-all"
          >
            All Time
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900">Garment Style Financial Breakdown</h3>
          <span className="text-xs text-stone-500">
            {financials.length} {financials.length === 1 ? 'Style' : 'Styles'} calculated
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-500 text-sm font-medium">
            Loading financial analysis...
          </div>
        ) : financials.length === 0 ? (
          <div className="p-12 text-center text-stone-500 text-sm font-medium">
            No style financials recorded for the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100/80 text-stone-700 border-b border-stone-200 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Style</th>
                  <th className="p-3">Buyer</th>
                  <th className="p-3 text-right">Order Qty</th>
                  <th className="p-3 text-right">Price ({currencySymbol})</th>
                  <th className="p-3 text-right">Garments Sewn</th>
                  <th className="p-3 text-right">Ready to Deliver</th>
                  <th className="p-3 text-right bg-indigo-50/50 text-indigo-950">
                    <div className="flex items-center justify-end gap-1" title="Value of garments produced. Not yet delivered or invoiced.">
                      <span>Production Val ({currencySymbol})</span>
                      <Info className="w-3 h-3 text-indigo-600 shrink-0" />
                    </div>
                  </th>
                  <th className="p-3 text-right bg-emerald-50/50 text-emerald-950">Deliverable Val ({currencySymbol})</th>
                  <th className="p-3 text-right">Labour Cost ({currencySymbol})</th>
                  <th className="p-3 text-right font-black text-stone-900">Gross Margin ({currencySymbol})</th>
                  <th className="p-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-800">
                {financials.map((f, idx) => {
                  const styleDisplay = f.style || `${f.style_code || ''} ${f.style_name || ''}`.trim() || 'Style';
                  const buyerDisplay = f.buyer || f.buyer_name || 'N/A';
                  const price = Number(f.price || f.selling_price || 0);

                  return (
                    <tr key={f.style_id || idx} className="hover:bg-stone-50 transition-colors">
                      <td className="p-3 font-bold text-stone-900 font-mono">{styleDisplay}</td>
                      <td className="p-3 text-stone-600">{buyerDisplay}</td>
                      <td className="p-3 text-right font-mono">{Number(f.order_qty || 0).toLocaleString()} pcs</td>
                      <td className="p-3 text-right font-mono font-medium">
                        {price > 0 ? price.toFixed(2) : <span className="text-stone-400 font-normal">—</span>}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-stone-900">
                        {Number(f.garments_sewn || 0).toLocaleString()} pcs
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-sky-800">
                        {Number(f.ready_to_deliver || 0).toLocaleString()} pcs
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-950 bg-indigo-50/30">
                        {Number(f.production_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-emerald-900 bg-emerald-50/30">
                        {Number(f.deliverable_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono text-stone-700">
                        {Number(f.labour_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`p-3 text-right font-mono font-black ${Number(f.gross_margin || 0) >= 0 ? 'text-emerald-800' : 'text-rose-600'}`}>
                        {Number(f.gross_margin || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-md ${
                          f.margin_pct > 30 ? 'bg-emerald-100 text-emerald-900' : f.margin_pct > 0 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'
                        }`}>
                          {Number(f.margin_pct || 0).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-stone-100 font-bold text-stone-900 border-t-2 border-stone-300">
                  <td colSpan={2} className="p-3 text-sm">Summary Totals</td>
                  <td className="p-3 text-right font-mono">
                    {financials.reduce((sum, f) => sum + Number(f.order_qty || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right font-mono">—</td>
                  <td className="p-3 text-right font-mono">
                    {financials.reduce((sum, f) => sum + Number(f.garments_sewn || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right font-mono">
                    {financials.reduce((sum, f) => sum + Number(f.ready_to_deliver || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right font-mono text-indigo-950">
                    {totalProductionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-900">
                    {totalDeliverableValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono text-stone-800">
                    {totalLabourCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`p-3 text-right font-mono font-black ${totalGrossMargin >= 0 ? 'text-emerald-900' : 'text-rose-600'}`}>
                    {totalGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {overallMarginPct.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
