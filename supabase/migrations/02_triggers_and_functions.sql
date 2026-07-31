-- ========================================================
-- Migration 02: Triggers, Functions & Stored Procedures
-- Paste this file into the Supabase SQL Editor
-- ========================================================

-- Function to auto-update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_workers_updated_at ON public.workers;
CREATE TRIGGER trg_workers_updated_at BEFORE UPDATE ON public.workers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_styles_updated_at ON public.styles;
CREATE TRIGGER trg_styles_updated_at BEFORE UPDATE ON public.styles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_processes_updated_at ON public.processes;
CREATE TRIGGER trg_processes_updated_at BEFORE UPDATE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stored Procedure for Server-Side Payroll Calculation
CREATE OR REPLACE FUNCTION public.calculate_payroll(p_period_id UUID)
RETURNS VOID AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_min_wage NUMERIC;
    v_enable_topup BOOLEAN;
    v_rework_pct NUMERIC;
    v_reject_pct NUMERIC;
    r_worker RECORD;
    v_pieces_total INTEGER;
    v_piece_earnings NUMERIC;
    v_present_days NUMERIC;
    v_half_days NUMERIC;
    v_ot_hrs NUMERIC;
    v_ot_amount NUMERIC;
    v_bonus NUMERIC;
    v_allowance NUMERIC;
    v_fines NUMERIC;
    v_adv_repay NUMERIC;
    v_deductions NUMERIC;
    v_required_wage NUMERIC;
    v_topup NUMERIC;
    v_net_payable NUMERIC;
BEGIN
    -- Get Period dates
    SELECT start_date, end_date INTO v_start_date, v_end_date
    FROM public.payroll_periods WHERE id = p_period_id;

    IF v_start_date IS NULL THEN
        RAISE EXCEPTION 'Payroll period not found';
    END IF;

    -- Get Settings
    SELECT minimum_wage_per_day, enable_minimum_wage_topup, rework_pay_percent, reject_pay_percent
    INTO v_min_wage, v_enable_topup, v_rework_pct, v_reject_pct
    FROM public.settings LIMIT 1;

    v_min_wage := COALESCE(v_min_wage, 350);
    v_enable_topup := COALESCE(v_enable_topup, true);

    -- Loop through active workers
    FOR r_worker IN SELECT id FROM public.workers WHERE status = 'active' LOOP
        -- 1. Calculate Piece Earnings
        SELECT COALESCE(SUM(qty_ok), 0), COALESCE(SUM(amount), 0)
        INTO v_pieces_total, v_piece_earnings
        FROM public.production_entries
        WHERE worker_id = r_worker.id AND entry_date BETWEEN v_start_date AND v_end_date;

        -- 2. Calculate Attendance
        SELECT 
            COALESCE(COUNT(*) FILTER (WHERE status = 'present'), 0),
            COALESCE(COUNT(*) FILTER (WHERE status = 'half_day'), 0),
            COALESCE(SUM(ot_hours), 0)
        INTO v_present_days, v_half_days, v_ot_hrs
        FROM public.attendance
        WHERE worker_id = r_worker.id AND date BETWEEN v_start_date AND v_end_date;

        v_ot_amount := v_ot_hrs * 50;

        -- 3. Calculate Adjustments
        SELECT 
            COALESCE(SUM(amount) FILTER (WHERE type = 'bonus'), 0),
            COALESCE(SUM(amount) FILTER (WHERE type = 'allowance'), 0),
            COALESCE(SUM(amount) FILTER (WHERE type = 'fine'), 0),
            COALESCE(SUM(amount) FILTER (WHERE type = 'advance_repay'), 0)
        INTO v_bonus, v_allowance, v_fines, v_adv_repay
        FROM public.adjustments
        WHERE worker_id = r_worker.id AND date BETWEEN v_start_date AND v_end_date;

        v_deductions := v_fines + v_adv_repay;

        -- 4. Calculate Minimum Wage Top-up
        v_topup := 0;
        IF v_enable_topup AND (v_present_days + v_half_days > 0) THEN
            v_required_wage := (v_present_days + 0.5 * v_half_days) * v_min_wage;
            IF v_piece_earnings < v_required_wage THEN
                v_topup := v_required_wage - v_piece_earnings;
            END IF;
        END IF;

        v_net_payable := GREATEST(0, (v_piece_earnings + v_topup + v_ot_amount + v_bonus + v_allowance) - v_deductions);

        -- 5. Upsert Payroll Line
        INSERT INTO public.payroll_lines (
            period_id, worker_id, pieces_total, piece_earnings, ot_amount,
            bonus_amount, allowance_amount, deductions, minimum_wage_topup, net_payable
        ) VALUES (
            p_period_id, r_worker.id, v_pieces_total, ROUND(v_piece_earnings, 2), ROUND(v_ot_amount, 2),
            ROUND(v_bonus, 2), ROUND(v_allowance, 2), ROUND(v_deductions, 2), ROUND(v_topup, 2), ROUND(v_net_payable, 2)
        )
        ON CONFLICT (period_id, worker_id) DO UPDATE SET
            pieces_total = EXCLUDED.pieces_total,
            piece_earnings = EXCLUDED.piece_earnings,
            ot_amount = EXCLUDED.ot_amount,
            bonus_amount = EXCLUDED.bonus_amount,
            allowance_amount = EXCLUDED.allowance_amount,
            deductions = EXCLUDED.deductions,
            minimum_wage_topup = EXCLUDED.minimum_wage_topup,
            net_payable = EXCLUDED.net_payable;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
