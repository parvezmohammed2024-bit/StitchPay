import React, { useState, useEffect } from 'react';
import { Printer, AlertCircle, ArrowRight, Check, X, FileText, Calendar } from 'lucide-react';
import { GarmentStyle, GarmentProcess, Worker, FactorySettings, DailyAssignment } from '../types';
import { dataService } from '../lib/dataService';

interface PrintTallySheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryDate: string;
  shift: 'day' | 'night';
  selectedStyleId: string;
  styles: GarmentStyle[];
  workers: Worker[];
  settings: FactorySettings | null;
  onNavigate?: (screen: string) => void;
}

interface PrintableStyleData {
  style: GarmentStyle;
  processes: GarmentProcess[];
  assignments: DailyAssignment[];
  assignedWorkers: Worker[];
}

export const PrintTallySheetModal: React.FC<PrintTallySheetModalProps> = ({
  isOpen,
  onClose,
  entryDate,
  shift,
  selectedStyleId,
  styles,
  workers,
  settings,
  onNavigate,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [printableDataList, setPrintableDataList] = useState<PrintableStyleData[]>([]);
  const [printAllStyles, setPrintAllStyles] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadPrintData();
    }
  }, [isOpen, entryDate, shift, selectedStyleId, printAllStyles]);

  const loadPrintData = async () => {
    setLoading(true);
    try {
      const allDateAssignments = await dataService.getDailyAssignments(entryDate);
      
      // Determine which styles to include
      let targetStyles: GarmentStyle[] = [];
      if (printAllStyles) {
        // Find styles that have assignments for this date
        const styleIdsWithAssign = new Set(allDateAssignments.map(a => a.style_id));
        targetStyles = styles.filter(s => styleIdsWithAssign.has(s.id));
      } else {
        const curStyle = styles.find(s => s.id === selectedStyleId);
        if (curStyle) {
          targetStyles = [curStyle];
        }
      }

      const results: PrintableStyleData[] = [];

      for (const style of targetStyles) {
        const styleAssignments = allDateAssignments.filter(a => a.style_id === style.id);
        if (styleAssignments.length === 0) continue;

        const assignedWorkerIds = new Set(styleAssignments.map(a => a.worker_id));
        const assignedWorkers = workers.filter(w => assignedWorkerIds.has(w.id));
        const processes = await dataService.getProcesses(style.id);

        if (assignedWorkers.length > 0 && processes.length > 0) {
          results.push({
            style,
            processes,
            assignments: styleAssignments,
            assignedWorkers,
          });
        }
      }

      setPrintableDataList(results);
    } catch (err) {
      console.error('Error loading print data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (printableDataList.length === 0) return;
    
    // Trigger browser print dialog directly
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (!isOpen) return null;

  // Day of week calculation
  const dateObj = new Date(entryDate);
  const dayOfWeek = isNaN(dateObj.getTime())
    ? ''
    : dateObj.toLocaleDateString('en-US', { weekday: 'long' });

  const hasNoAssignments = !loading && printableDataList.length === 0;

  return (
    <>
      {/* 1. SCREEN UI MODAL (HIDDEN ON PRINT) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 print:hidden">
        <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900">Print Paper Tally Sheet</h3>
                <p className="text-xs text-stone-500">Floor offline backup document (A4 Landscape)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-stone-500 text-xs space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p>Preparing tally sheet preview...</p>
            </div>
          ) : hasNoAssignments ? (
            /* NO ASSIGNMENTS WARNING STATE */
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-stone-900">
                  No assignments for this date — set up the line first
                </h4>
                <p className="text-xs text-stone-600 max-w-xs mx-auto">
                  There are no active worker assignments on <span className="font-mono font-bold">{entryDate}</span> to populate the paper tally sheet matrix.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate('dailySetup');
                    }}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-2xl text-xs transition-all shadow-xs flex items-center justify-center space-x-2"
                  >
                    <span>Go to Daily Line Setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 font-bold px-4 py-2.5 rounded-2xl text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* PRINT OPTIONS & PREVIEW DETAILS */
            <div className="space-y-4">
              {/* Info summary */}
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs space-y-2">
                <div className="flex justify-between items-center text-stone-800 font-bold border-b border-stone-200 pb-2">
                  <span className="flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-amber-800" />
                    <span>Target Date: {entryDate} ({dayOfWeek})</span>
                  </span>
                  <span className="uppercase text-[10px] bg-stone-200 px-2 py-0.5 rounded font-mono text-stone-800">
                    {shift === 'day' ? 'Day Shift' : 'Night Shift'}
                  </span>
                </div>

                <div className="text-stone-600 space-y-1 pt-1">
                  <div>Factory Name: <strong className="text-stone-900">{settings?.factory_name || 'Garment Factory Ltd.'}</strong></div>
                  <div>Sheets to Print: <strong className="text-amber-800">{printableDataList.length} style sheet(s)</strong></div>
                </div>
              </div>

              {/* Sheets per page option */}
              <div className="bg-amber-50/60 border border-amber-200 p-3.5 rounded-2xl space-y-2">
                <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">Sheets per page option</div>
                <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-stone-800 select-none">
                  <input
                    type="checkbox"
                    checked={printAllStyles}
                    onChange={(e) => setPrintAllStyles(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-stone-300 text-amber-800 focus:ring-amber-700"
                  />
                  <div>
                    <span className="font-bold text-stone-900 block">Print all active styles for this date in one go</span>
                    <span className="text-[11px] text-stone-600 block">
                      {printAllStyles
                        ? 'Includes one A4 landscape sheet per style with assignments on this date.'
                        : 'Default: Prints only the currently selected style sheet.'}
                    </span>
                  </div>
                </label>
              </div>

              {/* List of included styles */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Sheets Preview:</div>
                <div className="max-h-36 overflow-y-auto divide-y divide-stone-200 border border-stone-200 rounded-2xl bg-stone-50 text-xs">
                  {printableDataList.map((data, idx) => (
                    <div key={data.style.id} className="p-2.5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-bold text-stone-900">
                          {idx + 1}. {data.style.style_code} — {data.style.name}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          Buyer: {data.style.buyer_name || 'N/A'} • {data.assignedWorkers.length} workers • {data.processes.length} operations
                        </div>
                      </div>
                      <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                        A4 Sheet
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-stone-500 italic bg-stone-100 p-2.5 rounded-xl border border-stone-200">
                🔒 Note: Piece rates are omitted from printed sheets for floor circulation safety.
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-2xl text-xs shadow-xs flex items-center space-x-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Tally Sheet</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. PRINT-ONLY DOM CONTAINER (A4 LANDSCAPE FORMAT) */}
      <div id="printable-tally-sheet-root" className="hidden print:block font-mono text-black bg-white p-0">
        <style>{`
          @media print {
            @page {
              size: A4 landscape;
              margin: 6mm;
            }
            body {
              background: #ffffff !important;
              color: #000000 !important;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #root > *:not(#printable-tally-sheet-root) {
              display: none !important;
            }
            #printable-tally-sheet-root {
              display: block !important;
              width: 100% !important;
            }
            .tally-page-break {
              break-after: page;
              page-break-after: always;
            }
          }
        `}</style>

        {printableDataList.map((data, idx) => (
          <div
            key={data.style.id}
            className={`p-2 bg-white text-black text-[11px] ${
              idx < printableDataList.length - 1 ? 'tally-page-break' : ''
            }`}
          >
            {/* 1. HEADER SECTION */}
            <div className="border-2 border-black p-2.5 mb-2.5 bg-white">
              <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
                <div>
                  <div className="text-sm font-black uppercase tracking-wider">
                    {settings?.factory_name || 'GARMENT FACTORY LTD.'}
                  </div>
                  <div className="text-base font-black tracking-tight mt-0.5">
                    DAILY PRODUCTION TALLY
                  </div>
                </div>
                <div className="text-right text-[10px] font-mono">
                  <div className="font-bold">DATE: {entryDate} ({dayOfWeek})</div>
                  <div>SHIFT: {shift === 'day' ? 'DAY SHIFT' : 'NIGHT SHIFT'}</div>
                </div>
              </div>

              {/* Style & Buyer Metadata */}
              <div className="grid grid-cols-4 gap-2 text-[10px] font-bold border-b border-black pb-1.5 mb-2">
                <div>
                  <span className="text-stone-600 block text-[8px] uppercase">Style Code & Name</span>
                  <span>{data.style.style_code} — {data.style.name}</span>
                </div>
                <div>
                  <span className="text-stone-600 block text-[8px] uppercase">Buyer Name</span>
                  <span>{data.style.buyer_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-stone-600 block text-[8px] uppercase">Order Qty</span>
                  <span>{data.style.order_qty ? `${data.style.order_qty} pcs` : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-stone-600 block text-[8px] uppercase">Form Ref</span>
                  <span>TALLY-{entryDate.replace(/-/g, '')}</span>
                </div>
              </div>

              {/* Blank Lines for Hand-Writing */}
              <div className="grid grid-cols-2 gap-4 text-[11px] font-bold pt-0.5">
                <div>Supervisor: ____________________________________</div>
                <div>Line: ________________________________________</div>
              </div>
            </div>

            {/* 2. MATRIX TABLE */}
            <table className="w-full border-collapse border-2 border-black text-center text-[10px] font-mono">
              <thead>
                <tr className="border-b-2 border-black bg-stone-100 font-black">
                  <th className="border-r-2 border-black p-1.5 text-left w-36 uppercase">
                    Worker Name & Code
                  </th>
                  {data.processes.map(proc => {
                    const procAssignments = data.assignments.filter(a => a.process_id === proc.id);
                    const sampleTarget = procAssignments[0]?.target_qty || 250;
                    return (
                      <th key={proc.id} className="border-r border-black p-1 leading-tight">
                        <div className="font-bold text-[10px] uppercase">{proc.name}</div>
                        <div className="text-[8px] font-normal text-stone-700">Target: {sampleTarget}</div>
                        {/* NO PIECE RATES PRINTED */}
                      </th>
                    );
                  })}
                  <th className="border-r border-black p-1.5 w-20 uppercase font-black">
                    Row Total
                  </th>
                  <th className="p-1.5 w-28 uppercase font-black">
                    Worker Signature
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.assignedWorkers.map((worker, wIdx) => {
                  const isEven = wIdx % 2 === 0;
                  return (
                    <tr
                      key={worker.id}
                      className={`border-b border-black ${isEven ? 'bg-white' : 'bg-stone-100/70'}`}
                      style={{ height: '11mm', minHeight: '40px' }} // Minimum 10mm height rule
                    >
                      {/* Worker Column */}
                      <td className="border-r-2 border-black p-1 text-left font-bold text-[9px]">
                        <div className="truncate max-w-[135px]">{worker.full_name}</div>
                        <div className="text-[8px] font-mono text-stone-600">{worker.worker_code}</div>
                      </td>

                      {/* Operation Cells */}
                      {data.processes.map(proc => {
                        const isAssigned = data.assignments.some(
                          a => a.worker_id === worker.id && a.process_id === proc.id
                        );
                        return (
                          <td
                            key={proc.id}
                            className="border-r border-black p-1 text-center align-middle"
                          >
                            {isAssigned ? (
                              /* Empty ruled box for hand-writing */
                              <div className="w-full h-full min-h-[30px]"></div>
                            ) : (
                              /* Non-assigned indicator */
                              <div className="text-stone-300 font-light text-xs select-none">—</div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Total Box */}
                      <td className="border-r border-black p-1">
                        <div className="w-full h-full min-h-[30px]"></div>
                      </td>

                      {/* Worker Signature Box */}
                      <td className="p-1">
                        <div className="w-full h-full min-h-[30px]"></div>
                      </td>
                    </tr>
                  );
                })}

                {/* BOTTOM ROW: COLUMN TOTALS */}
                <tr className="border-t-2 border-black bg-stone-100 font-bold" style={{ height: '11mm', minHeight: '40px' }}>
                  <td className="border-r-2 border-black p-1.5 text-left uppercase text-[9px]">
                    COLUMN TOTALS
                  </td>
                  {data.processes.map(proc => (
                    <td key={proc.id} className="border-r border-black p-1">
                      <div className="w-full h-full min-h-[30px]"></div>
                    </td>
                  ))}
                  <td className="border-r border-black p-1">
                    <div className="w-full h-full min-h-[30px]"></div>
                  </td>
                  <td className="p-1"></td>
                </tr>
              </tbody>
            </table>

            {/* 3. FOOTER SIGNATURES */}
            <div className="mt-3 pt-2 border-t-2 border-black grid grid-cols-2 gap-8 text-[11px] font-bold">
              <div>Checked by: ________________________________________</div>
              <div>Date: ____________________________________</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
