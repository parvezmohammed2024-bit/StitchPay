-- ========================================================
-- Migration 01: Database Schema & Tables
-- Paste this file into the Supabase SQL Editor
-- ========================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SETTINGS
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'stg-1',
    factory_name TEXT NOT NULL DEFAULT 'StitchPay Garments Ltd.',
    logo_url TEXT,
    currency_code TEXT NOT NULL DEFAULT 'BDT',
    currency_symbol TEXT NOT NULL DEFAULT '৳',
    pay_cycle TEXT NOT NULL DEFAULT 'monthly',
    week_start_day TEXT NOT NULL DEFAULT 'saturday',
    rework_pay_percent NUMERIC NOT NULL DEFAULT 10,
    reject_pay_percent NUMERIC NOT NULL DEFAULT 0,
    minimum_wage_per_day NUMERIC NOT NULL DEFAULT 350,
    enable_minimum_wage_topup BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WORKERS
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    photo_url TEXT,
    section TEXT NOT NULL DEFAULT 'Sewing',
    line_no TEXT NOT NULL DEFAULT 'Line-01',
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_details JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GARMENT STYLES
CREATE TABLE IF NOT EXISTS public.styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    image_url TEXT,
    order_qty INTEGER NOT NULL DEFAULT 0,
    target_ship_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GARMENT PROCESSES
CREATE TABLE IF NOT EXISTS public.processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_id UUID NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
    seq_no INTEGER NOT NULL,
    name TEXT NOT NULL,
    machine_type TEXT NOT NULL DEFAULT 'Single Needle Lockstitch',
    smv NUMERIC NOT NULL DEFAULT 1.0,
    rate NUMERIC NOT NULL DEFAULT 0.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCTION ENTRIES
CREATE TABLE IF NOT EXISTS public.production_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    style_id UUID NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    qty_ok INTEGER NOT NULL DEFAULT 0,
    qty_rework INTEGER NOT NULL DEFAULT 0,
    qty_reject INTEGER NOT NULL DEFAULT 0,
    rate_snapshot NUMERIC NOT NULL DEFAULT 0,
    amount NUMERIC NOT NULL DEFAULT 0,
    shift TEXT NOT NULL DEFAULT 'day',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'present',
    ot_hours NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_worker_date UNIQUE (worker_id, date)
);

-- 7. ADJUSTMENTS
CREATE TABLE IF NOT EXISTS public.adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL DEFAULT 'other',
    amount NUMERIC NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PAYROLL PERIODS
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PAYROLL LINES
CREATE TABLE IF NOT EXISTS public.payroll_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    pieces_total INTEGER NOT NULL DEFAULT 0,
    piece_earnings NUMERIC NOT NULL DEFAULT 0,
    ot_amount NUMERIC NOT NULL DEFAULT 0,
    bonus_amount NUMERIC NOT NULL DEFAULT 0,
    allowance_amount NUMERIC NOT NULL DEFAULT 0,
    deductions NUMERIC NOT NULL DEFAULT 0,
    minimum_wage_topup NUMERIC NOT NULL DEFAULT 0,
    net_payable NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_period_worker UNIQUE (period_id, worker_id)
);
