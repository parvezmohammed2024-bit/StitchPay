import React, { useState, useEffect } from 'react';
import { Table, Calendar, Save, CheckCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { GarmentStyle, GarmentProcess, Worker, FactorySettings, UserRole } from '../types';
import { WorkerAvatar } from '../components/WorkerAvatar';

interface BulkGridScreenProps {
  role: UserRole;
}

export const BulkGridScreen: React.FC<BulkGridScreenProps> = ({ role }) => {
  const { t } = useTranslation();

  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);

  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<'day' | 'night'>('day');

  // Matrix grid state: workerId -> processId -> qty
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const [stList, wList, setRes] = await Promise.all([
      dataService.getStyles(),
      dataService.getWorkers(),
      dataService.getSettings(),
    ]);
    setStyles(stList);
    setWorkers(wList);
    setSettings(setRes);

    if (stList.length > 0) {
      setSelectedStyleId(stList[0].id);
      loadStyleProcesses(stList[0].id);
    }
  };

  const loadStyleProcesses = async (styleId: string) => {
    const pList = await dataService.getProcesses(styleId);
    setProcesses(pList);
    setMatrix({}); // reset matrix
  };

  const handleStyleChange = (styleId: string) => {
    setSelectedStyleId(styleId);
    loadStyleProcesses(styleId);
  };

  const handleCellChange = (workerId: string, processId: string, value: string) => {
    const val = parseInt(value, 10) || 0;
    setMatrix(prev => ({
      ...prev,
      [workerId]: {
        ...(prev[workerId] || {}),
        [processId]: val,
      },
    }));
  };

  const handleSaveGrid = async () => {
    let count = 0;
    for (const workerId of Object.keys(matrix)) {
      for (const processId of Object.keys(matrix[workerId])) {
        const qty = matrix[workerId][processId];
        if (qty > 0) {
          const proc = processes.find(p => p.id === processId);
          await dataService.saveProductionEntry({
            entry_date: entryDate,
            shift,
            style_id: selectedStyleId,
            process_id: processId,
            worker_id: workerId,
            qty_ok: qty,
            rate_snapshot: proc?.rate || 3.5,
          });
          count++;
        }
      }
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const currencySymbol = settings?.currency_symbol || '৳';

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Table className="w-6 h-6 text-emerald-400" />
            <span>Spreadsheet Bulk Grid Entry</span>
          </h1>
          <p className="text-xs text-slate-400">Desktop matrix entry — enter piece counts across multiple operations at once</p>
        </div>

        <button
          onClick={handleSaveGrid}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all text-sm shrink-0"
        >
          {savedSuccess ? <CheckCircle className="w-4 h-4 text-emerald-200" /> : <Save className="w-4 h-4" />}
          <span>{savedSuccess ? 'Grid Saved!' : 'Save Grid Entries'}</span>
        </button>
      </div>

      {/* Selectors Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Entry Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={e => setEntryDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Garment Style</label>
          <select
            value={selectedStyleId}
            onChange={e => handleStyleChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold"
          >
            {styles.map(s => (
              <option key={s.id} value={s.id}>
                {s.style_code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Shift</label>
          <select
            value={shift}
            onChange={e => setShift(e.target.value as any)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold"
          >
            <option value="day">Day Shift</option>
            <option value="night">Night Shift</option>
          </select>
        </div>
      </div>

      {/* Spreadsheet Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl w-full max-w-full overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-300 font-mono">
              <th className="p-3 sticky left-0 z-10 bg-slate-800 min-w-[160px]">Worker Name</th>
              {processes.map(proc => (
                <th key={proc.id} className="p-2 text-center min-w-[100px]">
                  <div className="font-bold text-white truncate max-w-[90px]">{proc.name}</div>
                  <div className="text-[10px] text-amber-400">{currencySymbol}{proc.rate}</div>
                </th>
              ))}
              <th className="p-3 text-right bg-slate-800 sticky right-0 z-10 min-w-[100px]">Row Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {workers.map(worker => {
              const workerRow = matrix[worker.id] || {};
              let rowPieces = 0;
              let rowMoney = 0;

              processes.forEach(proc => {
                const q = workerRow[proc.id] || 0;
                rowPieces += q;
                rowMoney += q * proc.rate;
              });

              return (
                <tr key={worker.id} className="hover:bg-slate-800/40">
                  <td className="p-3 sticky left-0 z-10 bg-slate-900 font-medium text-white flex items-center space-x-2">
                    <WorkerAvatar
                      photoUrl={worker.photo_url}
                      name={worker.full_name}
                      size="sm"
                      className="rounded-full"
                    />
                    <div className="truncate">
                      <div className="font-bold">{worker.full_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{worker.worker_code}</div>
                    </div>
                  </td>

                  {processes.map(proc => {
                    const val = workerRow[proc.id] || '';
                    return (
                      <td key={proc.id} className="p-1.5 text-center">
                        <input
                          type="number"
                          min="0"
                          value={val}
                          onChange={e => handleCellChange(worker.id, proc.id, e.target.value)}
                          placeholder="0"
                          className="w-full text-center bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-lg py-1.5 text-sm text-white font-mono font-bold"
                        />
                      </td>
                    );
                  })}

                  <td className="p-3 text-right sticky right-0 z-10 bg-slate-900 font-mono font-bold text-amber-400">
                    {rowPieces} pcs
                    <div className="text-[10px] text-slate-400">{currencySymbol}{rowMoney.toFixed(0)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
};
