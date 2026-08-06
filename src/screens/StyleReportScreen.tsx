import React, { useState, useEffect } from 'react';
import { 
  Scissors, Layers, CheckCircle2, AlertTriangle, Download, Printer, 
  Calendar, ArrowRight, FileSpreadsheet, Info, DollarSign, TrendingUp, TrendingDown, Clock, PackageCheck
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dataService } from '../lib/dataService';
import { GarmentStyle, GarmentProcess, Worker, FactorySettings, CuttingEntry, ProductionEntry, FinishingEntry, StyleSizeBreakdownRow } from '../types';

export interface StyleReportSummary {
  order_qty: number;
  total_cut: number;
  garments_sewn: number;
  total_operations: number;
  total_wages: number;
  finishing_received: number;
  ready_to_deliver: number;
  quoted_labour_cost_per_garment: number;
  actual_labour_cost_per_garment: number;
  variance: number;
  requires_cutting?: boolean;
}

export interface StyleReportDaily {
  date: string;
  cut: number;
  operations: number;
  wages: number;
  finishing: number;
  ready: number;
  cum_cut?: number;
  cum_sewn?: number;
  cum_finished?: number;
}

export interface StyleReportProcess {
  seq: number;
  operation: string;
  rate: number;
  qty: number;
  rework: number;
  reject: number;
  wages: number;
  workers: number | string;
  is_bottleneck?: boolean;
}

export interface StyleReportWorker {
  worker_id: string;
  worker: string;
  worker_code: string;
  section: string;
  pay_type: 'piece_rate' | 'monthly_salary';
  operations_performed: string;
  pieces: number;
  earnings: number | null;
}

type DatePreset = 'entire' | 'this_week' | 'this_month' | 'last_month' | 'custom';

