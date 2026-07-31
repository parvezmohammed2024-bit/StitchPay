import React, { useState, useEffect } from 'react';
import { 
  Scissors, Plus, Copy, FileSpreadsheet, Trash2, Edit3, 
  ChevronUp, ChevronDown, Save, DollarSign, Shirt, Check, X, Upload 
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { GarmentStyle, GarmentProcess, UserRole, FactorySettings } from '../types';

interface StylesBuilderScreenProps {
  role: UserRole;
}

export const StylesBuilderScreen: React.FC<StylesBuilderScreenProps> = ({ role }) => {
  const { t } = useTranslation();
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<GarmentStyle | null>(null);
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);

  // Modals & form state
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [sourceStyleId, setSourceStyleId] = useState<string>('');
  const [csvText, setCsvText] = useState('');

  // Editing single process
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [procForm, setProcForm] = useState<Partial<GarmentProcess>>({});

  // New Style Form
  const [styleForm, setStyleForm] = useState<Partial<GarmentStyle>>({
    name: '',
    style_code: '',
    buyer_name: '',
    order_qty: 10000,
    image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
  });

  const isOwnerAdmin = role === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [stList, setRes] = await Promise.all([
      dataService.getStyles(),
      dataService.getSettings(),
    ]);
    setStyles(stList);
    setSettings(setRes);
    if (stList.length > 0 && !selectedStyle) {
      setSelectedStyle(stList[0]);
      loadProcesses(stList[0].id);
    } else if (selectedStyle) {
      loadProcesses(selectedStyle.id);
    }
  };

  const loadProcesses = async (styleId: string) => {
    const pList = await dataService.getProcesses(styleId);
    setProcesses(pList);
  };

  const handleSelectStyle = (style: GarmentStyle) => {
    setSelectedStyle(style);
    loadProcesses(style.id);
  };

  const handleSaveStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await dataService.saveStyle(styleForm);
    setShowStyleModal(false);
    setStyleForm({ name: '', style_code: '', buyer_name: '', order_qty: 10000 });
    await loadData();
    setSelectedStyle(saved);
  };

  const handleSaveProcess = async (procData: Partial<GarmentProcess>) => {
    if (!selectedStyle) return;
    await dataService.saveProcess({
      ...procData,
      style_id: selectedStyle.id,
    });
    setEditingProcessId(null);
    setProcForm({});
    await loadProcesses(selectedStyle.id);
    await loadData();
  };

  const handleDeleteProcess = async (id: string) => {
    if (!selectedStyle) return;
    await dataService.deleteProcess(id);
    await loadProcesses(selectedStyle.id);
    await loadData();
  };

  const handleCloneProcesses = async () => {
    if (!selectedStyle || !sourceStyleId) return;
    await dataService.cloneProcesses(selectedStyle.id, sourceStyleId);
    setShowCloneModal(false);
    setSourceStyleId('');
    await loadProcesses(selectedStyle.id);
    await loadData();
  };

  const handleImportCSV = async () => {
    if (!selectedStyle || !csvText.trim()) return;
    const lines = csvText.split('\n');
    let seq = processes.length + 1;
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const rate = parseFloat(parts[1]) || 3.0;
        const smv = parts[2] ? parseFloat(parts[2]) : 1.5;
        const machine = parts[3] ? parts[3].trim() : 'Lockstitch';
        if (name) {
          await dataService.saveProcess({
            style_id: selectedStyle.id,
            seq_no: seq++,
            name,
            rate,
            smv,
            machine_type: machine,
          });
        }
      }
    }
    setShowCSVModal(false);
    setCsvText('');
    await loadProcesses(selectedStyle.id);
    await loadData();
  };

  // Calculate live total labour cost per garment
  const totalLabourCost = processes.reduce((sum, p) => sum + Number(p.rate || 0), 0);
  const currencySymbol = settings?.currency_symbol || '৳';

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Scissors className="w-6 h-6 text-amber-400" />
            <span>Garment Styles & Operation Breakdown</span>
          </h1>
          <p className="text-xs text-slate-400">Configure piece rates, SMVs, and sequence for each garment style</p>
        </div>

        {isOwnerAdmin && (
          <button
            onClick={() => setShowStyleModal(true)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg transition-all text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Style</span>
          </button>
        )}
      </div>

      {/* Style Cards Horizontal Carousel / Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {styles.map(st => {
          const isSelected = selectedStyle?.id === st.id;
          return (
            <div
              key={st.id}
              onClick={() => handleSelectStyle(st)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex space-x-4 ${
                isSelected
                  ? 'bg-slate-800 border-indigo-500 shadow-xl ring-2 ring-indigo-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <img
                src={st.image_url || 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80'}
                alt={st.name}
                className="w-20 h-20 rounded-xl object-cover border border-slate-700 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400">{st.style_code}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold uppercase">
                    {st.status}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base truncate mt-0.5">{st.name}</h3>
                <p className="text-xs text-slate-400 truncate">{st.buyer_name || 'Generic Buyer'}</p>

                <div className="mt-2 text-xs text-slate-300 flex justify-between font-mono">
                  <span>Order: {st.order_qty.toLocaleString()}</span>
                  <span className="text-indigo-300 font-bold">{currencySymbol}{st.total_labour_cost?.toFixed(2)} / pc</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Operation Breakdown Table for Selected Style */}
      {selectedStyle && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Operation Process Breakdown — {selectedStyle.name}</span>
                <span className="text-xs font-mono text-amber-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {selectedStyle.style_code}
                </span>
              </h2>
              <p className="text-xs text-slate-400">{processes.length} sequential sewing processes</p>
            </div>

            {isOwnerAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowCloneModal(true)}
                  className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 px-3 py-2 rounded-xl transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('cloneProcesses')}</span>
                </button>

                <button
                  onClick={() => setShowCSVModal(true)}
                  className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 px-3 py-2 rounded-xl transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('importCSV')}</span>
                </button>

                <button
                  onClick={() => {
                    setEditingProcessId('new');
                    setProcForm({ seq_no: processes.length + 1, name: '', machine_type: 'Single Needle Lockstitch', smv: 1.5, rate: 3.5 });
                  }}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white px-3 py-2 rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Operation</span>
                </button>
              </div>
            )}
          </div>

          {/* Processes List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800 font-mono">
                  <th className="py-3 px-3 w-12 text-center">{t('processSeq')}</th>
                  <th className="py-3 px-3">{t('processName')}</th>
                  <th className="py-3 px-3">{t('machineType')}</th>
                  <th className="py-3 px-3 text-right">{t('smv')}</th>
                  <th className="py-3 px-3 text-right">{t('pieceRate')}</th>
                  {isOwnerAdmin && <th className="py-3 px-3 text-center w-24">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {processes.map((proc, idx) => {
                  const isEditing = editingProcessId === proc.id;
                  return (
                    <tr key={proc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                        {proc.seq_no}
                      </td>

                      <td className="py-3 px-3 font-medium text-white">
                        {isEditing ? (
                          <input
                            type="text"
                            value={procForm.name || ''}
                            onChange={e => setProcForm({ ...procForm, name: e.target.value })}
                            className="bg-slate-950 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white w-full"
                          />
                        ) : (
                          proc.name
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-300">
                        {isEditing ? (
                          <input
                            type="text"
                            value={procForm.machine_type || ''}
                            onChange={e => setProcForm({ ...procForm, machine_type: e.target.value })}
                            className="bg-slate-950 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white w-full"
                          />
                        ) : (
                          <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                            {proc.machine_type || 'Standard'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            value={procForm.smv || ''}
                            onChange={e => setProcForm({ ...procForm, smv: parseFloat(e.target.value) })}
                            className="bg-slate-950 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white w-20 text-right"
                          />
                        ) : (
                          `${proc.smv || 0} min`
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.05"
                            value={procForm.rate || ''}
                            onChange={e => setProcForm({ ...procForm, rate: parseFloat(e.target.value) })}
                            className="bg-slate-950 border border-amber-500 rounded-lg px-2 py-1 text-sm text-amber-400 font-bold w-24 text-right"
                          />
                        ) : (
                          `${currencySymbol}${Number(proc.rate).toFixed(2)}`
                        )}
                      </td>

                      {isOwnerAdmin && (
                        <td className="py-3 px-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleSaveProcess({ id: proc.id, ...procForm })}
                                className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingProcessId(null)}
                                className="p-1 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => {
                                  setEditingProcessId(proc.id);
                                  setProcForm(proc);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProcess(proc.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* Inline Row for Adding New Operation */}
                {editingProcessId === 'new' && (
                  <tr className="bg-indigo-950/30 border-t border-indigo-500/50">
                    <td className="py-3 px-3 text-center font-mono font-bold text-indigo-400">
                      {procForm.seq_no}
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        placeholder="Operation Name"
                        value={procForm.name || ''}
                        onChange={e => setProcForm({ ...procForm, name: e.target.value })}
                        className="bg-slate-900 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white w-full"
                        autoFocus
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        placeholder="Machine Type"
                        value={procForm.machine_type || ''}
                        onChange={e => setProcForm({ ...procForm, machine_type: e.target.value })}
                        className="bg-slate-900 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white w-full"
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="SMV"
                        value={procForm.smv || ''}
                        onChange={e => setProcForm({ ...procForm, smv: parseFloat(e.target.value) })}
                        className="bg-slate-900 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white w-20 text-right"
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        step="0.05"
                        placeholder="Rate"
                        value={procForm.rate || ''}
                        onChange={e => setProcForm({ ...procForm, rate: parseFloat(e.target.value) })}
                        className="bg-slate-900 border border-amber-500 rounded-lg px-2 py-1 text-sm text-amber-400 font-bold w-24 text-right"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleSaveProcess(procForm)}
                          className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingProcessId(null)}
                          className="p-1 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sticky Live Total Labour Cost Footer */}
          <div className="sticky bottom-0 z-20 mt-6 -mx-5 -mb-5 bg-slate-950/95 border-t border-slate-800 p-4 rounded-b-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-2 shadow-2xl">
            <div className="flex items-center space-x-2 text-slate-300 text-sm">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <span className="font-medium">{t('totalLabourCost')}</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight bg-slate-900 px-4 py-1.5 rounded-xl border border-amber-500/30 shadow-inner">
              {currencySymbol}{totalLabourCost.toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ piece</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW STYLE */}
      {showStyleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Garment Style</h3>
            <form onSubmit={handleSaveStyle} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Style Name</label>
                <input
                  type="text"
                  required
                  value={styleForm.name || ''}
                  onChange={e => setStyleForm({ ...styleForm, name: e.target.value })}
                  placeholder="e.g. Slim Fit Denim Shirt"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Style Code (Unique)</label>
                <input
                  type="text"
                  required
                  value={styleForm.style_code || ''}
                  onChange={e => setStyleForm({ ...styleForm, style_code: e.target.value })}
                  placeholder="e.g. ST-2026"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Buyer Name</label>
                <input
                  type="text"
                  value={styleForm.buyer_name || ''}
                  onChange={e => setStyleForm({ ...styleForm, buyer_name: e.target.value })}
                  placeholder="e.g. Zara / H&M"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Order Quantity (pcs)</label>
                <input
                  type="number"
                  value={styleForm.order_qty || 10000}
                  onChange={e => setStyleForm({ ...styleForm, order_qty: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1 font-mono"
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowStyleModal(false)}
                  className="flex-1 bg-slate-800 text-slate-300 font-semibold py-2 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white font-semibold py-2 rounded-xl text-sm"
                >
                  Create Style
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLONE PROCESSES */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Clone Operations from Style</h3>
            <p className="text-xs text-slate-400 mb-4">
              Copy entire list of operations and rates from an existing style into <span className="text-white font-semibold">{selectedStyle?.name}</span>.
            </p>
            <div className="space-y-3">
              <label className="text-xs text-slate-400">Select Source Style</label>
              <select
                value={sourceStyleId}
                onChange={e => setSourceStyleId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="">-- Choose Style --</option>
                {styles.filter(s => s.id !== selectedStyle?.id).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.style_code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowCloneModal(false)}
                className="flex-1 bg-slate-800 text-slate-300 font-semibold py-2 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCloneProcesses}
                disabled={!sourceStyleId}
                className="flex-1 bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm"
              >
                Clone Operations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Import Processes CSV</h3>
            <p className="text-xs text-slate-400 mb-3">
              Paste comma-separated rows: <code className="text-amber-400 bg-slate-800 px-1 py-0.5 rounded">Name, Rate, SMV, MachineType</code>
            </p>
            <textarea
              rows={6}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder="Collar Attach, 4.50, 1.8, Lockstitch&#10;Pocket Attach, 3.80, 1.2, Pattern Sewer"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCSVModal(false)}
                className="flex-1 bg-slate-800 text-slate-300 font-semibold py-2 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCSV}
                className="flex-1 bg-emerald-600 text-white font-semibold py-2 rounded-xl text-sm"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
