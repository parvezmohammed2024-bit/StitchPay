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
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-500 hover:text-stone-900 p-1 rounded-lg hover:bg-stone-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-3 text-amber-800 mb-4">
          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-300">
            <AlertTriangle className="w-6 h-6 shrink-0 text-amber-700" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-stone-900">{t('duplicateWarningTitle')}</h3>
            <p className="text-xs text-stone-600 mt-1">{t('duplicateWarningMsg')}</p>
          </div>
        </div>

        <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 my-4 text-sm space-y-1.5">
          <div className="flex justify-between text-stone-600">
            <span>Worker:</span>
            <span className="font-semibold text-stone-900">{workerName}</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>Process:</span>
            <span className="font-semibold text-stone-900">{processName}</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>Existing Logged Qty:</span>
            <span className="font-bold text-emerald-700">{existingEntry.qty_ok} pcs</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-6">
          <button
            onClick={() => onEditExisting(existingEntry)}
            className="flex-1 flex items-center justify-center space-x-2 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-all text-sm"
          >
            <Edit3 className="w-4 h-4" />
            <span>{t('editExisting')}</span>
          </button>

          <button
            onClick={onAddAnyway}
            className="flex-1 flex items-center justify-center space-x-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-900 font-semibold py-2.5 px-4 rounded-xl transition-all text-sm"
          >
            <Plus className="w-4 h-4 text-amber-700" />
            <span>{t('addAnyway')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