export const StyleReportScreen: React.FC = () => {
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<GarmentStyle | null>(null);
  const [settings, setSettings] = useState<FactorySettings | null>(null);

  // Date controls
  const [preset, setPreset] = useState<DatePreset>('entire');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Loaded Report Data
  const [loading, setLoading] = useState<boolean>(false);
  const [summary, setSummary] = useState<StyleReportSummary | null>(null);
  const [dailyData, setDailyData] = useState<StyleReportDaily[]>([]);
  const [processData, setProcessData] = useState<StyleReportProcess[]>([]);
  const [workerData, setWorkerData] = useState<StyleReportWorker[]>([]);
  const [sizeBreakdown, setSizeBreakdown] = useState<StyleSizeBreakdownRow[]>([]);

  const currencySymbol = settings?.currency_symbol || 'MYR';

  useEffect(() => {
    initScreen();
  }, []);

  const initScreen = async () => {
    setLoading(true);
    const [sList, setRes] = await Promise.all([
      dataService.getStyles(),
      dataService.getSettings(),
    ]);
    setStyles(sList);
    setSettings(setRes);

    if (sList.length > 0) {
      const activeOrFirst = sList.find(s => s.status === 'active') || sList[0];
      setSelectedStyleId(activeOrFirst.id);
      setSelectedStyle(activeOrFirst);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedStyleId) {
      const st = styles.find(s => s.id === selectedStyleId) || null;
      setSelectedStyle(st);
      loadReport(selectedStyleId, fromDate, toDate);
    }
  }, [selectedStyleId, fromDate, toDate]);

  const handlePresetChange = (newPreset: DatePreset) => {
    setPreset(newPreset);
    const today = new Date();

    if (newPreset === 'entire') {
      setFromDate('');
      setToDate('');
    } else if (newPreset === 'this_week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(today.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setFromDate(monday.toISOString().split('T')[0]);
      setToDate(sunday.toISOString().split('T')[0]);
    } else if (newPreset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFromDate(firstDay.toISOString().split('T')[0]);
      setToDate(lastDay.toISOString().split('T')[0]);
    } else if (newPreset === 'last_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(firstDay.toISOString().split('T')[0]);
      setToDate(lastDay.toISOString().split('T')[0]);
    } else if (newPreset === 'custom') {
      // retain custom dates or set default last 30 days
      if (!fromDate) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        setFromDate(d.toISOString().split('T')[0]);
        setToDate(new Date().toISOString().split('T')[0]);
      }
    }
  };

  const loadReport = async (styleId: string, pFrom: string, pTo: string) => {
    setLoading(true);
    const argFrom = pFrom || null;
    const argTo = pTo || null;

    let sumRes: StyleReportSummary | null = null;
    let dailyRes: StyleReportDaily[] | null = null;
    let procRes: StyleReportProcess[] | null = null;
    let wrkRes: StyleReportWorker[] | null = null;

    // 1. Attempt RPC calls via Supabase
    if (isSupabaseConfigured) {
      try {
        const [rSum, rDaily, rProc, rWrk] = await Promise.all([
          supabase.rpc('rpt_style_summary', { p_style_id: styleId, p_from: argFrom, p_to: argTo }),
          supabase.rpc('rpt_style_daily', { p_style_id: styleId, p_from: argFrom, p_to: argTo }),
          supabase.rpc('rpt_style_processes', { p_style_id: styleId, p_from: argFrom, p_to: argTo }),
          supabase.rpc('rpt_style_workers', { p_style_id: styleId, p_from: argFrom, p_to: argTo }),
        ]);

        if (!rSum.error && rSum.data) {
          sumRes = Array.isArray(rSum.data) ? rSum.data[0] : rSum.data;
        }
        if (!rDaily.error && rDaily.data && Array.isArray(rDaily.data)) {
          dailyRes = rDaily.data;
        }
        if (!rProc.error && rProc.data && Array.isArray(rProc.data)) {
          procRes = rProc.data;
        }
        if (!rWrk.error && rWrk.data && Array.isArray(rWrk.data)) {
          wrkRes = rWrk.data;
        }
      } catch (err) {
        console.warn('RPC call failed, using client fallback', err);
      }
    }

    // 2. Client-side fallback computation if RPC results are missing
    const currentStyle = styles.find(s => s.id === styleId) || (await dataService.getStyles()).find(s => s.id === styleId);

    if (!sumRes || !dailyRes || !procRes || !wrkRes) {
      const fallback = await calculateClientFallback(styleId, currentStyle, argFrom, argTo);
      if (!sumRes) sumRes = fallback.summary;
      if (!dailyRes) dailyRes = fallback.daily;
      if (!procRes) procRes = fallback.processes;
      if (!wrkRes) wrkRes = fallback.workers;
    }

    // 3. Normalize & Sanitize numerical values from RPC / fallback
    if (sumRes) {
      sumRes = {
        order_qty: Number(sumRes.order_qty) || 0,
        total_cut: Number(sumRes.total_cut) || 0,
        garments_sewn: Number(sumRes.garments_sewn) || 0,
        total_operations: Number(sumRes.total_operations) || 0,
        total_wages: Number(sumRes.total_wages) || 0,
        finishing_received: Number(sumRes.finishing_received) || 0,
        ready_to_deliver: Number(sumRes.ready_to_deliver) || 0,
        quoted_labour_cost_per_garment: Number(sumRes.quoted_labour_cost_per_garment) || 0,
        actual_labour_cost_per_garment: Number(sumRes.actual_labour_cost_per_garment) || 0,
        variance: Number(sumRes.variance) || 0,
        requires_cutting: sumRes.requires_cutting !== undefined ? Boolean(sumRes.requires_cutting) : true,
      };
    }

    if (dailyRes && Array.isArray(dailyRes)) {
      dailyRes = dailyRes.map(d => ({
        ...d,
        cut: Number(d.cut) || 0,
        operations: Number(d.operations) || 0,
        wages: Number(d.wages) || 0,
        finishing: Number(d.finishing) || 0,
        ready: Number(d.ready) || 0,
      }));
    }

    if (procRes && Array.isArray(procRes)) {
      procRes = procRes.map(p => ({
        ...p,
        seq: Number(p.seq) || 0,
        rate: Number(p.rate) || 0,
        qty: Number(p.qty) || 0,
        rework: Number(p.rework) || 0,
        reject: Number(p.reject) || 0,
        wages: Number(p.wages) || 0,
      }));
    }

    if (wrkRes && Array.isArray(wrkRes)) {
      wrkRes = wrkRes.map(w => ({
        ...w,
        pieces: Number(w.pieces) || 0,
        operations_performed: String(w.operations_performed || ''),
        earnings: w.earnings !== null && w.earnings !== undefined ? Number(w.earnings) : null,
      }));
    }

    // Post-process Bottlenecks in Process Table
    if (procRes && procRes.length > 0) {
      let minQty = Infinity;
      procRes.forEach(p => {
        if (p.qty < minQty) minQty = p.qty;
      });
      procRes = procRes.map(p => ({
        ...p,
        is_bottleneck: procRes!.length > 1 && p.qty === minQty,
      }));
    }

    // Post-process Cumulative Data for Charts
    if (dailyRes && dailyRes.length > 0) {
      let runCut = 0;
      let runSewn = 0;
      let runFinished = 0;
      dailyRes = dailyRes.map(d => {
        runCut += d.cut || 0;
        runSewn += d.operations || 0;
        runFinished += d.ready || d.finishing || 0;
        return {
          ...d,
          cum_cut: runCut,
          cum_sewn: runSewn,
          cum_finished: runFinished,
        };
      });
    }

    setSummary(sumRes);
    setDailyData(dailyRes || []);
    setProcessData(procRes || []);
    setWorkerData(wrkRes || []);

    const sbData = await dataService.getStyleSizeBreakdown(styleId);
    setSizeBreakdown(sbData || []);

    setLoading(false);
  };

  const calculateClientFallback = async (
    styleId: string, 
    style: GarmentStyle | undefined,
    argFrom: string | null, 
    argTo: string | null
  ) => {
    const [cEntriesAll, pEntriesAll, fEntriesAll, procsAll, workersAll] = await Promise.all([
      dataService.getCuttingEntries(),
      dataService.getProductionEntries(),
      dataService.getFinishingEntries(),
      dataService.getProcesses(styleId),
      dataService.getWorkers(),
    ]);

    const cEntries = cEntriesAll.filter(c => c.style_id === styleId && (!argFrom || c.entry_date >= argFrom) && (!argTo || c.entry_date <= argTo));
    const pEntries = pEntriesAll.filter(p => p.style_id === styleId && (!argFrom || p.entry_date >= argFrom) && (!argTo || p.entry_date <= argTo));
    const fEntries = fEntriesAll.filter(f => f.style_id === styleId && (!argFrom || f.entry_date >= argFrom) && (!argTo || f.entry_date <= argTo));

    const total_cut = cEntries.reduce((sum, c) => sum + (c.pieces_cut || 0), 0);

    // Operation processes breakdown
    const processMap = new Map<string, { ok: number; rework: number; reject: number; wages: number; workers: Set<string> }>();
    procsAll.forEach(pr => {
      processMap.set(pr.id, { ok: 0, rework: 0, reject: 0, wages: 0, workers: new Set() });
    });

    pEntries.forEach(p => {
      let item = processMap.get(p.process_id);
      if (!item) {
        item = { ok: 0, rework: 0, reject: 0, wages: 0, workers: new Set() };
        processMap.set(p.process_id, item);
      }
      item.ok += p.qty_ok || 0;
      item.rework += p.qty_rework || 0;
      item.reject += p.qty_reject || 0;
      item.wages += p.amount || 0;
      if (p.worker_id) item.workers.add(p.worker_id);
    });

    const processesList: StyleReportProcess[] = procsAll.map(pr => {
      const stats = processMap.get(pr.id) || { ok: 0, rework: 0, reject: 0, wages: 0, workers: new Set() };
      return {
        seq: pr.seq_no,
        operation: pr.name,
        rate: pr.rate,
        qty: stats.ok,
        rework: stats.rework,
        reject: stats.reject,
        wages: stats.wages,
        workers: `${stats.workers.size} worker${stats.workers.size === 1 ? '' : 's'}`,
      };
    }).sort((a, b) => a.seq - b.seq);

    // Garments sewn from fn_garments_sewn
    const garments_sewn = await dataService.getGarmentsSewn(styleId, argFrom, argTo);
    const total_operations = processesList.reduce((sum, p) => sum + p.qty, 0);
    const total_wages = pEntries.reduce((sum, p) => sum + (p.amount || 0), 0);

    const finishing_received = fEntries.reduce((sum, f) => sum + (f.qty_ok || 0), 0);
    const ready_to_deliver = fEntries.reduce((sum, f) => sum + (f.qty_ok || 0), 0);

    const quoted_labour_cost_per_garment = procsAll.reduce((sum, p) => sum + Number(p.rate || 0), 0);
    const actual_labour_cost_per_garment = garments_sewn > 0 ? (total_wages / garments_sewn) : quoted_labour_cost_per_garment;
    const variance = actual_labour_cost_per_garment - quoted_labour_cost_per_garment;

    const summaryRes: StyleReportSummary = {
      order_qty: style?.order_qty || 0,
      total_cut,
      garments_sewn,
      total_operations,
      total_wages,
      finishing_received,
      ready_to_deliver,
      quoted_labour_cost_per_garment,
      actual_labour_cost_per_garment,
      variance,
      requires_cutting: style?.requires_cutting !== false,
    };

    // Daily breakdown
    const dateMap = new Map<string, { cut: number; ops: number; wages: number; finishing: number; ready: number }>();

    cEntries.forEach(c => {
      const d = c.entry_date;
      const cur = dateMap.get(d) || { cut: 0, ops: 0, wages: 0, finishing: 0, ready: 0 };
      cur.cut += c.pieces_cut || 0;
      dateMap.set(d, cur);
    });

    pEntries.forEach(p => {
      const d = p.entry_date;
      const cur = dateMap.get(d) || { cut: 0, ops: 0, wages: 0, finishing: 0, ready: 0 };
      cur.ops += p.qty_ok || 0;
      cur.wages += p.amount || 0;
      dateMap.set(d, cur);
    });

    fEntries.forEach(f => {
      const d = f.entry_date;
      const cur = dateMap.get(d) || { cut: 0, ops: 0, wages: 0, finishing: 0, ready: 0 };
      cur.finishing += f.qty_ok || 0;
      cur.ready += f.qty_ok || 0;
      dateMap.set(d, cur);
    });

    const dailyList: StyleReportDaily[] = Array.from(dateMap.entries())
      .map(([date, vals]) => ({
        date,
        cut: vals.cut,
        operations: vals.ops,
        wages: vals.wages,
        finishing: vals.finishing,
        ready: vals.ready,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Workers breakdown
    const workerMap = new Map<string, Worker>(workersAll.map(w => [w.id, w]));
    const workerStats = new Map<string, { opsSet: Set<string>; pcs: number; wages: number }>();

    pEntries.forEach(p => {
      let stats = workerStats.get(p.worker_id);
      if (!stats) {
        stats = { opsSet: new Set(), pcs: 0, wages: 0 };
        workerStats.set(p.worker_id, stats);
      }
      if (p.process_name) stats.opsSet.add(p.process_name);
      stats.pcs += p.qty_ok || 0;
      stats.wages += p.amount || 0;
    });

    const workersList: StyleReportWorker[] = Array.from(workerStats.entries()).map(([wId, stats]) => {
      const w = workerMap.get(wId);
      const isSalaried = w?.pay_type === 'monthly_salary';
      return {
        worker_id: wId,
        worker: w?.full_name || 'Worker',
        worker_code: w?.worker_code || wId.slice(0, 6),
        section: w?.section || 'Sewing',
        pay_type: w?.pay_type || 'piece_rate',
        operations_performed: Array.from(stats.opsSet).join(', ') || 'Sewing',
        pieces: stats.pcs,
        earnings: isSalaried ? null : stats.wages,
      };
    }).sort((a, b) => {
      if (a.earnings === null && b.earnings === null) return 0;
      if (a.earnings === null) return 1;
      if (b.earnings === null) return -1;
      return b.earnings - a.earnings;
    });

    return {
      summary: summaryRes,
      daily: dailyList,
      processes: processesList,
      workers: workersList,
    };
  };

  // Excel Export Handler
  const handleExportExcel = () => {
    if (!selectedStyle || !summary) return;

    const wb = XLSX.utils.book_new();
    const fromStr = fromDate || 'entire';
    const toStr = toDate || 'entire';

    // 1. Summary Sheet
    const summarySheetData = [
      { Metric: 'Garment Style Code', Value: selectedStyle.style_code },
      { Metric: 'Style Name', Value: selectedStyle.name },
      { Metric: 'Buyer', Value: selectedStyle.buyer_name || 'N/A' },
      { Metric: 'Report Date Range', Value: preset === 'entire' ? 'Entire Order History' : `${fromDate} to ${toDate}` },
      { Metric: 'Order Quantity', Value: summary.order_qty },
      { Metric: 'Total Cut Pieces', Value: summary.requires_cutting === false ? 'N/A (No Cutting Required)' : summary.total_cut },
      { Metric: 'Garments Sewn (Min Operation Completed)', Value: summary.garments_sewn },
      { Metric: 'Total Operation Steps Completed', Value: summary.total_operations },
      { Metric: 'Total Sewing Wages Paid', Value: `${currencySymbol}${(Number(summary.total_wages) || 0).toFixed(2)}` },
      { Metric: 'Finishing Received', Value: summary.finishing_received },
      { Metric: 'Ready to Deliver', Value: summary.ready_to_deliver },
      { Metric: 'Quoted Labour Cost / Garment', Value: `${currencySymbol}${(Number(summary.quoted_labour_cost_per_garment) || 0).toFixed(2)}` },
      { Metric: 'Actual Labour Cost / Garment', Value: `${currencySymbol}${(Number(summary.actual_labour_cost_per_garment) || 0).toFixed(2)}` },
      { Metric: 'Labour Cost Variance / Garment', Value: `${currencySymbol}${(Number(summary.variance) || 0).toFixed(2)}` },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // 2. Daily Sheet
    const dailySheetData = dailyData.map(d => ({
      Date: d.date,
      'Pieces Cut': d.cut,
      'Operation Steps': d.operations,
      'Sewing Wages': d.wages,
      'Finishing Received': d.finishing,
      'Ready to Deliver': d.ready,
      'Cumulative Cut': d.cum_cut || 0,
      'Cumulative Sewn': d.cum_sewn || 0,
      'Cumulative Finished': d.cum_finished || 0,
    }));
    const wsDaily = XLSX.utils.json_to_sheet(dailySheetData);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily');

    // 3. Operations Sheet
    const opsSheetData = processData.map(p => ({
      'Seq #': p.seq,
      Operation: p.operation,
      'Rate/Piece': p.rate,
      'Qty OK': p.qty,
      Rework: p.rework,
      Reject: p.reject,
      'Total Wages': p.wages,
      Workers: p.workers,
      Status: p.is_bottleneck ? 'BOTTLENECK' : 'Normal',
    }));
    const wsOps = XLSX.utils.json_to_sheet(opsSheetData);
    XLSX.utils.book_append_sheet(wb, wsOps, 'Operations');

    // 4. Workers Sheet
    const wrkSheetData = workerData.map(w => ({
      Worker: w.worker,
      Code: w.worker_code,
      Section: w.section,
      'Pay Type': w.pay_type === 'monthly_salary' ? 'Monthly Salary' : 'Piece Rate',
      'Operations Performed': w.operations_performed,
      'Pieces Completed': w.pieces,
      'Total Earnings': w.pay_type === 'monthly_salary' ? '' : (w.earnings !== null && w.earnings !== undefined ? `${currencySymbol}${(Number(w.earnings) || 0).toFixed(2)}` : ''),
    }));
    const wsWrk = XLSX.utils.json_to_sheet(wrkSheetData);
    XLSX.utils.book_append_sheet(wb, wsWrk, 'Workers');

    // 5. Size Breakdown Sheet (if present)
    if (sizeBreakdown && sizeBreakdown.length > 0) {
      const sbSheetData = sizeBreakdown.map(sb => ({
        Size: sb.size,
        'Order Qty': sb.order_qty,
        'Cut Qty': sb.cut_qty,
        'Ready to Deliver Qty': sb.ready_qty,
        'Cut Balance': sb.cut_balance,
        'Ready Balance': sb.ready_balance,
      }));
      const wsSb = XLSX.utils.json_to_sheet(sbSheetData);
      XLSX.utils.book_append_sheet(wb, wsSb, 'Size Breakdown');
    }

    const fileName = `StitchPay_${selectedStyle.style_code}_${fromStr}_${toStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  // Warnings check
  const requiresCutting = summary?.requires_cutting !== false && selectedStyle?.requires_cutting !== false;
  const showWarnFinishingVsCut = requiresCutting && summary && summary.finishing_received > summary.total_cut;
  const showWarnFinishingVsSewn = summary && summary.finishing_received > summary.garments_sewn;
  const showWarnCutVsOrder = requiresCutting && summary && summary.total_cut > summary.order_qty;

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto print:p-0 print:pb-0 print:max-w-none">
      
      {/* Printable Header (Visible during Print only) */}
      <div className="hidden print:block mb-6 border-b border-stone-300 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">{settings?.factory_name || 'StitchPay Garments Ltd.'}</h1>
            <h2 className="text-base font-bold text-stone-700">Style Journey & Cost Audit Report</h2>
          </div>
          <div className="text-right text-xs text-stone-600">
            <div>Style: <strong className="text-stone-900">{selectedStyle?.style_code} - {selectedStyle?.name}</strong></div>
            <div>Buyer: <strong>{selectedStyle?.buyer_name || 'N/A'}</strong></div>
            <div>Date Range: <strong>{preset === 'entire' ? 'Entire Order History' : `${fromDate} to ${toDate}`}</strong></div>
            <div>Printed On: <strong>{new Date().toLocaleDateString()}</strong></div>
          </div>
        </div>
      </div>

      {/* Screen Controls Header (Hidden during Print) */}
      <div className="bg-white border border-stone-200 p-5 rounded-3xl shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
              <PackageCheck className="w-6 h-6 text-indigo-700" />
              <span>Garment Style Journey Report</span>
            </h1>
            <p className="text-xs text-stone-600">Track end-to-end cutting, sewing & finishing output, cost variances & bottlenecks</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={loading || !selectedStyle}
              className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-4 py-2.5 rounded-xl transition-all text-xs disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Download Excel</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={loading || !selectedStyle}
              className="flex items-center space-x-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 font-bold px-4 py-2.5 rounded-xl transition-all text-xs disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-stone-700" />
              <span>Print A4 PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-stone-100 items-center">
          {/* Style Dropdown Selector */}
          <div className="md:col-span-5">
            <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">
              Select Garment Style
            </label>
            <select
              value={selectedStyleId}
              onChange={e => setSelectedStyleId(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm font-semibold text-stone-900 outline-none focus:border-indigo-600"
            >
              {styles.map(s => (
                <option key={s.id} value={s.id}>
                  {s.style_code} — {s.name} ({s.buyer_name || 'No Buyer'})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Date Presets */}
          <div className="md:col-span-7 flex flex-wrap items-center gap-1.5">
            <div className="w-full">
              <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                Date Preset
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handlePresetChange('entire')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    preset === 'entire'
                      ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Entire Order
                </button>
                <button
                  onClick={() => handlePresetChange('this_week')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    preset === 'this_week'
                      ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => handlePresetChange('this_month')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    preset === 'this_month'
                      ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => handlePresetChange('last_month')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    preset === 'last_month'
                      ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Last Month
                </button>
                <button
                  onClick={() => handlePresetChange('custom')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    preset === 'custom'
                      ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Custom Range
                </button>
              </div>
            </div>

            {/* Custom Date Inputs */}
            {preset === 'custom' && (
              <div className="flex items-center space-x-2 pt-1 w-full sm:w-auto">
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-stone-800 outline-none focus:border-indigo-600"
                />
                <span className="text-stone-400 text-xs">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-stone-800 outline-none focus:border-indigo-600"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECONCILIATION WARNING BANNERS */}
      {(showWarnFinishingVsCut || showWarnFinishingVsSewn || showWarnCutVsOrder) && (
        <div className="space-y-2">
          {showWarnFinishingVsCut && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-center space-x-3 text-rose-900 shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">Reconciliation Defect Alert</h4>
                <p className="text-xs font-semibold text-rose-800">
                  Finishing received more pieces ({summary.finishing_received.toLocaleString()}) than were cut ({summary.total_cut.toLocaleString()}).
                </p>
              </div>
            </div>
          )}

          {showWarnFinishingVsSewn && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-center space-x-3 text-rose-900 shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">Reconciliation Defect Alert</h4>
                <p className="text-xs font-semibold text-rose-800">
                  Finishing received more ({summary.finishing_received.toLocaleString()}) than sewing completed ({summary.garments_sewn.toLocaleString()}).
                </p>
              </div>
            </div>
          )}

          {showWarnCutVsOrder && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-center space-x-3 text-rose-900 shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">Reconciliation Defect Alert</h4>
                <p className="text-xs font-semibold text-rose-800">
                  More pieces cut ({summary.total_cut.toLocaleString()}) than ordered ({summary.order_qty.toLocaleString()}).
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. SUMMARY METRIC CARDS */}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* 1. Order Qty */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Order Qty</span>
              <span className="text-lg font-black text-stone-900 mt-0.5 font-mono block">
                {summary.order_qty.toLocaleString()} <span className="text-[10px] text-stone-400 font-sans">pcs</span>
              </span>
              <span className="text-[10px] text-stone-500">Target order</span>
            </div>

            {/* 2. Total Cut */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Total Cut</span>
              {requiresCutting ? (
                <span className="text-lg font-black text-sky-800 mt-0.5 font-mono block">
                  {summary.total_cut.toLocaleString()} <span className="text-[10px] text-stone-400 font-sans">pcs</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-stone-400 mt-1 block">N/A (No Cut)</span>
              )}
              <span className="text-[10px] text-stone-500">Cutting output</span>
            </div>

            {/* 3. Garments Sewn */}
            <div className="bg-white p-3.5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 shadow-2xs relative">
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block flex items-center justify-between">
                <span>Garments Sewn</span>
                <Info className="w-3 h-3 text-indigo-500 shrink-0" title="Minimum across all operations — a garment is only complete when every operation is done." />
              </span>
              <span className="text-lg font-black text-indigo-900 mt-0.5 font-mono block">
                {summary.garments_sewn.toLocaleString()} <span className="text-[10px] text-stone-400 font-sans">pcs</span>
              </span>
              <span className="text-[9px] text-indigo-700 font-medium leading-tight block mt-0.5">
                Min op complete
              </span>
            </div>

            {/* 4. Total Operations */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block flex items-center justify-between">
                <span>Total Ops</span>
                <Info className="w-3 h-3 text-stone-400 shrink-0" title="Total operations is the sum of all operation steps across all process steps." />
              </span>
              <span className="text-lg font-black text-stone-800 mt-0.5 font-mono block">
                {summary.total_operations.toLocaleString()} <span className="text-[10px] text-stone-400 font-sans">steps</span>
              </span>
              <span className="text-[9px] text-stone-500 font-medium leading-tight block mt-0.5">
                Sum of all op steps
              </span>
            </div>

            {/* 5. Total Wages */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Sewing Wages</span>
              <span className="text-lg font-black text-amber-800 mt-0.5 font-mono block">
                {currencySymbol}{summary.total_wages.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-stone-500">Total piece pay</span>
            </div>

            {/* 6. Finishing Received */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Finishing In</span>
              <span className="text-lg font-black text-purple-800 mt-0.5 font-mono block">
                {summary.finishing_received.toLocaleString()} <span className="text-[10px] text-stone-400 font-sans">pcs</span>
              </span>
              <span className="text-[10px] text-stone-500">Received in finish</span>
            </div>

            {/* 7. Ready to Deliver */}
            <div className="bg-white p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/20 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">Ready Deliver</span>
              <span className="text-lg font-black text-emerald-800 mt-0.5 font-mono block">
                {summary.ready_to_deliver.toLocaleString()} <span className="text-[10px] text-stone-400 font-sans">pcs</span>
              </span>
              <span className="text-[10px] text-emerald-700">Packed / Ready</span>
            </div>
          </div>

          {/* Labour Cost Comparison & Variance Card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  <span>Garment Labour Cost & Buyer Quote Audit</span>
                </h3>
                <p className="text-xs text-stone-500">Compare target process rates against actual piece rate expenditure to refine future buyer quotes.</p>
              </div>

              <div className="flex items-center space-x-6">
                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Quoted Labour Rate</span>
                  <span className="text-lg font-mono font-black text-stone-800">
                    {currencySymbol}{(Number(summary.quoted_labour_cost_per_garment) || 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-stone-500 block">Sum of process rates</span>
                </div>

                <div className="text-stone-300 text-lg font-light">/</div>

                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Actual Labour Rate</span>
                  <span className="text-lg font-mono font-black text-indigo-900">
                    {currencySymbol}{(Number(summary.actual_labour_cost_per_garment) || 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-stone-500 block">Total wages ÷ garments sewn</span>
                </div>

                <div className="border-l border-stone-200 pl-6">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Cost Variance</span>
                  <div className={`text-lg font-mono font-black flex items-center space-x-1 ${
                    summary.variance <= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {summary.variance <= 0 ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : (
                      <TrendingUp className="w-4 h-4" />
                    )}
                    <span>
                      {summary.variance > 0 ? '+' : ''}{currencySymbol}{(Number(summary.variance) || 0).toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500 block">
                    {summary.variance <= 0 ? 'Within target budget' : 'Over quoted target budget'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIZE BREAKDOWN SECTION */}
      {sizeBreakdown && sizeBreakdown.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
                <Scissors className="w-4 h-4 text-sky-700" />
                <span>Size Breakdown Analysis</span>
              </h3>
              <p className="text-xs text-stone-500">
                Size level tracking for Order Qty, Cutting Output, Ready to Deliver & Balances.
              </p>
            </div>
            <div className="text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-xl border border-stone-200 self-start sm:self-auto">
              Total Sizes: {sizeBreakdown.length}
            </div>
          </div>

          <div className="overflow-x-auto border border-stone-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 font-bold text-stone-700 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-3 text-right">Order Qty</th>
                  <th className="py-3 px-3 text-right">Cut Qty</th>
                  <th className="py-3 px-3 text-right">Cut Balance</th>
                  <th className="py-3 px-3 text-right">Ready to Deliver</th>
                  <th className="py-3 px-3 text-right">Ready Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono">
                {sizeBreakdown.map((sb) => {
                  const isOverCut = sb.cut_qty > sb.order_qty;
                  const isOverReady = sb.ready_qty > sb.order_qty;
                  return (
                    <tr key={sb.size} className="hover:bg-stone-50/80">
                      <td className="py-2.5 px-4 font-bold font-sans text-stone-900">
                        <span className="bg-stone-100 border border-stone-200 px-2 py-0.5 rounded text-xs font-mono font-black">
                          {sb.size}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-stone-900">{sb.order_qty.toLocaleString()}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isOverCut ? 'text-amber-800' : 'text-sky-800'}`}>
                        {sb.cut_qty.toLocaleString()}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${sb.cut_balance < 0 ? 'text-amber-800' : sb.cut_balance === 0 ? 'text-emerald-700' : 'text-stone-600'}`}>
                        {sb.cut_balance < 0 ? `+${Math.abs(sb.cut_balance)} over` : sb.cut_balance.toLocaleString()}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isOverReady ? 'text-amber-800' : 'text-emerald-800'}`}>
                        {sb.ready_qty.toLocaleString()}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${sb.ready_balance < 0 ? 'text-amber-800' : sb.ready_balance === 0 ? 'text-emerald-700' : 'text-stone-600'}`}>
                        {sb.ready_balance < 0 ? `+${Math.abs(sb.ready_balance)} over` : sb.ready_balance.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-stone-50/90 border-t-2 border-stone-200 font-bold text-stone-900 text-xs">
                <tr>
                  <td className="py-2.5 px-4 font-bold font-sans">Total</td>
                  <td className="py-2.5 px-3 text-right font-mono font-black">
                    {sizeBreakdown.reduce((sum, s) => sum + s.order_qty, 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-sky-800">
                    {sizeBreakdown.reduce((sum, s) => sum + s.cut_qty, 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black">
                    {sizeBreakdown.reduce((sum, s) => sum + s.cut_balance, 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800">
                    {sizeBreakdown.reduce((sum, s) => sum + s.ready_qty, 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black">
                    {sizeBreakdown.reduce((sum, s) => sum + s.ready_balance, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 3. DAILY TABLE & MULTI-LINE CUMULATIVE CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Multi-line cumulative chart */}
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-stone-900">Cumulative Production Journey</h3>
              <p className="text-xs text-stone-500">
                Divergent lines pinpoint WIP accumulation between Cut, Sewn & Finished stages.
              </p>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="date" stroke="#78716c" fontSize={10} />
                <YAxis stroke="#78716c" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e7e5e4', color: '#1c1917', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {requiresCutting && (
                  <Line type="monotone" dataKey="cum_cut" name="Cumulative Cut" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3 }} />
                )}
                <Line type="monotone" dataKey="cum_sewn" name="Cumulative Operations" stroke="#4338ca" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cum_finished" name="Cumulative Finished" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Log Table */}
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col">
          <h3 className="text-base font-bold text-stone-900 mb-1">Daily Log Breakdown</h3>
          <p className="text-xs text-stone-500 mb-3">Daily output count & wages</p>

          <div className="flex-1 overflow-y-auto max-h-72 border border-stone-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 sticky top-0 font-bold text-stone-700 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  {requiresCutting && <th className="py-2.5 px-2">Cut</th>}
                  <th className="py-2.5 px-2">Ops</th>
                  <th className="py-2.5 px-2">Wages</th>
                  <th className="py-2.5 px-2">Ready</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono">
                {dailyData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-stone-400 font-sans text-xs">
                      No daily records found for this period.
                    </td>
                  </tr>
                ) : (
                  dailyData.map((d, i) => (
                    <tr key={i} className="hover:bg-stone-50/80">
                      <td className="py-2 px-3 font-semibold text-stone-900 font-sans">{d.date}</td>
                      {requiresCutting && <td className="py-2 px-2 text-sky-800">{d.cut}</td>}
                      <td className="py-2 px-2 text-indigo-900">{d.operations}</td>
                      <td className="py-2 px-2 text-amber-800 font-bold">{currencySymbol}{(Number(d.wages) || 0).toFixed(0)}</td>
                      <td className="py-2 px-2 text-emerald-800 font-bold">{d.ready}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. OPERATION PROCESS BREAKDOWN TABLE */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-700" />
              <span>Sewing Operations & Line Bottlenecks</span>
            </h3>
            <p className="text-xs text-stone-500">Sorted by operation sequence. The lowest output step is highlighted as the line bottleneck.</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-stone-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 font-bold text-stone-700 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Seq #</th>
                <th className="py-3 px-4">Operation Process</th>
                <th className="py-3 px-3">Rate/Piece</th>
                <th className="py-3 px-3">Qty OK</th>
                <th className="py-3 px-3">Rework</th>
                <th className="py-3 px-3">Reject</th>
                <th className="py-3 px-3">Total Wages</th>
                <th className="py-3 px-3">Workers</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {processData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-400 font-sans text-xs">
                    No operations defined or recorded for this style.
                  </td>
                </tr>
              ) : (
                processData.map((p, idx) => (
                  <tr 
                    key={idx} 
                    className={`transition-all ${
                      p.is_bottleneck 
                        ? 'bg-amber-50/70 hover:bg-amber-50 font-semibold' 
                        : 'hover:bg-stone-50/80'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono text-stone-500 font-bold">#{p.seq}</td>
                    <td className="py-2.5 px-4 font-bold text-stone-900 flex items-center space-x-2">
                      <span>{p.operation}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-stone-700 font-semibold">
                      {currencySymbol}{(Number(p.rate) || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-indigo-900 font-bold">
                      {p.qty.toLocaleString()} <span className="text-[10px] text-stone-400 font-sans font-normal">pcs</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-amber-700">
                      {p.rework > 0 ? p.rework : '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-rose-700 font-bold">
                      {p.reject > 0 ? p.reject : '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-800 font-bold">
                      {currencySymbol}{p.wages.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-stone-600 font-sans">
                      {p.workers}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      {p.is_bottleneck ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>BOTTLENECK</span>
                        </span>
                      ) : (
                        <span className="text-stone-400 text-[10px]">Normal</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. WORKER PERFORMANCE TABLE */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Worker Performance & Piece Rate Audit</span>
            </h3>
            <p className="text-xs text-stone-500">Sorted by earnings descending. Monthly-salaried worker earnings are left blank per factory policy.</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-stone-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 font-bold text-stone-700 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Worker</th>
                <th className="py-3 px-3">Code</th>
                <th className="py-3 px-3">Section</th>
                <th className="py-3 px-3">Pay Type</th>
                <th className="py-3 px-4">Operations Performed</th>
                <th className="py-3 px-3">Pieces Done</th>
                <th className="py-3 px-4 text-right">Total Piece Earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {workerData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400 font-sans text-xs">
                    No worker performance records logged for this style.
                  </td>
                </tr>
              ) : (
                workerData.map((w, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/80">
                    <td className="py-2.5 px-4 font-bold text-stone-900">{w.worker}</td>
                    <td className="py-2.5 px-3 font-mono text-stone-500 font-medium">{w.worker_code}</td>
                    <td className="py-2.5 px-3 text-stone-600">{w.section}</td>
                    <td className="py-2.5 px-3">
                      {w.pay_type === 'monthly_salary' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          Monthly Salary
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                          Piece Rate
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-stone-600 text-[11px]">{w.operations_performed}</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-900 font-bold">{w.pieces.toLocaleString()} pcs</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-800">
                      {w.pay_type === 'monthly_salary' ? (
                        <span className="text-stone-300 font-normal font-sans">-</span>
                      ) : (
                        w.earnings !== null ? `${currencySymbol}${w.earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
