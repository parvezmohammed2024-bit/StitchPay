import React from 'react';
import { AlertTriangle, Plus, Edit3, X } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { ProductionEntry } from '../types';

interface DuplicateConfirmModalProps {
  isOpen: boolean;
  workerName: string;
  processName: string;
  existingEntry: ProductionEntry;
  onAddAnyway: () => void;
  onEditExisting: (existing: ProductionEntry) => void;
  onClose: () => void;
}

export const DuplicateConfirmModal: React.FC<DuplicateConfirmModalProps> = ({
  isOpen,
  workerName,
  processName,
  existingEntry,
  onAddAnyway,
  onEditExisting,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-3 text-amber-400 mb-4">
          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/30">
            <AlertTriangle className="w-6 h-6 shrink-0" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t('duplicateWarningTitle')}</h3>
            <p className="text-xs text-slate-400 mt-1">{t('duplicateWarningMsg')}</p>
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60 my-4 text-sm space-y-1.5">
          <div className="flex justify-between text-slate-300">
            <span>Worker:</span>
            <span className="font-semibold text-white">{workerName}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Process:</span>
            <span className="font-semibold text-white">{processName}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Existing Logged Qty:</span>
            <span className="font-bold text-emerald-400">{existingEntry.qty_ok} pcs</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-6">
          <button
            onClick={() => onEditExisting(existingEntry)}
            className="flex-1 flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md transition-all text-sm"
          >
            <Edit3 className="w-4 h-4" />
            <span>{t('editExisting')}</span>
          </button>

          <button
            onClick={onAddAnyway}
            className="flex-1 flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl transition-all text-sm"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>{t('addAnyway')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
