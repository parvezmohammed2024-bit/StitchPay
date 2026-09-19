import { supabase, isSupabaseConfigured } from './supabase';

/**
 * 1. Sort pending styles by cutting_priority (lowest first).
 * Styles with no priority go at the bottom, oldest first (by created_at ascending).
 */
export function sortPendingCuttingStyles<T extends {
  id?: string;
  cutting_priority?: number | null;
  created_at?: string | null;
}>(styles: T[]): T[] {
  return [...styles].sort((a, b) => {
    const aHasPri = typeof a.cutting_priority === 'number' && a.cutting_priority > 0;
    const bHasPri = typeof b.cutting_priority === 'number' && b.cutting_priority > 0;

    if (aHasPri && bHasPri) {
      if (a.cutting_priority !== b.cutting_priority) {
        return (a.cutting_priority as number) - (b.cutting_priority as number);
      }
    } else if (aHasPri) {
      return -1; // a comes first
    } else if (bHasPri) {
      return 1; // b comes first
    }

    // Styles with no priority go at the bottom, oldest first.
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // Tie-breaker
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

/**
 * 4. After any move, save the new order to cutting_priority for ALL pending styles (1, 2, 3…)
 * Throws exact Supabase error on failure.
 */
export async function saveAllPendingCuttingPriorities(orderedStyles: Array<{ id: string }>): Promise<void> {
  if (!isSupabaseConfigured || orderedStyles.length === 0) {
    return;
  }

  // Update cutting_priority for ALL pending styles (1, 2, 3...)
  const updatePromises = orderedStyles.map((style, index) => {
    const priority = index + 1;
    return supabase
      .from('styles')
      .update({ cutting_priority: priority })
      .eq('id', style.id);
  });

  const results = await Promise.all(updatePromises);
  const failure = results.find(r => r.error);
  if (failure && failure.error) {
    throw new Error(failure.error.message || JSON.stringify(failure.error));
  }
}
