import { GarmentStyle, CuttingEntry, GarmentProcess, ProductionEntry, StyleDailyOutput } from '../types';

/**
 * Checks if a style is unlocked and available for sewing / line setup / entry screens.
 * Unlocked if:
 *  1) requires_cutting is false (or undefined/falsy) - pre-cut/ready immediately
 *  2) requires_cutting is true AND style has at least one bulk cutting entry (cut_type = 'bulk', pieces_cut > 0)
 * Note: Sample cutting (cut_type = 'sample') does NOT unlock a style. Only bulk cutting counts.
 */
export function isStyleUnlockedForSewing(
  style: GarmentStyle,
  cuttingEntries: CuttingEntry[]
): boolean {
  if (!style.requires_cutting) {
    return true;
  }
  // requires_cutting is true
  const bulkEntries = cuttingEntries.filter(
    e => String(e.style_id).trim() === String(style.id).trim() &&
         (e.cut_type === 'bulk' || !e.cut_type) &&
         Number(e.pieces_cut || 0) > 0
  );
  return bulkEntries.length > 0;
}

/**
 * Calculates cutting and sewing quantities for a style.
 * - totalCutFigure: sum of bulk pieces_cut if requires_cutting = true, OR order_qty if pre-cut.
 * - totalSewn: uses declared output (sum of style_daily_output.qty) if present, otherwise MINIMUM total qty_ok across the style's sewing processes.
 * - availableToSew: Math.max(0, totalCutFigure - totalSewn).
 */
export function getStyleSewingAvailability(
  style: GarmentStyle,
  cuttingEntries: CuttingEntry[],
  processes: GarmentProcess[],
  productionEntries: ProductionEntry[],
  dailyOutputs: StyleDailyOutput[] = []
) {
  const styleProcesses = processes.filter(p => String(p.style_id).trim() === String(style.id).trim());
  
  // Compute bulk pieces cut
  const styleBulkEntries = cuttingEntries.filter(
    e => String(e.style_id).trim() === String(style.id).trim() &&
         (e.cut_type === 'bulk' || !e.cut_type)
  );
  const bulkCutTotal = styleBulkEntries.reduce((sum, e) => sum + Number(e.pieces_cut || 0), 0);

  // Total available ceiling figure (bulk cut if requires_cutting, else order_qty)
  const totalCutFigure = style.requires_cutting ? bulkCutTotal : Number(style.order_qty || 0);

  // Check declared outputs for this style
  const styleOutputs = dailyOutputs.filter(o => String(o.style_id).trim() === String(style.id).trim());
  const hasDeclaredOutput = styleOutputs.length > 0;
  const totalDeclaredOutput = styleOutputs.reduce((sum, o) => sum + Number(o.qty || 0), 0);

  // Sewn = declared output total if exists, else MINIMUM total qty_ok across that style's sewing processes
  let totalSewn = 0;
  if (hasDeclaredOutput) {
    totalSewn = totalDeclaredOutput;
  } else if (styleProcesses.length > 0) {
    const processQtyMap = new Map<string, number>();
    styleProcesses.forEach(p => processQtyMap.set(p.id, 0));

    productionEntries.forEach(entry => {
      if (String(entry.style_id).trim() === String(style.id).trim() && entry.process_id) {
        if (processQtyMap.has(entry.process_id)) {
          const current = processQtyMap.get(entry.process_id) || 0;
          processQtyMap.set(entry.process_id, current + Number(entry.qty_ok || 0));
        }
      }
    });

    const processTotals = Array.from(processQtyMap.values());
    totalSewn = Math.min(...processTotals);
  }

  const availableToSew = Math.max(0, totalCutFigure - totalSewn);

  return {
    requiresCutting: !!style.requires_cutting,
    bulkCutTotal,
    totalCutFigure,
    totalSewn,
    hasDeclaredOutput,
    totalDeclaredOutput,
    availableToSew,
  };
}

