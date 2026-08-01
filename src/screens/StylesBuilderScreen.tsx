import React, { useState, useEffect } from 'react';
import { 
  Scissors, Plus, Copy, FileSpreadsheet, Trash2, Edit3, 
  DollarSign, Shirt, Check, X, AlertTriangle, Archive, CheckCircle2,
  Layers, RefreshCw, Calendar, Clock, History, AlertCircle, ArrowUpRight,
  TrendingDown, CheckCircle
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { GarmentStyle, GarmentProcess, UserRole, FactorySettings, ProductionEntry } from '../types';
import { StyleImage } from '../components/StyleImage';
import { StyleImageUploader } from '../components/StyleImageUploader';

interface StylesBuilderScreenProps {
  role: UserRole;
}

export const StylesBuilderScreen: React.FC<StylesBuilderScreenProps> = ({ role }) => {
  const { t } = useTranslation();
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<GarmentStyle | null>(null);
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);

  // Modal / View states
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [sourceStyleId, setSourceStyleId] = useState<string>('');
  const [csvText, setCsvText] = useState('');

  // Inline date editing on card
  const [editingDateStyleId, setEditingDateStyleId] = useState<string | null>(null);
  const [inlineDates, setInlineDates] = useState<{ start_date: string; target_ship_date: string }>({ start_date: '', target_ship_date: '' });

  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionStyle, setCompletionStyle] = useState<GarmentStyle | null>(null);
  const [completionDetails, setCompletionDetails] = useState<{
    pendingAssignmentsCount: number;
    totalPiecesProduced: number;
    totalWagesPaid: number;
    targetLabourCost: number;
    actualLabourCostPerGarment: number;
    variancePerGarment: number;
  } | null>(null);
  const [loadingCompletionDetails, setLoadingCompletionDetails] = useState(false);

  // Clone to New Style Modal State
  const [showCloneNewStyleModal, setShowCloneNewStyleModal] = useState(false);
  const [cloneSourceStyle, setCloneSourceStyle] = useState<GarmentStyle | null>(null);
  const [cloneForm, setCloneForm] = useState({
    style_code: '',
    name: '',
    buyer_name: '',
    order_qty: 10000,
  });

  // Editing single process
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [procForm, setProcForm] = useState<Partial<GarmentProcess>>({});

  // New Style Form
  const [isUploadingStyleImage, setIsUploadingStyleImage] = useState(false);
  const [styleForm, setStyleForm] = useState<Partial<GarmentStyle>>({
    name: '',
    style_code: '',
    buyer_name: '',
    order_qty: 10000,
    start_date: new Date().toISOString().split('T')[0],
    target_ship_date: '',
    status: 'upcoming',
    image_url: null,
  });

  const isOwnerAdmin = role === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [stList, setRes, entriesList] = await Promise.all([
        dataService.getStyles(),
        dataService.getSettings(),
        dataService.getProductionEntries(),
      ]);
      setStyles(stList);
      setSettings(setRes);
      setProductionEntries(entriesList);

      // Main board styles are ONLY active and upcoming
      const mainBoardStyles = stList.filter(s => s.status === 'active' || s.status === 'upcoming');

      if (mainBoardStyles.length > 0 && !selectedStyle) {
        setSelectedStyle(mainBoardStyles[0]);
        loadProcesses(mainBoardStyles[0].id);
      } else if (selectedStyle) {
        const match = stList.find(s => s.id === selectedStyle.id);
        if (match) setSelectedStyle(match);
        loadProcesses(selectedStyle.id);
      }
    } catch (err: any) {
      showErrorToast(`Failed to load production board: ${err.message || String(err)}`);
    }
  };

  const loadProcesses = async (styleId: string) => {
    try {
      const pList = await dataService.getProcesses(styleId);
      setProcesses(pList);
    } catch (err: any) {
      showErrorToast(`Failed to load processes: ${err.message || String(err)}`);
    }
  };

  const handleSelectStyle = (style: GarmentStyle) => {
    setSelectedStyle(style);
    loadProcesses(style.id);
  };

  const handleSaveStyle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (styleForm.start_date && styleForm.target_ship_date) {
      if (styleForm.target_ship_date < styleForm.start_date) {
        showErrorToast('Ship date / delivery deadline cannot be earlier than start date.');
        return;
      }
    }

    try {
      const saved = await dataService.saveStyle(styleForm);
      showSuccessToast(`Style ${saved.style_code} created as ${saved.status}.`);
      setShowStyleModal(false);
      setStyleForm({
        name: '',
        style_code: '',
        buyer_name: '',
        order_qty: 10000,
        start_date: new Date().toISOString().split('T')[0],
        target_ship_date: '',
        status: 'upcoming',
        image_url: null,
      });
      setSelectedStyle(saved);
      await loadData();
      await loadProcesses(saved.id);
    } catch (err: any) {
      showErrorToast(`Failed to create style: ${err.message || String(err)}`);
    }
  };

  const handleRequestStatusChange = async (style: GarmentStyle, targetStatus: 'upcoming' | 'active' | 'completed' | 'archived') => {
    if (targetStatus === 'completed') {
      setCompletionStyle(style);
      setShowCompletionModal(true);
      setLoadingCompletionDetails(true);
      try {
        const details = await dataService.getStyleCompletionDetails(style.id);
        setCompletionDetails(details);
      } catch (err: any) {
        showErrorToast(`Failed to load completion details: ${err.message || String(err)}`);
      } finally {
        setLoadingCompletionDetails(false);
      }
    } else {
      try {
        await dataService.saveStyle({ id: style.id, status: targetStatus });
        
        if (targetStatus === 'archived') {
          showSuccessToast(`Style ${style.style_code} marked as ${targetStatus}. Moved to Order History.`);
        } else {
          showSuccessToast(`Style ${style.style_code} status updated to ${targetStatus}.`);
        }
        
        await loadData();
      } catch (err: any) {
        showErrorToast(`Failed to update status: ${err.message || String(err)}`);
      }
    }
  };

  const handleConfirmCompleteStyle = async () => {
    if (!completionStyle) return;
    try {
      await dataService.saveStyle({ id: completionStyle.id, status: 'completed' });
      showSuccessToast(`Style ${completionStyle.style_code} marked as Completed. Moved to Order History.`);
      setShowCompletionModal(false);
      setCompletionStyle(null);
      setCompletionDetails(null);
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to mark style completed: ${err.message || String(err)}`);
    }
  };

  const handleSaveInlineDates = async (style: GarmentStyle) => {
    if (inlineDates.start_date && inlineDates.target_ship_date) {
      if (inlineDates.target_ship_date < inlineDates.start_date) {
        showErrorToast('Ship date cannot be earlier than start date.');
        return;
      }
    }

    try {
      await dataService.saveStyle({
        id: style.id,
        start_date: inlineDates.start_date || null,
        target_ship_date: inlineDates.target_ship_date || null,
      });
      showSuccessToast(`Dates updated for ${style.style_code}.`);
      setEditingDateStyleId(null);
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to update dates: ${err.message || String(err)}`);
    }
  };

  const handleDeleteStyle = async (styleId: string, styleCode: string) => {
    try {
      await dataService.deleteStyle(styleId);
      showSuccessToast(`Style ${styleCode} deleted.`);
      if (selectedStyle?.id === styleId) {
        setSelectedStyle(null);
        setProcesses([]);
      }
      await loadData();
    } catch (err: any) {
      showErrorToast(err.message || 'Cannot delete style.');
    }
  };

  const handleDeleteProcess = async (id: string) => {
    if (!selectedStyle) return;
    try {
      await dataService.deleteProcess(id);
      showSuccessToast('Operation deleted successfully.');
      await loadProcesses(selectedStyle.id);
      await loadData();
    } catch (err: any) {
      showErrorToast(err.message || 'Cannot delete operation.');
    }
  };

  const handleSaveProcess = async (procData: Partial<GarmentProcess>) => {
    if (!selectedStyle) return;
    try {
      await dataService.saveProcess({
        ...procData,
        style_id: selectedStyle.id,
      });
      setEditingProcessId(null);
      setProcForm({});
      await loadProcesses(selectedStyle.id);
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to save operation: ${err.message || String(err)}`);
    }
  };

  const handleCloneProcesses = async () => {
    if (!selectedStyle || !sourceStyleId) return;
    try {
      const cloned = await dataService.cloneProcesses(selectedStyle.id, sourceStyleId);
      showSuccessToast(`${cloned.length} operations cloned.`);
      setShowCloneModal(false);
      setSourceStyleId('');
      await loadProcesses(selectedStyle.id);
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to clone processes: ${err.message || String(err)}`);
    }
  };

  const handleOpenCloneNewStyle = (style: GarmentStyle) => {
    setCloneSourceStyle(style);
    setCloneForm({
      style_code: `${style.style_code}-REV`,
      name: `${style.name} (Repeat)`,
      buyer_name: style.buyer_name || '',
      order_qty: style.order_qty || 10000,
    });
    setShowCloneNewStyleModal(true);
  };

  const handleConfirmCloneNewStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSourceStyle) return;
    try {
      const newStyle = await dataService.cloneStyleWithProcesses(
        cloneSourceStyle.id,
        cloneForm.style_code,
        cloneForm.name,
        cloneForm.buyer_name,
        cloneForm.order_qty
      );
      showSuccessToast(`Repeat order style ${newStyle.style_code} created with cloned operations.`);
      setShowCloneNewStyleModal(false);
      setCloneSourceStyle(null);
      await loadData();
      setSelectedStyle(newStyle);
      await loadProcesses(newStyle.id);
    } catch (err: any) {
      showErrorToast(`Failed to clone to new style: ${err.message || String(err)}`);
    }
  };

  const handleImportCSV = async () => {
    if (!selectedStyle || !csvText.trim()) return;
    try {
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
      showSuccessToast('CSV operations imported.');
      setShowCSVModal(false);
      setCsvText('');
      await loadProcesses(selectedStyle.id);
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to import CSV: ${err.message || String(err)}`);
    }
  };

  // Compute 7-day average output for a style
  const get7DayAvgForStyle = (styleId: string) => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    const startDateStr = sevenDaysAgo.toISOString().split('T')[0];

    const styleEntries = productionEntries.filter(
      e => e.style_id === styleId && e.entry_date && e.entry_date >= startDateStr
    );

    const totalPieces7d = styleEntries.reduce((sum, e) => sum + Number(e.qty_ok || 0), 0);
    return Math.round(totalPieces7d / 7);
  };

  // Pace & Schedule Helper
  const getPaceMetrics = (style: GarmentStyle) => {
    const avgDaily7d = get7DayAvgForStyle(style.id);
    const completed = style.completed_pieces || 0;
    const remaining = Math.max(0, (style.order_qty || 0) - completed);

    if (!style.target_ship_date) {
      return {
        hasNoDate: true,
        daysRemaining: null,
        isOverdue: false,
        isUrgent: false,
        requiredDailyOutput: 0,
        avgDaily7d,
        isBehindPace: false,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shipDate = new Date(style.target_ship_date);
    shipDate.setHours(0, 0, 0, 0);

    const diffTime = shipDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isOverdue = daysRemaining < 0;
    const isUrgent = daysRemaining >= 0 && daysRemaining <= 7;

    const remainingWorkingDays = Math.max(1, daysRemaining);
    const requiredDailyOutput = Math.ceil(remaining / remainingWorkingDays);

    const isBehindPace = style.status === 'active' && remaining > 0 && avgDaily7d < requiredDailyOutput;

    return {
      hasNoDate: false,
      daysRemaining,
      isOverdue,
      isUrgent,
      requiredDailyOutput,
      avgDaily7d,
      isBehindPace,
    };
  };

  // Group Main Board Styles
  // Section 1: In Production (status active), sorted by target_ship_date soonest first
  const activeStyles = styles
    .filter(s => s.status === 'active')
    .sort((a, b) => {
      if (!a.target_ship_date) return 1;
      if (!b.target_ship_date) return -1;
      return new Date(a.target_ship_date).getTime() - new Date(b.target_ship_date).getTime();
    });

  // Section 2: Upcoming (status upcoming), sorted by start_date soonest first
  const upcomingStyles = styles
    .filter(s => s.status === 'upcoming')
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });

  // History styles (completed + archived)
  const historyStyles = styles.filter(s => s.status === 'completed' || s.status === 'archived');

  const totalLabourCost = processes.reduce((sum, p) => sum + Number(p.rate || 0), 0);
  const currencySymbol = settings?.currency_symbol || '৳';

  // RENDER STYLE CARD COMPONENT
  const renderStyleCard = (st: GarmentStyle) => {
        const isSelected = selectedStyle?.id === st.id;
        const pace = getPaceMetrics(st);
        const isEditingDates = editingDateStyleId === st.id;
        const completedPieces = st.completed_pieces || 0;
        const progressPct = Math.min(100, Math.round((completedPieces / (st.order_qty || 1)) * 100));

        return (
          <div
            key={st.id}
            onClick={() => handleSelectStyle(st)}
            className={`p-5 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between space-y-4 relative ${
              pace.isBehindPace
                ? 'bg-white border-amber-500 shadow-xs ring-1 ring-amber-500/30'
                : isSelected
                ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-600/20'
                : 'bg-white border-stone-200 hover:border-stone-300 shadow-xs'
            }`}
          >
            {/* Top Row: Code, Status Badge, Image, Title */}
            <div className="flex space-x-3">
              <StyleImage
                imageUrl={st.image_url}
                styleName={st.name}
                className="w-16 h-16 rounded-2xl object-cover border border-stone-200"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                    {st.style_code}
                  </span>

                  {/* Status selector */}
                  <select
                    value={st.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => handleRequestStatusChange(st, e.target.value as any)}
                    className={`text-[10px] font-bold uppercase rounded-lg px-2 py-0.5 border cursor-pointer focus:outline-none ${
                      st.status === 'active'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : st.status === 'upcoming'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                        : st.status === 'completed'
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-stone-100 border-stone-300 text-stone-700'
                    }`}
                  >
                    <option value="upcoming" className="bg-white text-stone-900">Upcoming</option>
                    <option value="active" className="bg-white text-stone-900">Active</option>
                    <option value="completed" className="bg-white text-stone-900">Completed</option>
                    <option value="archived" className="bg-white text-stone-900">Archived</option>
                  </select>
                </div>

                <h3 className="font-bold text-stone-900 text-base truncate">{st.name}</h3>
                <p className="text-xs text-stone-600 truncate">{st.buyer_name || 'Generic Buyer'}</p>
              </div>
            </div>

            {/* Dates & Deadline Section */}
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-2" onClick={e => e.stopPropagation()}>
              {isEditingDates ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-stone-600 block font-medium">Start Date</label>
                      <input
                        type="date"
                        value={inlineDates.start_date}
                        onChange={e => setInlineDates({ ...inlineDates, start_date: e.target.value })}
                        className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 block font-medium">Ship Date</label>
                      <input
                        type="date"
                        value={inlineDates.target_ship_date}
                        onChange={e => setInlineDates({ ...inlineDates, target_ship_date: e.target.value })}
                        className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-900"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-1.5 pt-1">
                    <button
                      onClick={() => setEditingDateStyleId(null)}
                      className="px-2 py-1 bg-stone-200 text-stone-800 rounded text-[10px] font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveInlineDates(st)}
                      className="px-2.5 py-1 bg-indigo-700 text-white rounded text-[10px] font-bold"
                    >
                      Save Dates
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-stone-500 font-semibold uppercase block">Start Date</span>
                    <span className="text-stone-800 font-mono font-medium">
                      {st.start_date ? new Date(st.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (
                        <button
                          onClick={() => {
                            setEditingDateStyleId(st.id);
                            setInlineDates({ start_date: st.start_date || '', target_ship_date: st.target_ship_date || '' });
                          }}
                          className="text-stone-500 hover:text-amber-800 underline font-normal text-[11px]"
                        >
                          No date set
                        </button>
                      )}
                    </span>
                  </div>

                  <div className="text-right space-y-0.5">
                    <span className="text-[10px] text-stone-500 font-semibold uppercase block">Ship Deadline</span>
                    <span className="text-stone-800 font-mono font-medium">
                      {st.target_ship_date ? new Date(st.target_ship_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (
                        <button
                          onClick={() => {
                            setEditingDateStyleId(st.id);
                            setInlineDates({ start_date: st.start_date || '', target_ship_date: st.target_ship_date || '' });
                          }}
                          className="text-stone-500 hover:text-amber-800 underline font-normal text-[11px]"
                        >
                          No date set
                        </button>
                      )}
                    </span>
                  </div>

                  {/* Prominent Days Remaining Figure */}
                  <div className="text-right pl-2 border-l border-stone-200 shrink-0">
                    {pace.hasNoDate ? (
                      <button
                        onClick={() => {
                          setEditingDateStyleId(st.id);
                          setInlineDates({ start_date: st.start_date || '', target_ship_date: st.target_ship_date || '' });
                        }}
                        className="text-[10px] text-stone-500 hover:text-indigo-700 underline"
                      >
                        Set dates
                      </button>
                    ) : pace.isOverdue ? (
                      <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-wider block">
                        OVERDUE
                      </span>
                    ) : (
                      <div>
                        <span className={`text-base font-black font-mono block ${pace.isUrgent ? 'text-amber-800' : 'text-indigo-800'}`}>
                          {pace.daysRemaining}d
                        </span>
                        <span className="text-[9px] text-stone-500 font-semibold uppercase">left</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar & Output Numbers */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-stone-600">Order: {(st.order_qty || 0).toLocaleString()} pcs</span>
                <span className="text-emerald-700 font-bold">{completedPieces.toLocaleString()} pcs ({progressPct}%)</span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    progressPct >= 100 ? 'bg-emerald-700' : 'bg-indigo-700'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Daily Output Pace Comparison (Required vs Actual 7-Day) */}
            <div className="bg-stone-50 p-2.5 rounded-2xl border border-stone-200 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-[10px] text-stone-500 block font-sans">Required Pace</span>
                <span className="font-bold text-stone-900">
                  {pace.requiredDailyOutput > 0 ? `${pace.requiredDailyOutput.toLocaleString()}/day` : '—'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-stone-500 block font-sans">Actual (7-Day Avg)</span>
                <span className={`font-bold ${pace.isBehindPace ? 'text-amber-800' : 'text-emerald-700'}`}>
                  {pace.avgDaily7d.toLocaleString()}/day
                </span>
              </div>

              <div className="text-right border-l border-stone-200 pl-2">
                <span className="text-[10px] text-stone-500 block font-sans">Labour Cost</span>
                <span className="font-bold text-amber-800">
                  {currencySymbol}{(st.total_labour_cost || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Behind Schedule Pace Warning Banner */}
            {pace.isBehindPace && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-900 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-medium text-[11px]">
                  Behind schedule — need <span className="font-bold">{pace.requiredDailyOutput.toLocaleString()}</span>/day, running <span className="font-bold">{pace.avgDaily7d.toLocaleString()}</span>/day
                </span>
              </div>
            )}

            {/* Card Actions Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-200" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleOpenCloneNewStyle(st)}
                title="Clone to new style code (Repeat order)"
                className="flex items-center space-x-1 text-[11px] text-amber-800 hover:text-amber-900 font-bold"
              >
                <Layers className="w-3.5 h-3.5 text-amber-700" />
                <span>Repeat Order</span>
              </button>

              {isOwnerAdmin && (
                <button
                  onClick={() => handleDeleteStyle(st.id, st.style_code)}
                  title="Delete style"
                  className="p-1 text-stone-400 hover:text-rose-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
  };

  return (
    <div className="space-y-8 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-stone-200 p-5 rounded-3xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl">
              <Scissors className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Production Board & Styles</h1>
          </div>
          <p className="text-xs text-stone-600 pl-1">
            Real-time shopfloor order tracking, daily delivery pace, and operation rates
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Order History Button */}
          <button
            onClick={() => setShowOrderHistory(true)}
            className="flex items-center space-x-2 bg-stone-100 hover:bg-stone-200 text-amber-900 font-bold px-4 py-2.5 rounded-xl border border-stone-200 transition-all text-xs shadow-xs"
          >
            <History className="w-4 h-4 text-amber-800" />
            <span>Order History ({historyStyles.length})</span>
          </button>

          {isOwnerAdmin && (
            <button
              onClick={() => setShowStyleModal(true)}
              className="flex items-center space-x-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Style Order</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN PRODUCTION BOARD: TWO SECTIONS */}
      <div className="space-y-8">
        {/* SECTION 1: IN PRODUCTION (ACTIVE) */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3 border-b border-stone-200 pb-3">
            <div className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse" />
            <h2 className="text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
              <span>In Production</span>
              <span className="text-sm font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                {activeStyles.length}
              </span>
            </h2>
            <span className="text-xs text-stone-600 font-normal">Active styles sorted by ship date (soonest first)</span>
          </div>

          {activeStyles.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-6 text-center text-stone-600 text-xs">
              No styles currently active in production.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeStyles.map(st => renderStyleCard(st))}
            </div>
          )}
        </div>

        {/* SECTION 2: UPCOMING ORDERS */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center space-x-3 border-b border-stone-200 pb-3">
            <div className="w-3 h-3 rounded-full bg-indigo-600" />
            <h2 className="text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
              <span>Upcoming Orders</span>
              <span className="text-sm font-mono text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
                {upcomingStyles.length}
              </span>
            </h2>
            <span className="text-xs text-stone-600 font-normal">Planned styles sorted by start date (soonest first)</span>
          </div>

          {upcomingStyles.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-6 text-center text-stone-600 text-xs">
              No upcoming styles scheduled. Add a new style order to queue next orders.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {upcomingStyles.map(st => renderStyleCard(st))}
            </div>
          )}
        </div>
      </div>

      {/* OPERATION BREAKDOWN TABLE FOR SELECTED STYLE */}
      {selectedStyle && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <span>Operation Process Breakdown — {selectedStyle.name}</span>
                  <span className="text-xs font-mono text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300 font-bold">
                    {selectedStyle.style_code}
                  </span>
                </h2>

                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  selectedStyle.status === 'completed'
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : selectedStyle.status === 'upcoming'
                    ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                    : selectedStyle.status === 'archived'
                    ? 'bg-stone-100 text-stone-700 border border-stone-300'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {selectedStyle.status}
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-1">{processes.length} sequential sewing operations</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenCloneNewStyle(selectedStyle)}
                className="flex items-center space-x-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-xs font-bold text-amber-900 px-3 py-2 rounded-xl transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-amber-800" />
                <span>Clone to New Style</span>
              </button>

              {isOwnerAdmin && (
                <>
                  <button
                    onClick={() => setShowCloneModal(true)}
                    className="flex items-center space-x-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-xs font-medium text-stone-800 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-stone-600" />
                    <span>Import Operations</span>
                  </button>

                  <button
                    onClick={() => setShowCSVModal(true)}
                    className="flex items-center space-x-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-xs font-medium text-stone-800 px-3 py-2 rounded-xl transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{t('importCSV')}</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingProcessId('new');
                      setProcForm({ seq_no: processes.length + 1, name: '', machine_type: 'Single Needle Lockstitch', smv: 1.5, rate: 3.5 });
                    }}
                    className="flex items-center space-x-1.5 bg-indigo-700 hover:bg-indigo-800 text-xs font-bold text-white px-3 py-2 rounded-xl transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Operation</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Processes List Table */}
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[500px]">
              <thead>
                <tr className="text-xs text-stone-600 uppercase bg-stone-50 border-b border-stone-200 font-mono">
                  <th className="py-3 px-3 w-12 text-center">{t('processSeq')}</th>
                  <th className="py-3 px-3">{t('processName')}</th>
                  <th className="py-3 px-3">{t('machineType')}</th>
                  <th className="py-3 px-3 text-right">{t('smv')}</th>
                  <th className="py-3 px-3 text-right">{t('pieceRate')}</th>
                  {isOwnerAdmin && <th className="py-3 px-3 text-center w-24">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {processes.map((proc) => {
                  const isEditing = editingProcessId === proc.id;
                  return (
                    <tr key={proc.id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-stone-600">
                        {proc.seq_no}
                      </td>

                      <td className="py-3 px-3 font-medium text-stone-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={procForm.name || ''}
                            onChange={e => setProcForm({ ...procForm, name: e.target.value })}
                            className="bg-stone-50 border border-indigo-600 rounded-lg px-2 py-1 text-sm text-stone-900 w-full"
                          />
                        ) : (
                          proc.name
                        )}
                      </td>

                      <td className="py-3 px-3 text-stone-700">
                        {isEditing ? (
                          <input
                            type="text"
                            value={procForm.machine_type || ''}
                            onChange={e => setProcForm({ ...procForm, machine_type: e.target.value })}
                            className="bg-stone-50 border border-indigo-600 rounded-lg px-2 py-1 text-sm text-stone-900 w-full"
                          />
                        ) : (
                          <span className="text-xs bg-stone-100 border border-stone-200 px-2 py-1 rounded text-stone-700">
                            {proc.machine_type || 'Standard'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-stone-700">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            value={procForm.smv || ''}
                            onChange={e => setProcForm({ ...procForm, smv: parseFloat(e.target.value) })}
                            className="bg-stone-50 border border-indigo-600 rounded-lg px-2 py-1 text-sm text-stone-900 w-20 text-right"
                          />
                        ) : (
                          `${proc.smv || 0} min`
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-800">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.05"
                            value={procForm.rate || ''}
                            onChange={e => setProcForm({ ...procForm, rate: parseFloat(e.target.value) })}
                            className="bg-stone-50 border border-amber-500 rounded-lg px-2 py-1 text-sm text-amber-800 font-bold w-24 text-right"
                          />
                        ) : (
                          `${currencySymbol}${Number(proc.rate || 0).toFixed(2)}`
                        )}
                      </td>

                      {isOwnerAdmin && (
                        <td className="py-3 px-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleSaveProcess({ id: proc.id, ...procForm })}
                                className="p-1 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingProcessId(null)}
                                className="p-1 bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300"
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
                                className="p-1 text-stone-500 hover:text-indigo-700 hover:bg-stone-100 rounded-lg transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProcess(proc.id)}
                                className="p-1 text-stone-500 hover:text-rose-700 hover:bg-stone-100 transition-colors"
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
                  <tr className="bg-indigo-50/50 border-t border-indigo-200">
                    <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">
                      {procForm.seq_no}
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        placeholder="Operation Name"
                        value={procForm.name || ''}
                        onChange={e => setProcForm({ ...procForm, name: e.target.value })}
                        className="bg-white border border-indigo-600 rounded-lg px-2 py-1 text-sm text-stone-900 w-full"
                        autoFocus
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        placeholder="Machine Type"
                        value={procForm.machine_type || ''}
                        onChange={e => setProcForm({ ...procForm, machine_type: e.target.value })}
                        className="bg-white border border-indigo-600 rounded-lg px-2 py-1 text-sm text-stone-900 w-full"
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="SMV"
                        value={procForm.smv || ''}
                        onChange={e => setProcForm({ ...procForm, smv: parseFloat(e.target.value) })}
                        className="bg-white border border-indigo-600 rounded-lg px-2 py-1 text-sm text-stone-900 w-20 text-right"
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        step="0.05"
                        placeholder="Rate"
                        value={procForm.rate || ''}
                        onChange={e => setProcForm({ ...procForm, rate: parseFloat(e.target.value) })}
                        className="bg-white border border-amber-500 rounded-lg px-2 py-1 text-sm text-amber-800 font-bold w-24 text-right"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleSaveProcess(procForm)}
                          className="p-1 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingProcessId(null)}
                          className="p-1 bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300"
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

          {/* Sticky Total Labour Cost Footer */}
          <div className="bg-stone-50 border-t border-stone-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center space-x-2 text-stone-700 text-sm">
              <DollarSign className="w-5 h-5 text-amber-800" />
              <span className="font-medium">{t('totalLabourCost')}</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-800 font-mono tracking-tight bg-white px-4 py-1.5 rounded-xl border border-amber-300">
              {currencySymbol}{totalLabourCost.toFixed(2)} <span className="text-xs text-stone-600 font-normal">/ piece</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ORDER HISTORY (COMPLETED & ARCHIVED STYLES) */}
      {showOrderHistory && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900">Order History & Archived Styles</h3>
                  <p className="text-xs text-stone-600">Completed order records and historical factory styles</p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderHistory(false)}
                className="text-stone-400 hover:text-stone-900 p-2 rounded-xl bg-stone-100 hover:bg-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyStyles.length === 0 ? (
              <div className="py-12 text-center text-stone-600 text-xs">
                No completed or archived styles in history yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historyStyles.map(st => (
                  <div key={st.id} className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
                    <div className="flex space-x-3">
                      <StyleImage
                        imageUrl={st.image_url}
                        styleName={st.name}
                        className="w-14 h-14 rounded-xl object-cover border border-stone-200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">{st.style_code}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            st.status === 'completed'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-stone-100 text-stone-700 border border-stone-300'
                          }`}>
                            {st.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-stone-900 text-sm truncate mt-0.5">{st.name}</h4>
                        <p className="text-xs text-stone-600 truncate">{st.buyer_name || 'Generic Buyer'}</p>
                      </div>
                    </div>

                    <div className="text-xs text-stone-600 flex justify-between font-mono pt-2 border-t border-stone-200">
                      <span>Order: {(st.order_qty || 0).toLocaleString()} pcs</span>
                      <span className="text-amber-800 font-bold">{currencySymbol}{(st.total_labour_cost || 0).toFixed(2)}/pc</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-stone-500">Status:</span>
                        <select
                          value={st.status}
                          onChange={e => handleRequestStatusChange(st, e.target.value as any)}
                          className="bg-white border border-stone-200 text-stone-800 text-xs rounded px-1.5 py-0.5"
                        >
                          <option value="active">Reactivate</option>
                          <option value="upcoming">Move to Upcoming</option>
                          <option value="completed">Completed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>

                      <button
                        onClick={() => {
                          setShowOrderHistory(false);
                          handleOpenCloneNewStyle(st);
                        }}
                        className="flex items-center space-x-1 text-xs text-indigo-700 hover:text-indigo-800 font-bold"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Repeat Order</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: MARK STYLE COMPLETED SUMMARY */}
      {showCompletionModal && completionStyle && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-6 h-6 text-blue-700" />
                <h3 className="text-lg font-bold text-stone-900">Complete Style Order — Summary</h3>
              </div>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="text-stone-400 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-stone-700">
                You are marking style <span className="font-bold text-amber-900 font-mono bg-amber-100 px-1 rounded border border-amber-300">{completionStyle.style_code}</span> ({completionStyle.name}) as <span className="text-blue-800 font-bold uppercase">Completed</span>.
              </p>
            </div>

            {loadingCompletionDetails ? (
              <div className="py-8 text-center text-stone-600 flex items-center justify-center space-x-2">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-700" />
                <span>Calculating order summary & actual labour cost...</span>
              </div>
            ) : completionDetails ? (
              <div className="space-y-4">
                {/* Pending assignments warning banner */}
                {completionDetails.pendingAssignmentsCount > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-amber-900">Pending Daily Assignments Warning</span>
                      There are currently {completionDetails.pendingAssignmentsCount} active or planned worker assignment(s) scheduled for today or later on this style. Completing the style will wrap up the order lifecycle.
                    </div>
                  </div>
                )}

                {/* Performance Summary Comparison Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                    <span className="text-[11px] text-stone-600 block font-medium">Finished Output</span>
                    <span className="text-base font-black text-stone-900 font-mono mt-0.5 block">
                      {completionDetails.totalPiecesProduced.toLocaleString()} pcs
                    </span>
                  </div>

                  <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                    <span className="text-[11px] text-stone-600 block font-medium">Total Wages Paid</span>
                    <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                      {currencySymbol}{(completionDetails.totalWagesPaid || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                    <span className="text-[11px] text-stone-600 block font-medium">Target Cost / Garment</span>
                    <span className="text-base font-black text-indigo-800 font-mono mt-0.5 block">
                      {currencySymbol}{(completionDetails.targetLabourCost || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                    <span className="text-[11px] text-stone-600 block font-medium">Actual Cost / Garment</span>
                    <span className="text-base font-black text-amber-800 font-mono mt-0.5 block">
                      {currencySymbol}{(completionDetails.actualLabourCostPerGarment || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Cost Variance Comparison Box */}
                <div className={`p-4 rounded-2xl border text-xs flex justify-between items-center ${
                  completionDetails.variancePerGarment > 0
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : completionDetails.variancePerGarment < 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-stone-100 border-stone-200 text-stone-800'
                }`}>
                  <div>
                    <span className="font-bold block text-stone-900 text-sm">Labour Cost Variance</span>
                    <span className="text-[11px] opacity-80">Actual versus sum of standard process rates</span>
                  </div>
                  <div className="text-right font-mono font-bold text-sm">
                    {completionDetails.variancePerGarment > 0
                      ? `+${currencySymbol}${(completionDetails.variancePerGarment || 0).toFixed(2)} / pc`
                      : completionDetails.variancePerGarment < 0
                      ? `-${currencySymbol}${Math.abs(completionDetails.variancePerGarment || 0).toFixed(2)} / pc`
                      : `${currencySymbol}0.00 (On Target)`}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCompletionModal(false)}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold py-2.5 rounded-xl text-xs transition-colors border border-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteStyle}
                disabled={loadingCompletionDetails}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-xs"
              >
                Confirm & Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLONE TO NEW STYLE CODE (REPEAT ORDER) */}
      {showCloneNewStyleModal && cloneSourceStyle && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-amber-800" />
                <h3 className="text-base font-bold text-stone-900">Clone to New Style (Repeat Order)</h3>
              </div>
              <button
                onClick={() => setShowCloneNewStyleModal(false)}
                className="text-stone-400 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Copy all operation breakdowns, SMVs, and piece rates from <span className="text-stone-900 font-semibold">{cloneSourceStyle.style_code}</span> into a new style order.
            </p>

            <form onSubmit={handleConfirmCloneNewStyle} className="space-y-3">
              <div>
                <label className="text-xs text-stone-700 font-medium">New Style Code *</label>
                <input
                  type="text"
                  required
                  value={cloneForm.style_code}
                  onChange={e => setCloneForm({ ...cloneForm, style_code: e.target.value })}
                  placeholder="e.g. MS-2401-B"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 font-mono mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-stone-700 font-medium">New Style Name *</label>
                <input
                  type="text"
                  required
                  value={cloneForm.name}
                  onChange={e => setCloneForm({ ...cloneForm, name: e.target.value })}
                  placeholder="e.g. Men's Formal Shirt (Repeat Order)"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-stone-700 font-medium">Buyer Name</label>
                <input
                  type="text"
                  value={cloneForm.buyer_name}
                  onChange={e => setCloneForm({ ...cloneForm, buyer_name: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-stone-700 font-medium">Order Quantity (pcs)</label>
                <input
                  type="number"
                  value={cloneForm.order_qty}
                  onChange={e => setCloneForm({ ...cloneForm, order_qty: parseInt(e.target.value) || 0 })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 font-mono mt-1"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCloneNewStyleModal(false)}
                  className="flex-1 bg-stone-100 text-stone-800 font-semibold py-2 rounded-xl text-xs border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs shadow-xs"
                >
                  Create Cloned Style
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW STYLE ORDER */}
      {showStyleModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-lg font-bold text-stone-900">Add Style Order</h3>
              <button onClick={() => setShowStyleModal(false)} className="text-stone-400 hover:text-stone-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStyle} className="space-y-3">
              {/* Image Uploader */}
              <div className="pb-2 border-b border-stone-200">
                <StyleImageUploader
                  currentImageUrl={styleForm.image_url}
                  styleCode={styleForm.style_code || 'STYLE'}
                  onImageChanged={(url) => setStyleForm(prev => ({ ...prev, image_url: url }))}
                  onUploadingStateChange={setIsUploadingStyleImage}
                />
              </div>

              <div>
                <label className="text-xs text-stone-700 block font-medium">Style Name *</label>
                <input
                  type="text"
                  required
                  value={styleForm.name || ''}
                  onChange={e => setStyleForm({ ...styleForm, name: e.target.value })}
                  placeholder="e.g. Slim Fit Denim Shirt"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-stone-700 block font-medium">Style Code (Unique) *</label>
                <input
                  type="text"
                  required
                  value={styleForm.style_code || ''}
                  onChange={e => setStyleForm({ ...styleForm, style_code: e.target.value })}
                  placeholder="e.g. ST-2026"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-stone-700 block font-medium">Buyer Name</label>
                  <input
                    type="text"
                    value={styleForm.buyer_name || ''}
                    onChange={e => setStyleForm({ ...styleForm, buyer_name: e.target.value })}
                    placeholder="e.g. Zara / H&M"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-700 block font-medium">Order Quantity (pcs)</label>
                  <input
                    type="number"
                    value={styleForm.order_qty || 10000}
                    onChange={e => setStyleForm({ ...styleForm, order_qty: parseInt(e.target.value) || 0 })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-stone-700 block font-medium">Start Date</label>
                  <input
                    type="date"
                    value={styleForm.start_date || ''}
                    onChange={e => setStyleForm({ ...styleForm, start_date: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-700 block font-medium">Target Ship Deadline</label>
                  <input
                    type="date"
                    value={styleForm.target_ship_date || ''}
                    onChange={e => setStyleForm({ ...styleForm, target_ship_date: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-700 block font-medium">Initial Status</label>
                <select
                  value={styleForm.status || 'upcoming'}
                  onChange={e => setStyleForm({ ...styleForm, status: e.target.value as any })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1 font-bold"
                >
                  <option value="upcoming">Upcoming (Scheduled)</option>
                  <option value="active">Active (In Production)</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowStyleModal(false)}
                  className="flex-1 bg-stone-100 text-stone-800 font-semibold py-2.5 rounded-xl text-xs border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingStyleImage}
                  className="flex-1 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-xs flex items-center justify-center space-x-2"
                >
                  {isUploadingStyleImage ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading Image...</span>
                    </>
                  ) : (
                    <span>Create Style Order</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLONE PROCESSES INTO EXISTING STYLE */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Import Operations from Existing Style</h3>
            <p className="text-xs text-stone-600 mb-4">
              Copy entire list of operations and rates from an existing style into <span className="text-stone-900 font-semibold">{selectedStyle?.name}</span>.
            </p>
            <div className="space-y-3">
              <label className="text-xs text-stone-700">Select Source Style</label>
              <select
                value={sourceStyleId}
                onChange={e => setSourceStyleId(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900"
              >
                <option value="">-- Choose Style --</option>
                {styles.filter(s => s.id !== selectedStyle?.id).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.style_code} — {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowCloneModal(false)}
                className="flex-1 bg-stone-100 text-stone-800 font-semibold py-2 rounded-xl text-sm border border-stone-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCloneProcesses}
                disabled={!sourceStyleId}
                className="flex-1 bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm shadow-xs"
              >
                Clone Operations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Import Processes CSV</h3>
            <p className="text-xs text-stone-600 mb-3">
              Paste comma-separated rows: <code className="text-amber-900 bg-amber-100 px-1 py-0.5 rounded border border-amber-300 font-bold">Name, Rate, SMV, MachineType</code>
            </p>
            <textarea
              rows={6}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder="Collar Stitch, 4.5, 1.8, Lockstitch&#10;Sleeve Hem, 3.2, 1.2, Overlock"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-mono text-stone-900 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCSVModal(false)}
                className="flex-1 bg-stone-100 text-stone-800 font-semibold py-2 rounded-xl text-sm border border-stone-200"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCSV}
                className="flex-1 bg-emerald-700 text-white font-semibold py-2 rounded-xl text-sm shadow-xs"
              >
                Import Operations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StylesBuilderScreen;
