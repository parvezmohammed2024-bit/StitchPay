-- MIGRATION 01: TABLES AND ROLES SCHEMA FOR STITCHPAY
-- Run this script in the Supabase SQL Editor

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER ROLES
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'accounts')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- 3. WORKERS
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  section TEXT,
  line_no TEXT,
  joined_at DATE DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'mobile_wallet')),
  payment_details JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. STYLES
CREATE TABLE IF NOT EXISTS styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  buyer_name TEXT,
  image_url TEXT,
  order_qty INTEGER NOT NULL DEFAULT 0,
  target_ship_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROCESSES
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id UUID NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  seq_no INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  machine_type TEXT,
  smv NUMERIC(10,2),
  rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PROCESS RATE HISTORY
CREATE TABLE IF NOT EXISTS process_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  old_rate NUMERIC(10,2),
  new_rate NUMERIC(10,2) NOT NULL,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT
);

-- 7. PRODUCTION ENTRIES
CREATE TABLE IF NOT EXISTS production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  style_id UUID NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  qty_ok INTEGER NOT NULL DEFAULT 0,
  qty_rework INTEGER NOT NULL DEFAULT 0,
  qty_reject INTEGER NOT NULL DEFAULT 0,
  rate_snapshot NUMERIC(10,2),
  amount NUMERIC(12,2),
  shift TEXT DEFAULT 'day' CHECK (shift IN ('day', 'night')),
  entered_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'holiday')),
  in_time TIME,
  out_time TIME,
  ot_hours NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, date)
);

-- 9. ADJUSTMENTS
CREATE TABLE IF NOT EXISTS adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  period_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('advance', 'advance_repay', 'fine', 'bonus', 'overtime', 'allowance', 'other')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PAYROLL PERIODS
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'paid')),
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PAYROLL LINES
CREATE TABLE IF NOT EXISTS payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  pieces_total INTEGER NOT NULL DEFAULT 0,
  piece_earnings NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ot_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  allowance_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  minimum_wage_topup NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_payable NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, worker_id)
);

-- 12. SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_name TEXT NOT NULL DEFAULT 'StitchPay Garments Ltd.',
  logo_url TEXT,
  currency_code TEXT DEFAULT 'BDT',
  currency_symbol TEXT DEFAULT '৳',
  pay_cycle TEXT DEFAULT 'monthly' CHECK (pay_cycle IN ('weekly', 'biweekly', 'monthly')),
  week_start_day TEXT DEFAULT 'saturday',
  rework_pay_percent NUMERIC(5,2) DEFAULT 0.00,
  reject_pay_percent NUMERIC(5,2) DEFAULT 0.00,
  minimum_wage_per_day NUMERIC(10,2) DEFAULT 350.00,
  enable_minimum_wage_topup BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
