import React, { useState, useEffect } from 'react';
import { Users, X, AlertCircle, CheckCircle, Calculator, Info, Layers } from 'lucide-react';
import { dataService } from '../lib/dataService';
import { GarmentStyle, GarmentProcess, ProductionTeam, UserRole } from '../types';

interface TeamOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  initialStyleId?: string;
  initialWorkDate?: string;
  role?: UserRole;
}

export const TeamOutputModal: React.FC<TeamOutputModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialStyleId,
  initialWorkDate,
  role = 'supervisor',
}) => {
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [teams, setTeams] = useState<ProductionTeam[]>([]);
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [finishingStagesCount, setFinishingStagesCount] = useState<number | null>(null);

  const [selectedStyleId, setSelectedStyleId] = useState<string>(initialStyleId || '');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedProcessId, setSelectedProcessId] = useState<string>('ALL');
  const [qtyOk, setQtyOk] = useState<number | ''>(100);
  const [workDate, setWorkDate] = useState<string>(
    initialWorkDate || new Date().toISOString().split('T')[0]
  );
  const [splitMethod, setSplitMethod] = useState<'equal' | 'share'>('equal');
  const [shift, setShift] = useState<'day' | 'night'>('day');

  // Preview & Confirmation Dialog State
  const [previewData, setPreviewData] = useState<{
    splits: { worker_id: string; worker_name: string; qty_ok: number; amount: number }[];
    summaryMessage: string;
  } | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadModalData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedStyleId) {
      loadStyleDetails(selectedStyleId);
    }
  }, [selectedStyleId]);

  const loadModalData = async () => {
    try {
      const [stylesData, teamsData] = await Promise.all([
        dataService.getStyles(),
        dataService.getTeams(),
      ]);

      setStyles(stylesData);
      setTeams(teamsData);

      // Auto-select style if initialStyleId given or first team style
      const targetStyleId = initialStyleId || (stylesData.length > 0 ? stylesData[0].id : '');
      setSelectedStyleId(targetStyleId);

      if (targetStyleId) {
        await loadStyleDetails(targetStyleId);
      }
    } catch (err) {
      console.error('Error loading team modal data:', err);
    }
  };

  const loadStyleDetails = async (styleId: string) => {
    try {
      const [procs, teamList, stages] = await Promise.all([
        dataService.getProcesses(styleId),
        dataService.getTeams(styleId),
        dataService.getFinishingStages(styleId),
      ]);

      setProcesses(procs);
      setTeams(teamList);
      setFinishingStagesCount(stages.length);

      if (teamList.length > 0) {
        setSelectedTeamId(teamList[0].id);
        const hasShares = teamList[0].members?.some(m => m.share_percent != null && m.share_percent > 0);
        setSplitMethod(hasShares ? 'share' : 'equal');
      } else {
        setSelectedTeamId('');
      }

      setSelectedProcessId('ALL');
    } catch (err) {
      console.error('Error loading style details:', err);
    }
  };

  if (!isOpen) return null;

  const currentStyle = styles.find(s => s.id === selectedStyleId);
  const currentTeam = teams.find(t => t.id === selectedTeamId);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedStyleId) {
      setErrorMsg('Please select a style.');
      return;
    }

    if (finishingStagesCount === 0) {
      setErrorMsg('No finishing stages — output will not reach finishing.');
      return;
    }

    if (!selectedTeamId) {
      setErrorMsg('Please select a team.');
      return;
    }
    if (!qtyOk || Number(qtyOk) <= 0) {
      setErrorMsg('Please enter a valid positive quantity.');
      return;
    }

    try {
      const res = await dataService.previewTeamSplit({
        team_id: selectedTeamId,
        style_id: selectedStyleId,
        process_id: selectedProcessId,
        qty_ok: Number(qtyOk),
        split: splitMethod,
      });

      setPreviewData(res);
    } catch (err: any) {
      console.error('Error previewing team split:', err);
      setErrorMsg(err.message || 'Failed to calculate split.');
    }
  };

  const handleConfirmSave = async () => {
    if (!previewData || !selectedStyleId || !selectedTeamId || !qtyOk) return;

    if (finishingStagesCount === 0) {
      setErrorMsg('No finishing stages — output will not reach finishing.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await dataService.logTeamOutput({
        team_id: selectedTeamId,
        style_id: selectedStyleId,
        process_id: selectedProcessId,
        qty_ok: Number(qtyOk),
        work_date: workDate,
        split: splitMethod,
        shift,
      });

      onSuccess(result.summaryMessage);
      onClose();
    } catch (err: any) {
      console.error('Error logging team output:', err);
      setErrorMsg(err.message || 'Failed to save team production output.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-stone-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-scale-up my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-stone-900 text-base">Log Team Production Output</h3>
              <p className="text-xs text-stone-500">Record total output for group split</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {finishingStagesCount === 0 && (
          <div className="bg-rose-50 border border-rose-300 text-rose-950 p-3.5 rounded-2xl text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>No finishing stages — output will not reach finishing.</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!selectedStyleId) return;
                await dataService.applyDefaultFinishingStages(selectedStyleId, true);
                const stages = await dataService.getFinishingStages(selectedStyleId);
                setFinishingStagesCount(stages.length);
                setErrorMsg(null);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer"
            >
              Set up stages
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded-2xl text-xs font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!previewData ? (
          <form onSubmit={handlePreview} className="space-y-4">
            {/* Style Selector */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Garment Style *</label>
              <select
                value={selectedStyleId}
                onChange={e => {
                  setSelectedStyleId(e.target.value);
                }}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-bold outline-none cursor-pointer"
              >
                {styles.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.style_code} - {s.name} {s.wage_model === 'team' ? '(Team Style)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Team Selector */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Select Team *</label>
              {teams.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 font-medium">
                  No teams configured for this style. Please create a team in Settings &gt; Teams first.
                </div>
              ) : (
                <select
                  value={selectedTeamId}
                  onChange={e => {
                    const tid = e.target.value;
                    setSelectedTeamId(tid);
                    const tm = teams.find(t => t.id === tid);
                    if (tm) {
                      const hasShares = tm.members?.some(m => m.share_percent != null && m.share_percent > 0);
                      setSplitMethod(hasShares ? 'share' : 'equal');
                    }
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-bold outline-none cursor-pointer"
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.member_count || 0} members)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Operation / Process Selector */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Operation / Process *</label>
              <select
                value={selectedProcessId}
                onChange={e => setSelectedProcessId(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-bold outline-none cursor-pointer"
              >
                <option value="ALL">✨ Full Garment / Complete Sewing (ALL Operations)</option>
                {processes.map(p => (
                  <option key={p.id} value={p.id}>
                    Op #{p.seq_no} - {p.name} (RM {p.rate?.toFixed(3)}/pc)
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity & Work Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Completed Qty (Pcs) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={qtyOk}
                  onChange={e => setQtyOk(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-stone-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Work Date *</label>
                <input
                  type="date"
                  required
                  value={workDate}
                  onChange={e => setWorkDate(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 outline-none font-medium"
                />
              </div>
            </div>

            {/* Split Method Toggle */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-stone-700 block">Output Split Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMethod('equal')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    splitMethod === 'equal'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Equal Split</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSplitMethod('share')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    splitMethod === 'share'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>By Share %</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={teams.length === 0}
                className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Calculator className="w-4 h-4" />
                <span>Calculate & Preview Split</span>
              </button>
            </div>
          </form>
        ) : (
          /* CONFIRMATION / PREVIEW DIALOG */
          <div className="space-y-4">
            <div className="bg-indigo-50/80 border border-indigo-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Team Output Summary</span>
                <span className="text-xs font-mono font-black text-indigo-800 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200">
                  {qtyOk} Pcs Total
                </span>
              </div>
              <p className="text-xs text-stone-700 font-bold leading-relaxed">
                {previewData.summaryMessage}
              </p>
            </div>

            {/* Split Breakdown List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">
                <span>Team Member</span>
                <span>Calculated Share</span>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {previewData.splits.map(s => (
                  <div
                    key={s.worker_id}
                    className="flex items-center justify-between bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs"
                  >
                    <span className="font-bold text-stone-900">{s.worker_name}</span>
                    <div className="flex items-center space-x-2 font-mono font-bold">
                      <span className="text-indigo-900 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                        {s.qty_ok} pcs
                      </span>
                      <span className="text-emerald-700">
                        RM {s.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Explicit Notice for Editing/Deleting */}
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-[11px] text-amber-900 font-medium flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Note:</strong> Saving writes individual production entries for each member. Correcting a team total requires deleting the split rows and re-entering.
              </span>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-200 transition cursor-pointer"
              >
                ← Back to Edit
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSave}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black rounded-xl text-xs transition shadow-md cursor-pointer flex items-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving Split...' : 'Confirm & Save Split'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
