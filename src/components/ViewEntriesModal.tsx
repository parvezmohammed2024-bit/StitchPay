import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Clock, Edit2, Trash2, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { dataService } from '../lib/dataService';
import { UserRole } from '../types';

interface ViewEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  styleId: string;
  styleCode: string;
  styleName: string;
  entryType: 'finishing' | 'cutting' | 'production';
  role?: UserRole;
  onRefresh?: () => void;
}

export const ViewEntriesModal: React.FC<ViewEntriesModalProps> = ({
  isOpen,
  onClose,
  styleId,
  styleCode,
  styleName,
  entryType,
  role = 'admin',
  onRefresh,
}) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit State
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    qty_ok: number;
    qty_rework: number;
    qty_reject: number;
    qty_cut: number;
    size: string;
    color: string;
    note: string;
  }>({
    qty_ok: 0,
    qty_rework: 0,
    qty_reject: 0,
    qty_cut: 0,
    size: '',
    color: '',
    note: '',
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete Confirm Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && styleId) {
      loadEntries();
    }
  }, [isOpen, styleId, entryType]);

  const loadEntries = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let data: any[] = [];
      if (entryType === 'finishing') {
        data = await dataService.getFinishingEntriesReport(styleId);
      } else if (entryType === 'cutting') {
        data = await dataService.getCuttingEntriesReport(styleId);
      } else {
        data = await dataService.getProductionEntriesReport(styleId);
      }

      // Sort newest first
      data.sort((a, b) => {
        const timeA = new Date(a.created_at || a.entry_date).getTime();
        const timeB = new Date(b.created_at || b.entry_date).getTime();
        return timeB - timeA;
      });

      setEntries(data);
    } catch (err: any) {
      console.error('Error loading entries report:', err);
      setErrorMsg('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // ADMIN ONLY GUARD — Supervisors, accounts & workers must NEVER see edit/delete controls
  const isAdmin = role === 'admin';

  const handleStartEdit = (entry: any) => {
    setErrorMsg(null);
    setEditingEntryId(entry.id);
    setEditForm({
      qty_ok: entry.qty_ok ?? entry.qty ?? 0,
      qty_rework: entry.qty_rework ?? 0,
      qty_reject: entry.qty_reject ?? 0,
      qty_cut: entry.pieces_cut ?? entry.qty_cut ?? entry.qty_ok ?? 0,
      size: entry.size || '',
      color: entry.color || entry.tables_layers || '',
      note: entry.notes || entry.note || '',
    });
  };

  const handleSaveEdit = async (entry: any) => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      if (entryType === 'finishing') {
        await dataService.updateFinishingEntry(entry.id, {
          qty_ok: editForm.qty_ok,
          qty_rework: editForm.qty_rework,
          qty_reject: editForm.qty_reject,
          note: editForm.note,
        }, entry.entry_date);
      } else if (entryType === 'cutting') {
        await dataService.updateCuttingEntry(entry.id, {
          pieces_cut: editForm.qty_cut,
          size: editForm.size,
          notes: editForm.note,
        }, entry.entry_date);
      } else {
        // PRODUCTION ENTRIES — DO NOT TOUCH rate_snapshot or amount
        await dataService.updateProductionEntry(entry.id, {
          qty_ok: editForm.qty_ok,
          qty_rework: editForm.qty_rework,
          qty_reject: editForm.qty_reject,
          note: editForm.note,
        }, entry.entry_date);
      }


      setEditingEntryId(null);
      await loadEntries();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Save entry failed:', err);
      setErrorMsg(err.message || 'This entry is in a locked payroll period and cannot be changed. Unlock the period first.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    setIsDeleting(true);
    setErrorMsg(null);

    const target = deleteConfirmTarget;
    try {
      if (entryType === 'finishing') {
        await dataService.deleteFinishingEntry(target.id, target.entry_date);
      } else if (entryType === 'cutting') {
        await dataService.deleteCuttingEntry(target.id, target.entry_date);
      } else {
        await dataService.deleteProductionEntry(target.id, target.entry_date);
      }

      setDeleteConfirmTarget(null);
      await loadEntries();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Delete entry failed:', err);
      setDeleteConfirmTarget(null);
      setErrorMsg(err.message || 'This entry is in a locked payroll period and cannot be changed. Unlock the period first.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper for human readable deletion description
  const getDeleteDescription = (entry: any) => {
    const qty = entry.qty_ok ?? entry.qty_cut ?? entry.qty ?? 0;
    const stageOrOp = entry.stage_name || entry.process_name || (entry.size ? `Size ${entry.size}` : 'Cutting');
    const dateFormatted = entry.entry_date || (entry.created_at ? entry.created_at.substring(0, 10) : 'recent date');
    return `Delete ${qty} pcs of ${styleCode} (${styleName}) at ${stageOrOp}, recorded ${dateFormatted}?`;
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-black bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                {styleCode}
              </span>
              <h3 className="text-base font-extrabold text-stone-900 truncate">
                {styleName} — {entryType.toUpperCase()} Entries
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Listing all logged entries (Newest first). Admin edit & delete controls.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-stone-200/60 rounded-full text-stone-500 hover:text-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LOCKED PERIOD ERROR BANNER */}
        {errorMsg && (
          <div className="bg-rose-50 border-b border-rose-200 p-3.5 px-6 flex items-center space-x-2 text-rose-900 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-stone-500 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs font-medium">Loading production entries...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl">
              <p className="text-sm font-bold text-stone-600">No output entries recorded yet</p>
              <p className="text-xs text-stone-400 mt-1">Entries logged for this style will appear here.</p>
            </div>
          ) : (
            entries.map((entry) => {
              const isEditing = editingEntryId === entry.id;
              const displayQty = entry.qty_ok ?? entry.qty_cut ?? entry.qty ?? 0;
              const stageOrProc = entry.stage_name || entry.process_name || (entry.size ? `Size: ${entry.size}` : 'Production');

              return (
                <div
                  key={entry.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isEditing
                      ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/40'
                      : 'bg-stone-50/80 border-stone-200 hover:bg-white hover:border-stone-300'
                  }`}
                >
                  {isEditing ? (
                    /* INLINE EDIT FORM */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                        <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                          Editing Entry ({stageOrProc})
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">
                          ID: {entry.id.substring(0, 8)}...
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {entryType === 'cutting' ? (
                          <>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1">Qty Cut</label>
                              <input
                                type="number"
                                min="0"
                                value={editForm.qty_cut}
                                onChange={(e) => setEditForm({ ...editForm, qty_cut: parseInt(e.target.value, 10) || 0 })}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1">Size</label>
                              <input
                                type="text"
                                value={editForm.size}
                                onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1">Color</label>
                              <input
                                type="text"
                                value={editForm.color}
                                onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1">Qty OK</label>
                              <input
                                type="number"
                                min="0"
                                value={editForm.qty_ok}
                                onChange={(e) => setEditForm({ ...editForm, qty_ok: parseInt(e.target.value, 10) || 0 })}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold font-mono text-emerald-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1">Rework</label>
                              <input
                                type="number"
                                min="0"
                                value={editForm.qty_rework}
                                onChange={(e) => setEditForm({ ...editForm, qty_rework: parseInt(e.target.value, 10) || 0 })}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold font-mono text-amber-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1">Reject</label>
                              <input
                                type="number"
                                min="0"
                                value={editForm.qty_reject}
                                onChange={(e) => setEditForm({ ...editForm, qty_reject: parseInt(e.target.value, 10) || 0 })}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold font-mono text-rose-800"
                              />
                            </div>
                          </>
                        )}

                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] font-bold text-stone-600 mb-1">Note</label>
                          <input
                            type="text"
                            value={editForm.note}
                            onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                            placeholder="Optional note"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-2 border-t border-amber-200">
                        <button
                          type="button"
                          onClick={() => setEditingEntryId(null)}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveEdit(entry)}
                          className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs shadow-xs flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* NORMAL ROW DISPLAY */
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2.5 flex-wrap">
                          <span className="font-extrabold text-stone-900 text-sm">
                            {stageOrProc}
                          </span>
                          <span className="font-mono text-xs font-black bg-stone-200 text-stone-800 px-2 py-0.5 rounded-md">
                            {displayQty} pcs
                          </span>
                          {entry.qty_rework > 0 && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                              Rework: {entry.qty_rework}
                            </span>
                          )}
                          {entry.qty_reject > 0 && (
                            <span className="text-[10px] font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded-md">
                              Reject: {entry.qty_reject}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-stone-500 flex-wrap gap-y-1">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-stone-400" />
                            <span>{entry.entry_date || 'N/A'}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <User className="w-3.5 h-3.5 text-stone-400" />
                            <span className="font-medium text-stone-700">{entry.worker_name || 'Worker'}</span>
                          </span>
                          {entry.created_at && (
                            <>
                              <span>•</span>
                              <span className="flex items-center space-x-1 text-[11px] text-stone-400">
                                <Clock className="w-3 h-3" />
                                <span>
                                  Recorded {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </span>
                            </>
                          )}
                        </div>

                        {entry.note && (
                          <div className="text-xs text-stone-600 italic bg-white/70 px-2.5 py-1 rounded-lg border border-stone-200/60 inline-block mt-1">
                            Note: "{entry.note}"
                          </div>
                        )}
                      </div>

                      {/* ADMIN ONLY EDIT & DELETE ACTIONS */}
                      {isAdmin && (
                        <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(entry)}
                            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs border border-stone-200 transition-colors flex items-center space-x-1"
                            title="Edit entry"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-stone-600" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTarget(entry)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 transition-colors flex items-center space-x-1"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex justify-between items-center text-xs text-stone-500">
          <span>Total records: <strong className="text-stone-900">{entries.length}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* STRICT DELETE CONFIRMATION DIALOG (REQUIREMENT 3 & 4) */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-3xl border border-rose-200 p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-stone-900">Confirm Record Deletion</h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Production entries back up wage calculations and audit history.
                </p>
              </div>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 p-3.5 rounded-2xl text-xs font-semibold text-stone-900 leading-relaxed">
              "{getDeleteDescription(deleteConfirmTarget)}"
            </div>

            <p className="text-[11px] text-stone-500 italic">
              ⚠️ This deletion will be logged permanently in entry_audit.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              {/* CANCEL IS DEFAULT BUTTON (focused) */}
              <button
                type="button"
                autoFocus
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs border border-stone-300 transition-colors focus:ring-2 focus:ring-stone-400"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
