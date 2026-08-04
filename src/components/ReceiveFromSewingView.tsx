import React, { useState, useEffect } from 'react';
import { 
  PackageCheck, Check, Plus, Minus, AlertTriangle, CheckCircle2, RefreshCw, Shirt, ArrowRight, Lock
} from 'lucide-react';
import { dataService, getLocalDateString } from '../lib/dataService';
import { AvailableToReceiveRow, UserRole } from '../types';

interface ReceiveFromSewingViewProps {
  role: UserRole;
  workerToken?: string;
  onSaveComplete?: () => void;
}

export const ReceiveFromSewingView: React.FC<ReceiveFromSewingViewProps> = ({
  role,
  workerToken,
  onSaveComplete,
}) => {
  const isWorker = role === 'worker';

  const [rows, setRows] = useState<AvailableToReceiveRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Override explicit confirmation checkbox state
  const [confirmOverride, setConfirmOverride] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, [role, workerToken]);

  const loadData = async () => {
    setLoading(true);
    setConfirmOverride(false);
    try {
      let data: AvailableToReceiveRow[] = [];
      if (isWorker && workerToken) {
        data = await dataService.getWpAvailableToReceive(workerToken);
      } else {
        data = await dataService.getRptAvailableToReceive();
      }
      setRows(data);

      // Initialize inputs as blank
      const initialInputs: Record<string, string> = {};
      data.forEach(r => {
        initialInputs[r.style_id] = '';
      });
      setQtyInputs(initialInputs);
    } catch (err) {
      console.error('Error loading available to receive data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (row: AvailableToReceiveRow, val: string) => {
    if (row.available <= 0) return; // Block input when available is 0
    setQtyInputs(prev => ({
      ...prev,
      [row.style_id]: val,
    }));
  };

  const handleStepper = (row: AvailableToReceiveRow, delta: number) => {
    if (row.available <= 0) return; // Block input when available is 0
    const curVal = Number(qtyInputs[row.style_id] || 0);
    const newVal = Math.max(0, curVal + delta);
    setQtyInputs(prev => ({
      ...prev,
      [row.style_id]: newVal === 0 ? '' : String(newVal),
    }));
  };

  const handleReceiveAll = (row: AvailableToReceiveRow) => {
    if (row.available <= 0) return;
    setQtyInputs(prev => ({
      ...prev,
      [row.style_id]: String(row.available),
    }));
  };

  // Calculate Running Total
  const totalReceivingNow: number = (Object.values(qtyInputs) as string[]).reduce((sum: number, v: string) => {
    const n = Number(v);
    return sum + (isNaN(n) || n < 0 ? 0 : n);
  }, 0);

  const filledCount = Object.values(qtyInputs).filter(v => Number(v) > 0).length;

  // Check if any entered qty exceeds available
  const exceedingRows = rows.filter(r => Number(qtyInputs[r.style_id] || 0) > r.available);
  const hasExceeding = exceedingRows.length > 0;

  const isSaveBlocked = saving || totalReceivingNow <= 0 || (hasExceeding && !confirmOverride);

  const executeSave = async () => {
    const pendingToSave = rows.filter(r => Number(qtyInputs[r.style_id] || 0) > 0);
    if (pendingToSave.length === 0) {
      alert('Please enter a quantity for at least one style to receive from sewing.');
      return;
    }

    if (hasExceeding && !confirmOverride) {
      alert('You must tick "I confirm this exceeds recorded sewing output." before saving exceeding quantities.');
      return;
    }

    setSaving(true);
    const today = getLocalDateString();

    let savedCount = 0;
    try {
      if (isWorker && workerToken) {
        // Save via worker RPC
        for (const item of pendingToSave) {
          const qty = Number(qtyInputs[item.style_id] || 0);
          if (qty > 0) {
            const isExceeding = qty > item.available;
            const note = isExceeding
              ? `OVERRIDE: Exceeds recorded sewing output. Entered: ${qty} pcs, Available: ${item.available} pcs (Sewn: ${item.garments_sewn}, Prev Received: ${item.already_received}).`
              : 'Received from Sewing floor (Quick Entry)';

            await dataService.wpLogFinishing(workerToken, item.received_stage_id, qty, note);
            savedCount++;
          }
        }
      } else {
        // Save directly via admin/supervisor
        const finishingEntriesToInsert = pendingToSave.map(item => {
          const qty = Number(qtyInputs[item.style_id] || 0);
          const isExceeding = qty > item.available;
          const note = isExceeding
            ? `OVERRIDE: Exceeds recorded sewing output. Entered: ${qty} pcs, Available: ${item.available} pcs (Sewn: ${item.garments_sewn}, Prev Received: ${item.already_received}).`
            : 'Received from Sewing floor (Quick Entry)';

          return {
            style_id: item.style_id,
            stage_id: item.received_stage_id,
            entry_date: today,
            shift: 'day' as 'day' | 'night',
            qty_ok: qty,
            qty_rework: 0,
            qty_reject: 0,
            note,
            entered_by: role,
          };
        });

        await dataService.saveFinishingEntries(finishingEntriesToInsert);
        savedCount = finishingEntriesToInsert.length;
      }

      setToastMessage(`✅ Successfully received ${totalReceivingNow.toLocaleString()} garments across ${savedCount} style(s)!`);
      if (onSaveComplete) onSaveComplete();
      await loadData();

      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save receipts from sewing.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto">
      {/* Toast Confirmation */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-800 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 border border-emerald-500 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen Title & Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <PackageCheck className="w-6 h-6 text-purple-700" />
            <span>Receive Garments from Sewing</span>
          </h2>
          <p className="text-xs text-stone-600">
            Record incoming garments handed over from sewing floor into the Finishing pipeline
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="flex items-center space-x-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 px-3.5 py-2 rounded-xl font-semibold text-xs transition shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Figures</span>
        </button>
      </div>

      {/* RUNNING TOTAL HEADER BAR */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-stone-900 text-white rounded-3xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-purple-800/40">
        <div>
          <div className="text-[10px] font-bold text-purple-200 uppercase tracking-wider mb-1">
            Total Pieces Being Received Today
          </div>
          <div className="text-3xl font-black font-mono text-purple-200 flex items-baseline gap-2">
            <span>{totalReceivingNow.toLocaleString()}</span>
            <span className="text-xs font-normal text-purple-300">pieces ({filledCount} styles selected)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={executeSave}
          disabled={isSaveBlocked}
          className={`flex items-center space-x-2.5 font-black text-sm py-3.5 px-7 rounded-2xl shadow-lg transition-all shrink-0 ${
            !isSaveBlocked
              ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-purple-900/50 active:scale-95'
              : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
          }`}
        >
          <Check className="w-5 h-5 text-purple-100" />
          <span>
            {saving
              ? 'Saving Receipts...'
              : hasExceeding && !confirmOverride
              ? 'Check Confirmation Box to Save'
              : 'Save Receipts'}
          </span>
        </button>
      </div>

      {/* EXCEEDING WARNING & CONFIRMATION BOX (Renders when enteredQty > available for any style) */}
      {hasExceeding && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-3 shadow-md animate-in fade-in duration-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-1">
              <span className="font-bold text-amber-900 text-sm block">
                Warning: Quantity Exceeds Sewing Output
              </span>
              <p>
                One or more styles have an entered quantity greater than the available recorded sewing output.
                To prevent accidental over-counting, you must explicitly confirm before saving.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/80 flex items-center space-x-3">
            <input
              type="checkbox"
              id="confirm-override-checkbox"
              checked={confirmOverride}
              onChange={(e) => setConfirmOverride(e.target.checked)}
              className="w-5 h-5 text-amber-600 border-amber-400 rounded focus:ring-amber-500 shrink-0 cursor-pointer"
            />
            <label
              htmlFor="confirm-override-checkbox"
              className="text-xs font-black text-amber-950 cursor-pointer select-none"
            >
              I confirm this exceeds recorded sewing output.
            </label>
          </div>
        </div>
      )}

      {/* STYLES LIST */}
      {loading ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center text-xs font-mono text-stone-500 shadow-xs">
          Loading available style metrics from sewing floor...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center text-stone-500 space-y-2 shadow-xs">
          <Shirt className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="text-sm font-bold text-stone-800">No active styles available</p>
          <p className="text-xs text-stone-500">There are currently no active styles requiring sewing receipts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(row => {
            const enteredVal = qtyInputs[row.style_id] || '';
            const numVal = Number(enteredVal || 0);
            const isExceeding = numVal > row.available;
            const isZeroAvailable = row.available <= 0;

            return (
              <div
                key={row.style_id}
                className={`bg-white border rounded-3xl p-5 shadow-xs space-y-4 transition-all ${
                  isZeroAvailable
                    ? 'border-stone-200 bg-stone-50/60 opacity-80'
                    : isExceeding
                    ? 'border-amber-400 bg-amber-50/20 ring-1 ring-amber-400/50'
                    : numVal > 0
                    ? 'border-purple-300 bg-purple-50/10'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                {/* STYLE CODE & NAME */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-200 text-purple-800 flex items-center justify-center font-bold text-sm shrink-0">
                      <Shirt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                        <span>{row.style_code}</span>
                      </h3>
                      {row.style_name && (
                        <p className="text-xs text-stone-600 font-medium">{row.style_name}</p>
                      )}
                    </div>
                  </div>

                  {/* Receive All Shortcut Button */}
                  <button
                    type="button"
                    disabled={isZeroAvailable}
                    onClick={() => handleReceiveAll(row)}
                    className={`self-start sm:self-center px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                      isZeroAvailable
                        ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                        : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800'
                    }`}
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-purple-700" />
                    <span>Receive All ({row.available})</span>
                  </button>
                </div>

                {/* METRIC BADGES & INPUT STEPPER */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* SEWING STATS (COL-7) - ALWAYS FETCHED & DISPLAYED BEFORE INPUT */}
                  <div className="md:col-span-7 grid grid-cols-3 gap-2 bg-stone-50 border border-stone-200/80 rounded-2xl p-3 text-center">
                    <div>
                      <div className="text-[10px] font-bold text-stone-500 uppercase">Garments Sewn</div>
                      <div className="text-base sm:text-lg font-black font-mono text-stone-900 mt-0.5">
                        {row.garments_sewn.toLocaleString()}
                      </div>
                    </div>

                    <div className="border-x border-stone-200 px-1">
                      <div className="text-[10px] font-bold text-stone-500 uppercase">Already Received</div>
                      <div className="text-base sm:text-lg font-black font-mono text-stone-700 mt-0.5">
                        {row.already_received.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-extrabold text-purple-700 uppercase">Available</div>
                      <div className="text-lg sm:text-xl font-black font-mono text-purple-800 mt-0.5">
                        {row.available.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* QUANTITY INPUT & STEPPER CONTROLS (COL-5) */}
                  <div className="md:col-span-5 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      disabled={isZeroAvailable}
                      onClick={() => handleStepper(row, -10)}
                      className="w-9 h-11 rounded-xl bg-stone-100 border border-stone-200 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed text-rose-700 font-extrabold text-xs flex items-center justify-center transition active:scale-95 shrink-0"
                      title="-10 pcs"
                    >
                      -10
                    </button>

                    <button
                      type="button"
                      disabled={isZeroAvailable}
                      onClick={() => handleStepper(row, -1)}
                      className="w-9 h-11 rounded-xl bg-stone-100 border border-stone-200 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed text-stone-800 font-bold flex items-center justify-center transition active:scale-95 shrink-0"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <div className="w-28 text-center shrink-0">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        disabled={isZeroAvailable}
                        value={enteredVal}
                        onChange={(e) => handleQtyChange(row, e.target.value)}
                        className={`w-full text-center py-2 text-lg font-black font-mono rounded-xl outline-none transition border ${
                          isZeroAvailable
                            ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                            : isExceeding
                            ? 'bg-amber-100 border-amber-500 text-amber-900 focus:ring-2 focus:ring-amber-500'
                            : numVal > 0
                            ? 'bg-purple-50 border-purple-500 text-purple-950 focus:ring-2 focus:ring-purple-500'
                            : 'bg-stone-50 border-stone-300 text-stone-900 focus:border-purple-600'
                        }`}
                      />
                      <span className="text-[10px] font-semibold text-stone-500 font-mono block mt-0.5">
                        pcs to receive
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isZeroAvailable}
                      onClick={() => handleStepper(row, 1)}
                      className="w-9 h-11 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed text-purple-800 font-bold flex items-center justify-center transition active:scale-95 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={isZeroAvailable}
                      onClick={() => handleStepper(row, 10)}
                      className="w-9 h-11 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs flex items-center justify-center transition active:scale-95 shadow-xs shrink-0"
                      title="+10 pcs"
                    >
                      +10
                    </button>
                  </div>
                </div>

                {/* ZERO AVAILABLE DISABLED MESSAGE */}
                {isZeroAvailable && (
                  <div className="bg-stone-100/90 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs text-stone-600 font-semibold flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-stone-400 shrink-0" />
                    <span>No garments completed in sewing yet — nothing to receive.</span>
                  </div>
                )}

                {/* EXCEEDING AVAILABLE SPECIFIC WARNING copy requirement */}
                {isExceeding && (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 text-xs text-amber-950 font-medium space-y-1">
                    <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Over-Available Quantity Notice</span>
                    </div>
                    <p className="leading-relaxed">
                      Sewing has only completed <strong>{row.garments_sewn}</strong> pieces and <strong>{row.already_received}</strong> are already received. You cannot receive more than <strong>{row.available}</strong>.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
