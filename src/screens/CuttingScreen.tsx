import React, { useState, useEffect, useMemo } from 'react';
import { 
  Scissors, Plus, AlertTriangle, CheckCircle2, Clock, 
  Calendar, Layers, Filter, Image as ImageIcon, FileText, 
  Upload, Sparkles, AlertCircle, Check, X, Tag, UserCheck, Trash2, ClipboardList
} from 'lucide-react';
import { dataService } from '../lib/dataService';
import { supabase } from '../lib/supabase';
import { 
  GarmentStyle, CuttingEntry, GarmentSample, Worker, 
  UserRole, SampleType, SampleStatus, CutType, StyleSize, StyleSizeBreakdownRow 
} from '../types';
import { showSuccessToast, showErrorToast } from '../lib/toast';
import { StyleImageLightbox } from '../components/StyleImageLightbox';
import { NewStyleBadge } from '../components/NewStyleBadge';
import { ViewEntriesModal } from '../components/ViewEntriesModal';

interface CuttingScreenProps {
  role: UserRole;
}

const SAMPLE_TYPES: SampleType[] = [
  'Proto', 'Fit', 'Size Set', 'PP', 'Photo', 'Salesman', 'TOP', 'Counter'
];

const SAMPLE_STATUSES: SampleStatus[] = [
  'Pending', 'Cutting', 'Sewing', 'Submitted', 'Approved', 'Rejected', 'Revision'
];

