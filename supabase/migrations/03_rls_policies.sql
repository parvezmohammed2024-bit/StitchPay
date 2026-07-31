-- ========================================================
-- Migration 03: Row Level Security (RLS) Policies
-- Paste this file into the Supabase SQL Editor
-- ========================================================

-- Enable Row Level Security on all tables
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;

-- Create Permissive Policies for Authenticated & Anon API Access
-- 1. SETTINGS
DROP POLICY IF EXISTS "Public access settings" ON public.settings;
CREATE POLICY "Public access settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- 2. WORKERS
DROP POLICY IF EXISTS "Public access workers" ON public.workers;
CREATE POLICY "Public access workers" ON public.workers FOR ALL USING (true) WITH CHECK (true);

-- 3. STYLES
DROP POLICY IF EXISTS "Public access styles" ON public.styles;
CREATE POLICY "Public access styles" ON public.styles FOR ALL USING (true) WITH CHECK (true);

-- 4. PROCESSES
DROP POLICY IF EXISTS "Public access processes" ON public.processes;
CREATE POLICY "Public access processes" ON public.processes FOR ALL USING (true) WITH CHECK (true);

-- 5. PRODUCTION ENTRIES
DROP POLICY IF EXISTS "Public access production_entries" ON public.production_entries;
CREATE POLICY "Public access production_entries" ON public.production_entries FOR ALL USING (true) WITH CHECK (true);

-- 6. ATTENDANCE
DROP POLICY IF EXISTS "Public access attendance" ON public.attendance;
CREATE POLICY "Public access attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

-- 7. ADJUSTMENTS
DROP POLICY IF EXISTS "Public access adjustments" ON public.adjustments;
CREATE POLICY "Public access adjustments" ON public.adjustments FOR ALL USING (true) WITH CHECK (true);

-- 8. PAYROLL PERIODS
DROP POLICY IF EXISTS "Public access payroll_periods" ON public.payroll_periods;
CREATE POLICY "Public access payroll_periods" ON public.payroll_periods FOR ALL USING (true) WITH CHECK (true);

-- 9. PAYROLL LINES
DROP POLICY IF EXISTS "Public access payroll_lines" ON public.payroll_lines;
CREATE POLICY "Public access payroll_lines" ON public.payroll_lines FOR ALL USING (true) WITH CHECK (true);
