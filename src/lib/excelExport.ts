import * as XLSX from 'xlsx';
import { DailyAssignment, ProductionEntry, GarmentStyle, GarmentProcess, Worker, AttendanceRecord, FactorySettings } from '../types';
import { dataService } from './dataService';
import { showErrorToast } from './toast';

export async function exportDailyPlanExcel(selectedDate: string): Promise<void> {
  const [settings, assignments, styles, processes, workers] = await Promise.all([
    dataService.getSettings(),
    dataService.getDailyAssignments(selectedDate),
    dataService.getStyles(),
    dataService.getProcesses(),
    dataService.getWorkers(),
  ]);

  if (!assignments || assignments.length === 0) {
    showErrorToast(`No production plan data found for ${selectedDate}`);
    return;
  }

  const currencySymbol = settings.currency_symbol || 'MYR';
  const stylesMap = new Map(styles.map(s => [s.id, s]));
  const processesMap = new Map(processes.map(p => [p.id, p]));
  const workersMap = new Map(workers.map(w => [w.id, w]));

  const dateParts = selectedDate.split('-');
  const dateObj = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
  const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

  const uniqueWorkerIds = new Set(assignments.map(a => a.worker_id).filter(Boolean));

  const assignmentsByStyle = new Map<string, DailyAssignment[]>();
  assignments.forEach(a => {
    const sId = a.style_id || 'unknown';
    if (!assignmentsByStyle.has(sId)) {
      assignmentsByStyle.set(sId, []);
    }
    assignmentsByStyle.get(sId)!.push(a);
  });

  const rows: any[][] = [];

  // Header Block
  rows.push([settings.factory_name || 'StitchPay Factory']);
  rows.push(['DAILY PRODUCTION PLAN']);
  rows.push(['Date:', selectedDate, 'Day:', dayOfWeek, 'Total Workers Assigned:', uniqueWorkerIds.size]);
  rows.push([]);

  let totalPlanTargetQty = 0;
  let totalPlanEstWageCost = 0;

  assignmentsByStyle.forEach((styleAssignments, styleId) => {
    const style = stylesMap.get(styleId);
    const styleCode = style?.style_code || 'N/A';
    const styleName = style?.name || 'Unknown Style';
    const buyer = style?.buyer_name || 'N/A';
    const orderQty = style?.order_qty || 0;

    rows.push([`Style Code: ${styleCode}`, `Style Name: ${styleName}`, `Buyer: ${buyer}`, `Order Qty: ${orderQty}`]);

    rows.push([
      'Seq',
      'Operation',
      'Machine',
      'Worker Code',
      'Worker Name',
      'Line',
      `Rate/pc (${currencySymbol})`,
      'Target Qty',
      'Actual Qty',
      'Signature'
    ]);

    styleAssignments.sort((a, b) => {
      const pA = processesMap.get(a.process_id);
      const pB = processesMap.get(b.process_id);
      return (pA?.seq_no || 0) - (pB?.seq_no || 0);
    });

    const styleWorkers = new Set<string>();
    let styleTargetQty = 0;
    let styleEstCost = 0;

    styleAssignments.forEach(a => {
      const proc = processesMap.get(a.process_id);
      const wrk = workersMap.get(a.worker_id);

      if (a.worker_id) styleWorkers.add(a.worker_id);
      const rate = a.agreed_rate ?? proc?.rate ?? 0;
      const targetQty = a.target_qty || 0;
      const estCost = targetQty * rate;

      styleTargetQty += targetQty;
      styleEstCost += estCost;

      rows.push([
        proc?.seq_no || '-',
        proc?.name || 'N/A',
        proc?.machine_type || 'N/A',
        wrk?.worker_code || a.worker_code || 'N/A',
        wrk?.full_name || a.worker_name || 'Unassigned',
        wrk?.section || 'Line 1',
        rate,
        targetQty,
        '', // Empty Actual Qty for manual paper backup fill
        ''  // Empty Signature for manual paper backup fill
      ]);
    });

    totalPlanTargetQty += styleTargetQty;
    totalPlanEstWageCost += styleEstCost;

    rows.push([
      'Summary:',
      `Total Workers: ${styleWorkers.size}`,
      '',
      '',
      '',
      '',
      'Total Target:',
      styleTargetQty,
      'Est. Wage Cost:',
      `${currencySymbol} ${styleEstCost.toFixed(2)}`
    ]);
    rows.push([]);
  });

  rows.push([
    'OVERALL TOTALS',
    `Total Workers: ${uniqueWorkerIds.size}`,
    '',
    '',
    '',
    '',
    'Total Plan Target:',
    totalPlanTargetQty,
    'Total Est. Cost:',
    `${currencySymbol} ${totalPlanEstWageCost.toFixed(2)}`
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  const colWidths = rows.reduce((acc: number[], row: any[]) => {
    row.forEach((val, colIdx) => {
      const len = val ? String(val).length : 0;
      acc[colIdx] = Math.max(acc[colIdx] || 12, Math.min(len + 3, 35));
    });
    return acc;
  }, []);
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Production Plan');
  XLSX.writeFile(wb, `StitchPay_Plan_${selectedDate}.xlsx`);
}

export async function exportDailyReportExcel(selectedDate: string): Promise<void> {
  const [settings, assignments, entries, styles, processes, workers, attendance] = await Promise.all([
    dataService.getSettings(),
    dataService.getDailyAssignments(selectedDate),
    dataService.getProductionEntries(),
    dataService.getStyles(),
    dataService.getProcesses(),
    dataService.getWorkers(),
    dataService.getAttendance(selectedDate),
  ]);

  const dateEntries = entries.filter(e => e.entry_date === selectedDate);

  if ((!assignments || assignments.length === 0) && dateEntries.length === 0) {
    showErrorToast(`No production report data found for ${selectedDate}`);
    return;
  }

  const currencySymbol = settings.currency_symbol || 'MYR';
  const stylesMap = new Map(styles.map(s => [s.id, s]));
  const processesMap = new Map(processes.map(p => [p.id, p]));
  const workersMap = new Map(workers.map(w => [w.id, w]));

  const wb = XLSX.utils.book_new();

  // --- SHEET 1: Summary ---
  const styleCompletedMap = new Map<string, number>();
  const activeStyleIds = new Set([
    ...assignments.map(a => a.style_id).filter(Boolean),
    ...dateEntries.map(e => e.style_id).filter(Boolean)
  ]);

  activeStyleIds.forEach(styleId => {
    const styleProcs = processes.filter(p => p.style_id === styleId);
    if (styleProcs.length === 0) {
      styleCompletedMap.set(styleId, 0);
      return;
    }
    const procOutputs = styleProcs.map(proc => {
      const procEntries = dateEntries.filter(e => e.process_id === proc.id);
      return procEntries.reduce((sum, e) => sum + (e.qty_ok || 0), 0);
    });
    const minOutput = procOutputs.length > 0 ? Math.min(...procOutputs) : 0;
    styleCompletedMap.set(styleId, minOutput);
  });

  const totalOpsCompleted = dateEntries.length;
  const totalWageCost = dateEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'half_day').length;
  const absentCount = attendance.filter(a => a.status === 'absent' || a.status === 'leave').length;

  const totalTargetQty = assignments.reduce((sum, a) => sum + (a.target_qty || 0), 0);
  const totalActualQty = dateEntries.reduce((sum, e) => sum + (e.qty_ok || 0), 0);
  const overallAchievement = totalTargetQty > 0 ? ((totalActualQty / totalTargetQty) * 100).toFixed(1) + '%' : '0.0%';

  const summaryRows: any[][] = [
    ['DAILY PRODUCTION REPORT - SUMMARY'],
    ['Date:', selectedDate],
    ['Total Operations Completed:', totalOpsCompleted],
    ['Total Wage Cost:', `${currencySymbol} ${totalWageCost.toFixed(2)}`],
    ['Workers Present:', presentCount],
    ['Workers Absent:', absentCount],
    ['Overall Target Achievement:', overallAchievement],
    ['Total Target Qty:', totalTargetQty],
    ['Total Actual Qty (OK):', totalActualQty],
    [],
    ['Completed Garments Per Style (Minimum Output Across Full Process Sequence):'],
    ['Style Code', 'Style Name', 'Buyer', 'Completed Garments (Full Sequence Min)']
  ];

  activeStyleIds.forEach(styleId => {
    const s = stylesMap.get(styleId);
    summaryRows.push([
      s?.style_code || 'N/A',
      s?.name || 'Unknown',
      s?.buyer_name || 'N/A',
      styleCompletedMap.get(styleId) || 0
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 30 }, { wch: 20 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // --- SHEET 2: By Worker ---
  const workerStatsMap = new Map<string, {
    code: string;
    name: string;
    section: string;
    line: string;
    operations: Set<string>;
    totalPieces: number;
    rework: number;
    reject: number;
    earnings: number;
  }>();

  dateEntries.forEach(e => {
    const wId = e.worker_id;
    const w = workersMap.get(wId);
    const proc = processesMap.get(e.process_id);

    if (!workerStatsMap.has(wId)) {
      workerStatsMap.set(wId, {
        code: w?.worker_code || e.worker_code || 'N/A',
        name: w?.full_name || e.worker_name || 'Unknown',
        section: w?.section || 'Line 1',
        line: w?.line_no || w?.section || 'Line 1',
        operations: new Set(),
        totalPieces: 0,
        rework: 0,
        reject: 0,
        earnings: 0
      });
    }
    const stat = workerStatsMap.get(wId)!;
    if (proc?.name) stat.operations.add(proc.name);
    stat.totalPieces += (e.qty_ok || 0);
    stat.rework += (e.qty_rework || 0);
    stat.reject += (e.qty_reject || 0);
    stat.earnings += (e.amount || 0);
  });

  assignments.forEach(a => {
    if (a.worker_id && !workerStatsMap.has(a.worker_id)) {
      const w = workersMap.get(a.worker_id);
      const proc = processesMap.get(a.process_id);
      workerStatsMap.set(a.worker_id, {
        code: w?.worker_code || a.worker_code || 'N/A',
        name: w?.full_name || a.worker_name || 'Unknown',
        section: w?.section || 'Line 1',
        line: w?.line_no || w?.section || 'Line 1',
        operations: proc?.name ? new Set([proc.name]) : new Set(),
        totalPieces: 0,
        rework: 0,
        reject: 0,
        earnings: 0
      });
    }
  });

  const workerList = Array.from(workerStatsMap.values()).sort((a, b) => b.earnings - a.earnings);

  const workerRows: any[][] = [
    ['Worker Code', 'Name', 'Section', 'Line', 'Operations Performed', 'Total Pieces', 'Rework', 'Reject', `Total Earnings (${currencySymbol})`]
  ];

  workerList.forEach(w => {
    workerRows.push([
      w.code,
      w.name,
      w.section,
      w.line,
      Array.from(w.operations).join(', '),
      w.totalPieces,
      w.rework,
      w.reject,
      w.earnings
    ]);
  });

  const wsWorker = XLSX.utils.aoa_to_sheet(workerRows);
  wsWorker['!cols'] = [
    { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 35 },
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsWorker, 'By Worker');

  // --- SHEET 3: By Operation ---
  const opStatsMap = new Map<string, {
    styleCode: string;
    seq: number;
    operation: string;
    workersAssigned: Set<string>;
    targetQty: number;
    actualQty: number;
    rework: number;
    reject: number;
    wageCost: number;
  }>();

  assignments.forEach(a => {
    const proc = processesMap.get(a.process_id);
    const style = stylesMap.get(a.style_id);
    const pId = a.process_id || 'unknown';

    if (!opStatsMap.has(pId)) {
      opStatsMap.set(pId, {
        styleCode: style?.style_code || a.style_code || 'N/A',
        seq: proc?.seq_no || 0,
        operation: proc?.name || a.process_name || 'N/A',
        workersAssigned: new Set(),
        targetQty: 0,
        actualQty: 0,
        rework: 0,
        reject: 0,
        wageCost: 0
      });
    }
    const stat = opStatsMap.get(pId)!;
    if (a.worker_id) stat.workersAssigned.add(a.worker_id);
    stat.targetQty += (a.target_qty || 0);
  });

  dateEntries.forEach(e => {
    const proc = processesMap.get(e.process_id);
    const style = stylesMap.get(e.style_id);
    const pId = e.process_id || 'unknown';

    if (!opStatsMap.has(pId)) {
      opStatsMap.set(pId, {
        styleCode: style?.style_code || 'N/A',
        seq: proc?.seq_no || 0,
        operation: proc?.name || e.process_name || 'N/A',
        workersAssigned: new Set(),
        targetQty: 0,
        actualQty: 0,
        rework: 0,
        reject: 0,
        wageCost: 0
      });
    }
    const stat = opStatsMap.get(pId)!;
    if (e.worker_id) stat.workersAssigned.add(e.worker_id);
    stat.actualQty += (e.qty_ok || 0);
    stat.rework += (e.qty_rework || 0);
    stat.reject += (e.qty_reject || 0);
    stat.wageCost += (e.amount || 0);
  });

  const opList = Array.from(opStatsMap.values()).map(op => {
    const achievePct = op.targetQty > 0 ? (op.actualQty / op.targetQty) * 100 : (op.actualQty > 0 ? 100 : 0);
    return { ...op, achievePct };
  }).sort((a, b) => a.achievePct - b.achievePct); // Sorted by achievement % ascending -> bottleneck is first row

  const opRows: any[][] = [
    ['Style', 'Seq', 'Operation', 'Workers Assigned', 'Target Qty', 'Actual Qty', 'Achievement %', 'Rework', 'Reject', `Wage Cost (${currencySymbol})`]
  ];

  opList.forEach(op => {
    opRows.push([
      op.styleCode,
      op.seq,
      op.operation,
      op.workersAssigned.size,
      op.targetQty,
      op.actualQty,
      `${op.achievePct.toFixed(1)}%`,
      op.rework,
      op.reject,
      op.wageCost
    ]);
  });

  const wsOp = XLSX.utils.aoa_to_sheet(opRows);
  wsOp['!cols'] = [
    { wch: 15 }, { wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsOp, 'By Operation');

  // --- SHEET 4: Detail ---
  const detailRows: any[][] = [
    ['Date', 'Worker Code', 'Name', 'Style', 'Operation', 'Qty OK', 'Qty Rework', 'Qty Reject', `Rate (${currencySymbol})`, `Amount (${currencySymbol})`]
  ];

  dateEntries.forEach(e => {
    const w = workersMap.get(e.worker_id);
    const s = stylesMap.get(e.style_id);
    const p = processesMap.get(e.process_id);

    detailRows.push([
      e.entry_date,
      w?.worker_code || e.worker_code || 'N/A',
      w?.full_name || e.worker_name || 'Unknown',
      s?.style_code || 'N/A',
      p?.name || e.process_name || 'N/A',
      e.qty_ok,
      e.qty_rework,
      e.qty_reject,
      e.rate_snapshot,
      e.amount
    ]);
  });

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 25 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail');

  XLSX.writeFile(wb, `StitchPay_Report_${selectedDate}.xlsx`);
}