export const CuttingScreen: React.FC<CuttingScreenProps> = ({ role }) => {
  const [activeTab, setActiveTab] = useState<'board' | 'samples'>('board');
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [cuttingEntries, setCuttingEntries] = useState<CuttingEntry[]>([]);
  const [samples, setSamples] = useState<GarmentSample[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // View Entries Modal State (Admin Only)
  const [viewEntriesTarget, setViewEntriesTarget] = useState<{
    styleId: string;
    styleCode: string;
    styleName: string;
  } | null>(null);

  // Modal States
  const [isCutModalOpen, setIsCutModalOpen] = useState<boolean>(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
  const [editingSample, setEditingSample] = useState<GarmentSample | null>(null);

  // Cut Form
  const [availableSizes, setAvailableSizes] = useState<StyleSize[]>([]);
  const [cutForm, setCutForm] = useState({
    style_id: '',
    cut_type: 'bulk' as CutType,
    entry_date: new Date().toISOString().split('T')[0],
    pieces_cut: '',
    size: '',
    tables_layers: '',
    worker_id: '',
    notes: ''
  });
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sizeActualCuts, setSizeActualCuts] = useState<Record<string, number | string>>({});
  const [cuttingReason, setCuttingReason] = useState<string>('');

  // Sample Form
  const [sampleForm, setSampleForm] = useState({
    style_id: '',
    sample_type: 'PP' as SampleType,
    status: 'Pending' as SampleStatus,
    qty: '1',
    size: 'M',
    colour: '',
    requested_date: new Date().toISOString().split('T')[0],
    submitted_date: '',
    buyer_feedback: '',
    photo_url: '',
    notes: ''
  });

  // Samples Filter
  const [sampleStatusFilter, setSampleStatusFilter] = useState<string>('all');
  const [sampleTypeFilter, setSampleTypeFilter] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, [showCompleted]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const fetchedStyles = await dataService.getEntryStyles('cutting', showCompleted);
      const [fetchedEntries, fetchedSamples, fetchedWorkers] = await Promise.all([
        dataService.getCuttingEntries(),
        dataService.getSamples(),
        dataService.getWorkers()
      ]);
      setStyles(fetchedStyles);
      setCuttingEntries(fetchedEntries);
      setSamples(fetchedSamples);
      setWorkers(fetchedWorkers);
    } catch (err) {
      console.error('Error loading cutting data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Cutting workers filter (Section = Cutting, active only)
  const cuttingWorkers = useMemo(() => {
    return workers.filter(w => (w.status === 'active' || !w.status) && w.section && w.section.toLowerCase().includes('cut'));
  }, [workers]);

  // Compute bulk pieces cut per style (cut_type === 'bulk') ONLY
  const bulkCutMap = useMemo(() => {
    const map = new Map<string, number>();
    cuttingEntries.forEach(entry => {
      if ((entry.cut_type === 'bulk' || !entry.cut_type) && entry.style_id) {
        const sid = String(entry.style_id).trim();
        const current = map.get(sid) || 0;
        map.set(sid, current + Number(entry.pieces_cut || 0));
      }
    });
    return map;
  }, [cuttingEntries]);

  // Compute sample pieces cut per style (cut_type === 'sample') ONLY
  const sampleCutMap = useMemo(() => {
    const map = new Map<string, number>();
    cuttingEntries.forEach(entry => {
      if (entry.cut_type === 'sample' && entry.style_id) {
        const sid = String(entry.style_id).trim();
        const current = map.get(sid) || 0;
        map.set(sid, current + Number(entry.pieces_cut || 0));
      }
    });
    return map;
  }, [cuttingEntries]);

  // Total sample pieces cut across all styles
  const totalSamplePiecesCut = useMemo(() => {
    return cuttingEntries
      .filter(e => e.cut_type === 'sample')
      .reduce((sum, e) => sum + Number(e.pieces_cut || 0), 0);
  }, [cuttingEntries]);

  // Total bulk pieces cut
  const totalBulkPiecesCut = useMemo(() => {
    return cuttingEntries
      .filter(e => e.cut_type === 'bulk' || !e.cut_type)
      .reduce((sum, e) => sum + Number(e.pieces_cut || 0), 0);
  }, [cuttingEntries]);

  // Check if style has approved PP sample
  const hasApprovedPPSample = (styleId: string) => {
    return samples.some(s => s.style_id === styleId && s.sample_type === 'PP' && s.status === 'Approved');
  };

  // Calculate days remaining or overdue
  const getDaysRemaining = (targetDateStr: string | null) => {
    if (!targetDateStr) return null;
    const target = new Date(targetDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Board Columns Categorization
  const boardData = useMemo(() => {
    const pending: Array<GarmentStyle & { bulk_cut: number; sample_cut: number; days_left: number | null }> = [];
    const inProgress: Array<GarmentStyle & { bulk_cut: number; sample_cut: number; days_left: number | null }> = [];
    const done: Array<GarmentStyle & { bulk_cut: number; sample_cut: number; days_left: number | null }> = [];

    styles.forEach(st => {
      // Styles marked requires_cutting = false are EXCLUDED from cutting board entirely
      if (st.requires_cutting === false) return;

      const sid = String(st.id).trim();
      const bulk_cut = bulkCutMap.get(sid) || 0;
      const sample_cut = sampleCutMap.get(sid) || 0;
      const days_left = getDaysRemaining(st.target_ship_date);
      const item = { ...st, bulk_cut, sample_cut, days_left };

      if (bulk_cut >= st.order_qty && st.order_qty > 0) {
        done.push(item);
      } else if (bulk_cut > 0) {
        inProgress.push(item);
      } else {
        pending.push(item);
      }
    });

    // Sort PENDING by ship deadline, soonest first
    pending.sort((a, b) => {
      if (!a.target_ship_date) return 1;
      if (!b.target_ship_date) return -1;
      return new Date(a.target_ship_date).getTime() - new Date(b.target_ship_date).getTime();
    });

    return { pending, inProgress, done };
  }, [styles, bulkCutMap, sampleCutMap]);

  // Handle Style Sizes & Multi-Size Calculations
  useEffect(() => {
    if (cutForm.style_id) {
      dataService.getStyleSizes(cutForm.style_id).then(sizes => {
        setAvailableSizes(sizes);
        setSelectedSizes([]);
        setSizeActualCuts({});
        setSizeRejects({});
        setCuttingReason('');
      });
    } else {
      setAvailableSizes([]);
      setSelectedSizes([]);
      setSizeActualCuts({});
      setSizeRejects({});
      setCuttingReason('');
    }
  }, [cutForm.style_id]);

  const [sizeRejects, setSizeRejects] = useState<Record<string, number | string>>({});

  const isBulkCut = cutForm.cut_type === 'bulk' || !cutForm.cut_type;
  const selectedCutStyle = styles.find(s => s.id === cutForm.style_id);

  const allStyleSizes: StyleSize[] = useMemo(() => {
    if (availableSizes.length > 0) return availableSizes;
    if (cutForm.style_id) {
      return [{
        style_id: cutForm.style_id,
        size: 'Standard',
        seq_no: 1,
        order_qty: selectedCutStyle?.order_qty || 0
      }];
    }
    return [];
  }, [availableSizes, cutForm.style_id, selectedCutStyle?.order_qty]);

  // For BULK cutting only:
  // 1. For each size of the selected style, calculate:
  //    alreadyCut = sum of qty_cut from cutting_entries where style_id matches, size matches, and cut type is bulk
  //    remaining = order qty − alreadyCut
  //    Match sizes after trimming spaces and ignoring upper/lower case.
  const modalSizesStats = useMemo(() => {
    if (!cutForm.style_id) return [];

    const styleEntries = cuttingEntries.filter(e =>
      String(e.style_id).trim() === String(cutForm.style_id).trim() &&
      (e.cut_type === 'bulk' || !e.cut_type)
    );

    return allStyleSizes.map(sz => {
      const szClean = (sz.size || '').trim().toLowerCase();
      const orderQty = Number(sz.order_qty) || 0;

      const alreadyCut = styleEntries
        .filter(e => {
          const entrySizeClean = (e.size || '').trim().toLowerCase();
          return entrySizeClean === szClean || (!entrySizeClean && szClean === 'standard');
        })
        .reduce((sum, e) => sum + Number((e as any).qty_cut ?? e.pieces_cut ?? 0), 0);

      const remaining = orderQty - alreadyCut;

      return {
        ...sz,
        alreadyCut,
        remaining,
      };
    });
  }, [cutForm.style_id, allStyleSizes, cuttingEntries]);

  // For BULK: Hide any size where remaining is 0 or less.
  // For SAMPLE: show all sizes as before. Do not hide anything.
  const modalSizesToDisplay = useMemo(() => {
    if (!isBulkCut) {
      return modalSizesStats;
    }
    return modalSizesStats.filter(sz => sz.remaining > 0);
  }, [isBulkCut, modalSizesStats]);

  const isAllSizesFullyCut = isBulkCut && Boolean(cutForm.style_id) && modalSizesStats.length > 0 && modalSizesToDisplay.length === 0;

  const tickedSizesList = modalSizesToDisplay.filter(sz => selectedSizes.includes(sz.size));
  const plannedTotal = tickedSizesList.reduce(
    (sum, sz) => sum + (isBulkCut ? sz.remaining : (Number(sz.order_qty) || 0)),
    0
  );
  const actualTotal = tickedSizesList.reduce((sum, sz) => {
    const val = sizeActualCuts[sz.size];
    return sum + (val === '' || isNaN(Number(val)) ? 0 : Number(val));
  }, 0);
  const rejectTotal = tickedSizesList.reduce((sum, sz) => {
    const val = sizeRejects[sz.size];
    return sum + (val === '' || isNaN(Number(val)) ? 0 : Number(val));
  }, 0);
  const shortfall = plannedTotal - actualTotal;

  // The reason field is required only if Actual Cut is below REMAINING, or if rejected pieces > 0.
  // Do not compare against the full order qty.
  const requiresReason = tickedSizesList.some(sz => {
    const targetQty = isBulkCut ? sz.remaining : (Number(sz.order_qty) || 0);
    const actualVal = sizeActualCuts[sz.size];
    const actualCut = actualVal === '' || isNaN(Number(actualVal)) ? 0 : Number(actualVal);
    const rejectVal = sizeRejects[sz.size];
    const rejectCut = rejectVal === '' || isNaN(Number(rejectVal)) ? 0 : Number(rejectVal);
    return rejectCut > 0 || actualCut < targetQty;
  });

  const handleToggleSize = (sizeName: string, defaultCutQty: number) => {
    if (selectedSizes.includes(sizeName)) {
      setSelectedSizes(prev => prev.filter(s => s !== sizeName));
      setSizeActualCuts(prev => {
        const next = { ...prev };
        delete next[sizeName];
        return next;
      });
      setSizeRejects(prev => {
        const next = { ...prev };
        delete next[sizeName];
        return next;
      });
    } else {
      setSelectedSizes(prev => [...prev, sizeName]);
      setSizeActualCuts(prev => ({
        ...prev,
        [sizeName]: defaultCutQty,
      }));
      setSizeRejects(prev => ({
        ...prev,
        [sizeName]: 0,
      }));
    }
  };

  const handleActualCutChange = (sizeName: string, val: string) => {
    if (val === '') {
      setSizeActualCuts(prev => ({ ...prev, [sizeName]: '' }));
      return;
    }
    const cleanNum = Math.max(0, Math.floor(Number(val)));
    setSizeActualCuts(prev => ({
      ...prev,
      [sizeName]: isNaN(cleanNum) ? 0 : cleanNum,
    }));
  };

  const handleRejectChange = (sizeName: string, val: string) => {
    if (val === '') {
      setSizeRejects(prev => ({ ...prev, [sizeName]: '' }));
      return;
    }
    const cleanNum = Math.max(0, Math.floor(Number(val)));
    setSizeRejects(prev => ({
      ...prev,
      [sizeName]: isNaN(cleanNum) ? 0 : cleanNum,
    }));
  };

  const handleCloseCutModal = () => {
    setIsCutModalOpen(false);
    setSelectedSizes([]);
    setSizeActualCuts({});
    setSizeRejects({});
    setCuttingReason('');
  };

  const handleSaveCutEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cutForm.style_id) {
      showErrorToast('Please select a garment style');
      return;
    }

    if (!cutForm.worker_id) {
      showErrorToast('Please select a worker');
      return;
    }

    // Validation: at least one size must be ticked
    if (tickedSizesList.length === 0) {
      showErrorToast('Please tick at least one size');
      return;
    }

    // Validation: Actual Total or Reject Total must be greater than 0
    if (actualTotal <= 0 && rejectTotal <= 0) {
      showErrorToast('At least one size must have cut or rejected pieces recorded');
      return;
    }

    // If any size has rejected pieces OR is cut below its order qty, require single reason
    if (requiresReason && !cuttingReason.trim()) {
      showErrorToast('Please provide a reason');
      return;
    }

    // Fetch logged-in admin user ID
    let enteredBy: string | undefined;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) enteredBy = user.id;
    } catch {}

    const baseNotes = cutForm.notes?.trim() || '';
    const entriesToSave: (Partial<CuttingEntry> & { qty_reject?: number; entered_by?: string })[] = [];

    for (const sz of tickedSizesList) {
      const orderQty = Number(sz.order_qty) || 0;
      const actualCut = Number(sizeActualCuts[sz.size] || 0);
      const rejectCut = Number(sizeRejects[sz.size] || 0);

      // Skip sizes whose Actual Cut and Rejected Cut are both 0
      if (actualCut <= 0 && rejectCut <= 0) continue;

      let sizeNote = baseNotes;
      if (cuttingReason.trim()) {
        const reasonText = cuttingReason.trim().toLowerCase().startsWith('reason')
          ? cuttingReason.trim()
          : `Reason: ${cuttingReason.trim()}`;
        sizeNote = sizeNote ? `${sizeNote} | ${reasonText}` : reasonText;
      }

      const entryPayload: Partial<CuttingEntry> & { qty_reject?: number; entered_by?: string } = {
        style_id: cutForm.style_id,
        cut_type: cutForm.cut_type,
        entry_date: cutForm.entry_date,
        pieces_cut: actualCut,
        qty_reject: rejectCut,
        size: sz.size,
        worker_id: cutForm.worker_id,
      };

      if (cutForm.tables_layers?.trim()) {
        entryPayload.tables_layers = cutForm.tables_layers.trim();
      }
      if (sizeNote) {
        entryPayload.notes = sizeNote;
      }
      if (enteredBy) {
        entryPayload.entered_by = enteredBy;
      }

      entriesToSave.push(entryPayload);
    }

    if (entriesToSave.length === 0) {
      showErrorToast('At least one ticked size must have pieces cut or rejected');
      return;
    }

    const styleCode = selectedCutStyle?.style_code || 'Style';
    const prevBulkCut = bulkCutMap.get(cutForm.style_id) || 0;
    const isFirstBulkCut = (cutForm.cut_type === 'bulk' || !cutForm.cut_type) && actualTotal > 0 && prevBulkCut === 0;

    try {
      await dataService.saveCuttingEntries(entriesToSave);

      const savedSummary = entriesToSave.map(entry => `${entry.size}: ${entry.pieces_cut} pcs cut${(entry.qty_reject || 0) > 0 ? ` (${entry.qty_reject} rej)` : ''}`).join(', ');
      showSuccessToast(
        `Saved cutting output: ${savedSummary}${isFirstBulkCut ? ` — ${styleCode} is now available for line setup.` : ''}`
      );

      handleCloseCutModal();
      setCutForm({
        style_id: '',
        cut_type: 'bulk',
        entry_date: new Date().toISOString().split('T')[0],
        pieces_cut: '',
        size: '',
        tables_layers: '',
        worker_id: '',
        notes: ''
      });
      await loadData();
    } catch (err) {
      showErrorToast('Failed to save cutting entries');
    }
  };

  // Handle Save Sample Request / Edit
  const handleSaveSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sampleForm.style_id) {
      showErrorToast('Please select a style for the sample');
      return;
    }

    try {
      await dataService.saveSample({
        id: editingSample?.id,
        style_id: sampleForm.style_id,
        sample_type: sampleForm.sample_type,
        status: sampleForm.status,
        qty: Number(sampleForm.qty || 1),
        size: sampleForm.size || null,
        colour: sampleForm.colour || null,
        requested_date: sampleForm.requested_date,
        submitted_date: sampleForm.submitted_date || null,
        buyer_feedback: sampleForm.buyer_feedback || null,
        photo_url: sampleForm.photo_url || null,
        notes: sampleForm.notes || null,
      });

      showSuccessToast(editingSample ? 'Sample updated successfully' : 'New sample request created');
      setIsSampleModalOpen(false);
      setEditingSample(null);
      resetSampleForm();
      loadData();
    } catch (err) {
      showErrorToast('Failed to save sample');
    }
  };

  const resetSampleForm = () => {
    setSampleForm({
      style_id: '',
      sample_type: 'PP',
      status: 'Pending',
      qty: '1',
      size: 'M',
      colour: '',
      requested_date: new Date().toISOString().split('T')[0],
      submitted_date: '',
      buyer_feedback: '',
      photo_url: '',
      notes: ''
    });
  };

  const openEditSampleModal = (sample: GarmentSample) => {
    setEditingSample(sample);
    setSampleForm({
      style_id: sample.style_id,
      sample_type: sample.sample_type,
      status: sample.status,
      qty: String(sample.qty || 1),
      size: sample.size || '',
      colour: sample.colour || '',
      requested_date: sample.requested_date,
      submitted_date: sample.submitted_date || '',
      buyer_feedback: sample.buyer_feedback || '',
      photo_url: sample.photo_url || '',
      notes: sample.notes || ''
    });
    setIsSampleModalOpen(true);
  };

  // Sample Image Upload Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSampleForm(prev => ({ ...prev, photo_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Filtered Samples List
  const filteredSamples = useMemo(() => {
    return samples.filter(s => {
      const matchesStatus = sampleStatusFilter === 'all' || s.status === sampleStatusFilter;
      const matchesType = sampleTypeFilter === 'all' || s.sample_type === sampleTypeFilter;
      return matchesStatus && matchesType;
    });
  }, [samples, sampleStatusFilter, sampleTypeFilter]);

  // Color helper for sample statuses
  const getStatusBadgeClass = (status: SampleStatus) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Revision':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Submitted':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'Sewing':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Cutting':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-300';
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all cutting entries and sample data to start fresh?')) {
      await dataService.clearCuttingData();
      showSuccessToast('All cutting & sample demo data cleared! Ready for fresh entries.');
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Navigation Tabs */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Cutting & Sample Operations
              </h1>
              <p className="text-xs sm:text-sm text-stone-500">
                Track 3-column cutting progress, priorities, and sample approval sign-offs
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switching & Main Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              onClick={() => setActiveTab('board')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'board'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Cutting Board</span>
            </button>
            <button
              onClick={() => setActiveTab('samples')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'samples'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Samples & PP Sign-Off</span>
              {samples.some(s => s.status === 'Pending' || s.status === 'Cutting') && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              setCutForm(prev => ({ ...prev, style_id: styles[0]?.id || '' }));
              setIsCutModalOpen(true);
            }}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Record Output</span>
          </button>

          {(cuttingEntries.length > 0 || samples.length > 0) && (
            <button
              onClick={handleClearData}
              title="Clear all recorded entries for a fresh start"
              className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 rounded-xl text-xs font-bold transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear Demo Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Bulk Pieces Cut</div>
          <div className="text-2xl font-black text-stone-900 mt-1">{totalBulkPiecesCut.toLocaleString()} pcs</div>
          <div className="text-[10px] text-stone-400 mt-0.5">Primary bulk cutting total</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="text-amber-700 text-xs font-medium flex items-center space-x-1">
            <Tag className="w-3.5 h-3.5" />
            <span>Sample Pieces Cut</span>
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{totalSamplePiecesCut.toLocaleString()} pcs</div>
          <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Excluded from bulk reconciliation</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Active Cutting Board Styles</div>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            {styles.filter(s => s.requires_cutting !== false).length} Styles
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">{boardData.inProgress.length} In Progress • {boardData.pending.length} Pending</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="text-emerald-700 text-xs font-medium">PP Approval Rate</div>
          <div className="text-2xl font-black text-emerald-800 mt-1">
            {samples.filter(s => s.sample_type === 'PP' && s.status === 'Approved').length} / {styles.filter(s => s.requires_cutting !== false).length} Approved
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Critical pre-cutting sign-offs</div>
        </div>
      </div>

      {/* TAB 1: THREE-COLUMN CUTTING BOARD */}
      {activeTab === 'board' && (
        <div className="space-y-4">
          {/* Rules Banner & Filters */}
          <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sky-900 text-xs">
            <div className="flex items-start space-x-3">
              <Scissors className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Cutting Priority Board Rules: </span>
                Pending styles are automatically sorted by target ship deadline (soonest first). 
                Styles starting bulk cut without an approved PP Sample are flagged with high-visibility risk alerts.
              </div>
            </div>
            <label className="inline-flex items-center space-x-1.5 text-stone-800 font-semibold bg-white/80 border border-sky-200 px-3 py-1.5 rounded-lg shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
              />
              <span>Show completed styles</span>
            </label>
          </div>

          {/* Three Columns Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* COLUMN 1: PENDING */}
            <div className="bg-stone-100/70 p-4 rounded-2xl border border-stone-200 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <h3 className="font-black text-stone-800 text-sm uppercase tracking-wider">
                    PENDING ({boardData.pending.length})
                  </h3>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  Priority Sorted
                </span>
              </div>
              <p className="text-[11px] text-stone-500 -mt-2">Upcoming styles with 0 bulk pieces cut</p>

              <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[750px] pr-1">
                {boardData.pending.length === 0 ? (
                  <div className="bg-white/60 rounded-xl p-8 text-center text-stone-400 text-xs font-medium border border-dashed border-stone-300">
                    No pending cutting orders
                  </div>
                ) : (
                  boardData.pending.map((style, idx) => (
                    <StyleCard 
                      key={style.id}
                      style={style}
                      priorityIndex={idx + 1}
                      hasPPApproval={hasApprovedPPSample(style.id)}
                      role={role}
                      onViewEntries={() => setViewEntriesTarget({ styleId: style.id, styleCode: style.style_code, styleName: style.name })}
                      onRecordCut={() => {
                        setCutForm(prev => ({ ...prev, style_id: style.id, cut_type: 'bulk' }));
                        setIsCutModalOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            {/* COLUMN 2: IN PROGRESS */}
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200/80 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></span>
                  <h3 className="font-black text-blue-900 text-sm uppercase tracking-wider">
                    IN PROGRESS ({boardData.inProgress.length})
                  </h3>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  Cutting Active
                </span>
              </div>
              <p className="text-[11px] text-blue-600/80 -mt-2">Partially cut with active progress</p>

              <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[750px] pr-1">
                {boardData.inProgress.length === 0 ? (
                  <div className="bg-white/60 rounded-xl p-8 text-center text-stone-400 text-xs font-medium border border-dashed border-stone-300">
                    No styles currently in progress
                  </div>
                ) : (
                  boardData.inProgress.map(style => (
                    <StyleCard 
                      key={style.id}
                      style={style}
                      hasPPApproval={hasApprovedPPSample(style.id)}
                      role={role}
                      onViewEntries={() => setViewEntriesTarget({ styleId: style.id, styleCode: style.style_code, styleName: style.name })}
                      onRecordCut={() => {
                        setCutForm(prev => ({ ...prev, style_id: style.id, cut_type: 'bulk' }));
                        setIsCutModalOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            {/* COLUMN 3: DONE */}
            <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200/70 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-black text-emerald-900 text-sm uppercase tracking-wider">
                    DONE ({boardData.done.length})
                  </h3>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  100% Complete
                </span>
              </div>
              <p className="text-[11px] text-emerald-700/70 -mt-2">Bulk pieces cut match or exceed order qty</p>

              <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[750px] pr-1">
                {boardData.done.length === 0 ? (
                  <div className="bg-white/60 rounded-xl p-8 text-center text-stone-400 text-xs font-medium border border-dashed border-stone-300">
                    No completed cutting styles yet
                  </div>
                ) : (
                  boardData.done.map(style => (
                    <StyleCard 
                      key={style.id}
                      style={style}
                      hasPPApproval={hasApprovedPPSample(style.id)}
                      role={role}
                      onViewEntries={() => setViewEntriesTarget({ styleId: style.id, styleCode: style.style_code, styleName: style.name })}
                      onRecordCut={() => {
                        setCutForm(prev => ({ ...prev, style_id: style.id, cut_type: 'bulk' }));
                        setIsCutModalOpen(true);
                      }}
                    />
                  ))
                )}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: SAMPLES & PP APPROVAL SIGN-OFF */}
      {activeTab === 'samples' && (
        <div className="space-y-6">
          {/* Header Action & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-stone-900 flex items-center space-x-2">
                  <span>Sample Production & Buyer Feedback</span>
                  <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                    Sample Cut Total: {totalSamplePiecesCut} pcs
                  </span>
                </h2>
                <p className="text-xs text-stone-500">
                  Manage Proto, Fit, PP, TOP, and Salesman samples with buyer status updates
                </p>
              </div>

              <button
                onClick={() => {
                  resetSampleForm();
                  setSampleForm(prev => ({ ...prev, style_id: styles[0]?.id || '' }));
                  setIsSampleModalOpen(true);
                }}
                className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>New Sample Request</span>
              </button>
            </div>

            {/* Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
              <span className="text-xs font-bold text-stone-600 flex items-center space-x-1 mr-2">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter Status:</span>
              </span>

              <button
                onClick={() => setSampleStatusFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  sampleStatusFilter === 'all'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All Statuses ({samples.length})
              </button>

              {SAMPLE_STATUSES.map(st => {
                const count = samples.filter(s => s.status === st).length;
                return (
                  <button
                    key={st}
                    onClick={() => setSampleStatusFilter(st)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      sampleStatusFilter === st
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {st} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sample Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSamples.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-12 text-center text-stone-400 border border-stone-200">
                <FileText className="w-10 h-10 mx-auto text-stone-300 mb-2" />
                <p className="text-sm font-semibold">No sample records found matching filter</p>
                <p className="text-xs text-stone-400 mt-1">Click "New Sample Request" to add sample sign-offs</p>
              </div>
            ) : (
              filteredSamples.map(sample => (
                <div 
                  key={sample.id}
                  className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs hover:shadow-md transition-all space-y-3 relative flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Header: Type Badge & Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="bg-amber-100 text-amber-900 font-extrabold text-[11px] px-2.5 py-0.5 rounded-md border border-amber-300">
                          {sample.sample_type} SAMPLE
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${getStatusBadgeClass(sample.status)}`}>
                          {sample.status}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-stone-400">
                        Qty: {sample.qty}
                      </span>
                    </div>

                    {/* Style Name & Buyer */}
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm leading-snug">
                        {sample.style_name || 'Style'} <span className="text-stone-600 font-mono text-xs">({sample.style_code})</span>
                      </h4>
                      <div className="text-xs text-stone-500">{sample.buyer_name || 'Buyer'}</div>
                    </div>

                    {/* Specifications Pill */}
                    <div className="flex items-center space-x-2 text-xs bg-stone-50 p-2 rounded-lg text-stone-700">
                      <div><strong className="text-stone-900">Size:</strong> {sample.size || 'N/A'}</div>
                      <span className="text-stone-300">•</span>
                      <div><strong className="text-stone-900">Colour:</strong> {sample.colour || 'N/A'}</div>
                    </div>

                    {/* Dates Info */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-500 bg-stone-50/60 p-2 rounded-lg">
                      <div>
                        <span className="text-stone-400 block text-[10px]">Requested</span>
                        <span className="font-semibold text-stone-700">{sample.requested_date}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px]">Submitted</span>
                        <span className="font-semibold text-stone-700">{sample.submitted_date || 'Not submitted'}</span>
                      </div>
                    </div>

                    {/* Buyer Feedback */}
                    <div className="text-xs bg-amber-50/70 border border-amber-200/60 p-2.5 rounded-xl">
                      <div className="font-bold text-amber-900 text-[11px] mb-0.5 flex items-center justify-between">
                        <span>Buyer Feedback / Comments</span>
                        {sample.status === 'Approved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <p className="text-stone-700 text-xs italic">
                        {sample.buyer_feedback || 'No buyer feedback recorded yet.'}
                      </p>
                    </div>

                    {/* Optional Photo Attachment */}
                    {sample.photo_url && (
                      <div className="rounded-xl overflow-hidden border border-stone-200 max-h-36 bg-stone-100">
                        <img 
                          src={sample.photo_url} 
                          alt="Sample photo" 
                          className="w-full h-36 object-cover hover:scale-105 transition-transform"
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => openEditSampleModal(sample)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1"
                    >
                      <span>Update Status & Feedback</span>
                    </button>
                    {sample.sample_type === 'PP' && sample.status === 'Approved' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Ready for Bulk</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* RECORD CUTTING OUTPUT MODAL (Bulk or Sample) */}
      {isCutModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-lg">Record Cutting Output</h3>
                  <p className="text-xs text-stone-500">Enter completed pieces per cut type</p>
                </div>
              </div>
              <button 
                onClick={handleCloseCutModal}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCutEntry} className="space-y-4 text-xs">
              {/* Cut Type Selection */}
              <div>
                <label className="block font-bold text-stone-700 mb-1.5">Cut Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCutForm(prev => ({ ...prev, cut_type: 'bulk' }));
                      setSelectedSizes([]);
                      setSizeActualCuts({});
                      setSizeRejects({});
                      setCuttingReason('');
                    }}
                    className={`p-3 rounded-xl border font-bold flex flex-col items-center justify-center text-center transition-all ${
                      cutForm.cut_type === 'bulk'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-sm">✂️ Bulk Cutting</span>
                    <span className="text-[10px] font-normal text-stone-500 mt-0.5">Counts toward order completion</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCutForm(prev => ({ ...prev, cut_type: 'sample' }));
                      setSelectedSizes([]);
                      setSizeActualCuts({});
                      setSizeRejects({});
                      setCuttingReason('');
                    }}
                    className={`p-3 rounded-xl border font-bold flex flex-col items-center justify-center text-center transition-all ${
                      cutForm.cut_type === 'sample'
                        ? 'bg-amber-50 border-amber-600 text-amber-900 ring-2 ring-amber-500/20'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-sm">🧪 Sample Cutting</span>
                    <span className="text-[10px] font-normal text-amber-700 mt-0.5">Excluded from bulk reconciliation</span>
                  </button>
                </div>
              </div>

              {/* Style Selection */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Garment Style *</label>
                <select
                  required
                  value={cutForm.style_id}
                  onChange={e => setCutForm(prev => ({ ...prev, style_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                >
                  <option value="">Select Garment Style...</option>
                  {styles.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.style_code} — {st.name} ({st.buyer_name || 'No Buyer'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Entry Date */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Cut Date *</label>
                  <input
                    type="date"
                    required
                    value={cutForm.entry_date}
                    onChange={e => setCutForm(prev => ({ ...prev, entry_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Multi-Size Section */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-bold text-stone-700">
                      Sizes to Cut *
                    </label>
                    {modalSizesToDisplay.length > 0 && (
                      <div className="flex items-center space-x-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSizes(modalSizesToDisplay.map(s => s.size));
                            const cuts: Record<string, number> = {};
                            const rejects: Record<string, number> = {};
                            modalSizesToDisplay.forEach(s => {
                              cuts[s.size] = isBulkCut ? s.remaining : (Number(s.order_qty) || 0);
                              rejects[s.size] = 0;
                            });
                            setSizeActualCuts(cuts);
                            setSizeRejects(rejects);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 font-bold"
                        >
                          Select All
                        </button>
                        <span className="text-stone-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSizes([]);
                            setSizeActualCuts({});
                            setSizeRejects({});
                            setCuttingReason('');
                          }}
                          className="text-stone-500 hover:text-stone-700 font-medium"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {!cutForm.style_id ? (
                    <p className="text-stone-400 italic py-2">Select a garment style first to view sizes</p>
                  ) : isAllSizesFullyCut ? (
                    <p className="text-stone-600 font-semibold italic py-2">All sizes for this style are fully cut.</p>
                  ) : modalSizesToDisplay.length === 0 ? (
                    <p className="text-stone-400 italic py-2">No sizes found for this style</p>
                  ) : (
                    /* Checkboxes labelled "L (Left: 35 of 35)" for bulk or "S (Order: 10)" for sample */
                    <div className="flex flex-wrap gap-2 pt-1">
                      {modalSizesToDisplay.map(sz => {
                        const isChecked = selectedSizes.includes(sz.size);
                        return (
                          <label
                            key={sz.size}
                            className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition select-none ${
                              isChecked
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500/20 shadow-2xs'
                                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSize(sz.size, isBulkCut ? sz.remaining : (Number(sz.order_qty) || 0))}
                              className="rounded border-stone-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            <span>
                              {isBulkCut
                                ? `${sz.size} (Left: ${sz.remaining} of ${sz.order_qty})`
                                : `${sz.size} (Order: ${sz.order_qty})`}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* For each ticked size: Size | Remaining / Order Qty | Good Cut | Rejected (default 0) */}
                {tickedSizesList.length > 0 && (
                  <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white mt-2">
                    <div className="grid grid-cols-12 gap-2 bg-stone-100/80 px-3 py-2 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                      <div className="col-span-3">Size</div>
                      <div className="col-span-3">{isBulkCut ? 'Remaining' : 'Order Qty'}</div>
                      <div className="col-span-3">Good Cut</div>
                      <div className="col-span-3">Rejected</div>
                    </div>
                    <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto">
                      {tickedSizesList.map(sz => (
                        <div key={sz.size} className="grid grid-cols-12 gap-2 items-center px-3 py-2 text-xs">
                          <div className="col-span-3 font-bold text-stone-900">
                            {sz.size}
                          </div>
                          <div className="col-span-3 text-stone-600 font-medium">
                            {isBulkCut ? `${sz.remaining} of ${sz.order_qty}` : `${sz.order_qty} pcs`}
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={sizeActualCuts[sz.size] ?? ''}
                              onChange={e => handleActualCutChange(sz.size, e.target.value)}
                              placeholder="0"
                              className="w-full px-2.5 py-1 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={sizeRejects[sz.size] ?? 0}
                              onChange={e => handleRejectChange(sz.size, e.target.value)}
                              placeholder="0"
                              className="w-full px-2.5 py-1 bg-stone-50 border border-rose-300 rounded-lg text-rose-700 font-bold focus:ring-2 focus:ring-rose-500 focus:bg-white text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Auto-calculated live totals */}
                {tickedSizesList.length > 0 && (
                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 grid grid-cols-4 gap-2 text-center mt-2">
                    <div>
                      <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Planned</div>
                      <div className="text-sm font-black text-stone-900 mt-0.5">{plannedTotal} pcs</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Good Cut</div>
                      <div className="text-sm font-black text-indigo-700 mt-0.5">{actualTotal} pcs</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Rejected</div>
                      <div className={`text-sm font-black mt-0.5 ${rejectTotal > 0 ? 'text-rose-600' : 'text-stone-700'}`}>
                        {rejectTotal} pcs
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Shortfall</div>
                      <div className={`text-sm font-black mt-0.5 ${shortfall > 0 ? 'text-amber-600' : 'text-stone-700'}`}>
                        {shortfall} pcs
                      </div>
                    </div>
                  </div>
                )}

                {/* ONE Reason field: Show when any size has rejected pieces OR is cut below its order/remaining qty */}
                {requiresReason && (
                  <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3 space-y-1 mt-2">
                    <label className="block font-bold text-amber-800 text-xs">
                      Reason <span className="text-amber-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. fabric shortage, flaws, cutting defect"
                      value={cuttingReason}
                      onChange={e => setCuttingReason(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-stone-900 font-medium placeholder:text-stone-400 focus:ring-2 focus:ring-amber-500 text-xs"
                    />
                    <p className="text-[10px] text-amber-700">
                      {isBulkCut
                        ? 'Reason is required because one or more sizes have rejected pieces or cut quantity below remaining quantity.'
                        : 'Reason is required because one or more sizes have rejected pieces or cut quantity below order quantity.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Table / Layers Info */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Table / Layers Info</label>
                  <input
                    type="text"
                    placeholder="e.g. Table 1, 100 layers"
                    value={cutForm.tables_layers || ''}
                    onChange={e => setCutForm(prev => ({ ...prev, tables_layers: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                {/* Cutter Worker Assignment */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Worker <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={cutForm.worker_id || ''}
                    onChange={e => setCutForm(prev => ({ ...prev, worker_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value="">Select Worker...</option>
                    {cuttingWorkers.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.full_name} ({w.worker_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Notes / Fabric Batch</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes..."
                  value={cutForm.notes || ''}
                  onChange={e => setCutForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCloseCutModal}
                  className="px-4 py-2 rounded-xl border border-stone-300 font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md cursor-pointer"
                >
                  Save Cutting Output
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAMPLE REQUEST / EDIT MODAL */}
      {isSampleModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-lg">
                    {editingSample ? 'Update Sample & Feedback' : 'New Sample Request'}
                  </h3>
                  <p className="text-xs text-stone-500">Record buyer approvals and sample details</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSampleModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSample} className="space-y-4 text-xs">
              {/* Garment Style */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Garment Style *</label>
                <select
                  required
                  value={sampleForm.style_id}
                  onChange={e => setSampleForm(prev => ({ ...prev, style_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                >
                  <option value="">Select Garment Style...</option>
                  {styles.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.style_code} — {st.name} ({st.buyer_name || 'No Buyer'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Sample Type */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Sample Type *</label>
                  <select
                    required
                    value={sampleForm.sample_type}
                    onChange={e => setSampleForm(prev => ({ ...prev, sample_type: e.target.value as SampleType }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  >
                    {SAMPLE_TYPES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Current Status *</label>
                  <select
                    required
                    value={sampleForm.status}
                    onChange={e => setSampleForm(prev => ({ ...prev, status: e.target.value as SampleStatus }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  >
                    {SAMPLE_STATUSES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Qty */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={sampleForm.qty}
                    onChange={e => setSampleForm(prev => ({ ...prev, qty: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>

                {/* Size */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Size</label>
                  <input
                    type="text"
                    placeholder="e.g. M"
                    value={sampleForm.size || ''}
                    onChange={e => setSampleForm(prev => ({ ...prev, size: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>

                {/* Colour */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Colour</label>
                  <input
                    type="text"
                    placeholder="e.g. Indigo"
                    value={sampleForm.colour || ''}
                    onChange={e => setSampleForm(prev => ({ ...prev, colour: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Requested Date */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Requested Date</label>
                  <input
                    type="date"
                    value={sampleForm.requested_date || ''}
                    onChange={e => setSampleForm(prev => ({ ...prev, requested_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>

                {/* Submitted Date */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Submitted Date</label>
                  <input
                    type="date"
                    value={sampleForm.submitted_date || ''}
                    onChange={e => setSampleForm(prev => ({ ...prev, submitted_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Buyer Feedback */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Buyer Feedback / Approval Notes</label>
                <textarea
                  rows={2}
                  placeholder="Enter buyer comments, fit adjustments or approval instructions..."
                  value={sampleForm.buyer_feedback || ''}
                  onChange={e => setSampleForm(prev => ({ ...prev, buyer_feedback: e.target.value }))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Sample Photo</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="text-xs text-stone-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200"
                  />
                  {sampleForm.photo_url && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-stone-200 shrink-0">
                      <img src={sampleForm.photo_url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSampleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 font-bold text-stone-700 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md"
                >
                  Save Sample
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ENTRIES MODAL (ADMIN ONLY) */}
      {viewEntriesTarget && (
        <ViewEntriesModal
          isOpen={!!viewEntriesTarget}
          onClose={() => setViewEntriesTarget(null)}
          styleId={viewEntriesTarget.styleId}
          styleCode={viewEntriesTarget.styleCode}
          styleName={viewEntriesTarget.styleName}
          entryType="cutting"
          role={role}
          onRefresh={loadData}
        />
      )}
    </div>
  );
};


// COMPONENT: STYLE CARD FOR CUTTING BOARD
interface StyleCardProps {
  style: GarmentStyle & { bulk_cut: number; sample_cut: number; days_left: number | null };
  priorityIndex?: number;
  hasPPApproval?: boolean;
  onRecordCut: () => void;
  role?: UserRole;
  onViewEntries?: () => void;
}

const StyleCard: React.FC<StyleCardProps> = ({ style, priorityIndex, onRecordCut, role, onViewEntries }) => {

  const percent = Math.min(100, Math.round((style.bulk_cut / (style.order_qty || 1)) * 100));
  const piecesPending = Math.max(0, style.order_qty - style.bulk_cut);

  // Size breakdown table state
  const [sizeBreakdown, setSizeBreakdown] = useState<StyleSizeBreakdownRow[]>([]);

  useEffect(() => {
    let isMounted = true;
    dataService.getStyleSizeBreakdown(style.id).then(res => {
      if (isMounted) setSizeBreakdown(res);
    });
    return () => { isMounted = false; };
  }, [style.id, style.bulk_cut]);

  return (
    <div id={`style-card-${style.id}`} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs hover:shadow-md transition-all space-y-3 relative overflow-hidden flex flex-col justify-between">
      {/* Header: Priority, Thumbnail & Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center space-x-3">
          {priorityIndex && (
            <span className="w-6 h-6 rounded-full bg-indigo-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              #{priorityIndex}
            </span>
          )}
          <StyleImageLightbox
            imageUrl={style.image_url}
            styleCode={style.style_code}
            styleName={style.name}
            sizeClassName="w-12 h-12"
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {style.style_code}
              </span>
              <NewStyleBadge createdAt={style.created_at} styleCode={style.style_code} />
              {role === 'admin' && onViewEntries && (
                <button
                  type="button"
                  onClick={onViewEntries}
                  className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors cursor-pointer ml-1"
                >
                  <ClipboardList className="w-3 h-3" />
                  <span>View entries</span>
                </button>
              )}

            </div>

            <h4 className="font-extrabold text-stone-900 text-sm leading-tight mt-1">
              {style.name}
            </h4>
          </div>
        </div>
      </div>

      {/* Buyer & Ship Date */}
      <div className="flex items-center justify-between text-xs text-stone-500 bg-stone-50 p-2 rounded-xl border border-stone-100">
        <div>
          <span className="text-[10px] text-stone-400 block">Buyer</span>
          <span className="font-bold text-stone-800">{style.buyer_name || 'N/A'}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-stone-400 block">Ship Deadline</span>
          <span className={`font-extrabold flex items-center space-x-1 justify-end ${
            style.days_left !== null && style.days_left <= 7 ? 'text-rose-600' : 'text-stone-700'
          }`}>
            <Calendar className="w-3 h-3" />
            <span>{style.target_ship_date || 'No date'}</span>
          </span>
          {style.days_left !== null && (
            <span className={`text-[10px] font-bold block ${
              style.days_left < 0 ? 'text-rose-600' : style.days_left <= 7 ? 'text-amber-600' : 'text-stone-400'
            }`}>
              {style.days_left < 0 ? `Overdue by ${Math.abs(style.days_left)} days` : style.days_left === 0 ? 'Due Today' : `${style.days_left} days left`}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar & Piece Metrics */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-stone-600">Bulk Cut Progress</span>
          <span className="text-indigo-700 font-extrabold">{percent}%</span>
        </div>

        <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
          <div 
            className={`h-full transition-all duration-300 ${
              percent >= 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-indigo-600' : 'bg-stone-300'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-1 text-[11px] text-center pt-1">
          <div className="bg-stone-50 p-1.5 rounded-lg border border-stone-100">
            <span className="text-stone-400 block text-[9px]">Order Qty</span>
            <span className="font-bold text-stone-900">{style.order_qty.toLocaleString()}</span>
          </div>
          <div className="bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
            <span className="text-indigo-600 block text-[9px]">Pieces Cut</span>
            <span className="font-black text-indigo-900">{style.bulk_cut.toLocaleString()}</span>
          </div>
          <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100">
            <span className="text-amber-700 block text-[9px]">Pending Cut</span>
            <span className="font-extrabold text-amber-900">{piecesPending.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* SIZE BREAKDOWN TABLE (IF EXISTS) */}
      {sizeBreakdown.length > 0 && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 space-y-1.5 text-xs">
          <div className="grid grid-cols-4 gap-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider pb-1 border-b border-stone-200">
            <span className="text-left pl-1">Size</span>
            <span className="text-right">Ordered</span>
            <span className="text-right">Cut</span>
            <span className="text-right pr-1">Balance</span>
          </div>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
            {sizeBreakdown.map(sb => {
              const orderedQty = Number(sb.order_qty) || 0;
              const cutQty = Number(sb.cut_qty) || 0;
              const overCut = cutQty - orderedQty;
              const balance = Math.max(0, orderedQty - cutQty);

              return (
                <div 
                  key={sb.size} 
                  className={`p-1.5 rounded-lg border transition-all ${
                    overCut > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-stone-200'
                  }`}
                >
                  <div className="grid grid-cols-4 gap-1 items-center text-xs font-mono">
                    <span className="font-sans font-bold text-stone-900 text-left pl-1 truncate">
                      {sb.size}
                    </span>
                    <span className="text-stone-600 text-right font-medium">
                      {orderedQty}
                    </span>
                    <span className="text-indigo-700 text-right font-bold">
                      {cutQty}
                    </span>
                    <span className="text-stone-700 text-right font-semibold pr-1">
                      {balance}
                    </span>
                  </div>

                  {overCut > 0 && (
                    <div className="mt-1 pt-1 border-t border-amber-200/60 flex items-center justify-start">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>Over-cut by {overCut} pcs</span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer: Sample Cut & Action Button */}
      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
        <div className="text-[11px] font-semibold text-amber-800 flex items-center space-x-1">
          <Tag className="w-3 h-3 text-amber-600" />
          <span>Sample Cut: <strong>{style.sample_cut} pcs</strong></span>
        </div>

        <button
          onClick={onRecordCut}
          className="bg-stone-900 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center space-x-1"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>+ Cut Output</span>
        </button>
      </div>
    </div>
  );
};
