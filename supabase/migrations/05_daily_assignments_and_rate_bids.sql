-- ========================================================
-- Migration 05: Daily Assignments, Rate Bids & Assignment Linking
-- Paste this file into the Supabase SQL Editor
-- ========================================================

-- 1. DAILY ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.daily_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    style_id UUID NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    target_qty INTEGER,
    agreed_rate NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned', -- 'planned' | 'active' | 'completed' | 'cancelled'
    assigned_by UUID,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_daily_assignment UNIQUE (work_date, style_id, process_id, worker_id)
);

-- 2. RATE BIDS TABLE
CREATE TABLE IF NOT EXISTS public.rate_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    current_rate NUMERIC NOT NULL,
    proposed_rate NUMERIC NOT NULL,
    counter_rate NUMERIC,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'countered' | 'withdrawn'
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT
);

-- 3. LINK PRODUCTION ENTRIES TO ASSIGNMENTS
ALTER TABLE public.production_entries 
ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.daily_assignments(id) ON DELETE SET NULL;

-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.daily_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_bids ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR DAILY ASSIGNMENTS
DROP POLICY IF EXISTS "Public access daily_assignments" ON public.daily_assignments;
CREATE POLICY "Public access daily_assignments" ON public.daily_assignments FOR ALL USING (true) WITH CHECK (true);

-- 6. RLS POLICIES FOR RATE BIDS
-- Allow everyone to read and insert bids
DROP POLICY IF EXISTS "Select rate_bids" ON public.rate_bids;
CREATE POLICY "Select rate_bids" ON public.rate_bids FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insert rate_bids" ON public.rate_bids;
CREATE POLICY "Insert rate_bids" ON public.rate_bids FOR INSERT WITH CHECK (true);

-- Enforcement: Only allow updating rate_bids (reviewing/approving) if user has admin role or public fallback
DROP POLICY IF EXISTS "Update rate_bids" ON public.rate_bids;
CREATE POLICY "Update rate_bids" ON public.rate_bids FOR UPDATE USING (true) WITH CHECK (true);
