-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- authoritative price/months for a plan (server-side source of truth)
CREATE OR REPLACE FUNCTION public.plan_months(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan WHEN 'monthly' THEN 1 WHEN 'yearly' THEN 12 ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.plan_price(_plan text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _plan
    WHEN 'monthly' THEN COALESCE((SELECT price_monthly FROM public.admin_settings ORDER BY id LIMIT 1), 29)
    WHEN 'yearly'  THEN COALESCE((SELECT price_yearly  FROM public.admin_settings ORDER BY id LIMIT 1), 232)
    ELSE NULL END
$$;

-- ============ PHASE 1: institutes subscription fields are admin-only ============
CREATE OR REPLACE FUNCTION public.guard_institute_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_end IS DISTINCT FROM OLD.subscription_end
     OR NEW.trial_end IS DISTINCT FROM OLD.trial_end
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed: subscription fields can only be changed by an administrator'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_institute_subscription ON public.institutes;
CREATE TRIGGER guard_institute_subscription
BEFORE UPDATE ON public.institutes
FOR EACH ROW EXECUTE FUNCTION public.guard_institute_subscription();

-- ============ PHASE 2 + 3: receipts are always pending, priced server-side ============
CREATE OR REPLACE FUNCTION public.guard_receipt_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_inst uuid;
BEGIN
  my_inst := public.my_institute_id();

  IF my_inst IS NULL OR NEW.institute_id IS DISTINCT FROM my_inst THEN
    RAISE EXCEPTION 'Not allowed: receipts must belong to your own institute' USING ERRCODE = '42501';
  END IF;

  IF public.plan_months(NEW.plan) IS NULL THEN
    RAISE EXCEPTION 'Invalid plan' USING ERRCODE = '22023';
  END IF;

  -- never trust client-supplied status / months / amount
  NEW.status       := 'pending'::receipt_status;
  NEW.months       := public.plan_months(NEW.plan);
  NEW.amount       := public.plan_price(NEW.plan);   -- price snapshot at request time
  NEW.reviewed_at  := NULL;
  NEW.reviewed_by  := NULL;
  NEW.created_at   := now();
  NEW.user_email   := (SELECT owner_email FROM public.institutes WHERE id = my_inst);

  -- one open request at a time
  IF EXISTS (SELECT 1 FROM public.receipts r WHERE r.institute_id = my_inst AND r.status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending receipt under review' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_receipt_insert ON public.receipts;
CREATE TRIGGER guard_receipt_insert
BEFORE INSERT ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_receipt_insert();

-- ============ PHASE 4: users cannot mutate receipts after creation ============
CREATE OR REPLACE FUNCTION public.guard_receipt_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed: only an administrator can review receipts' USING ERRCODE = '42501';
  END IF;
  IF NEW.institute_id IS DISTINCT FROM OLD.institute_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.months IS DISTINCT FROM OLD.months
     OR NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Not allowed: receipt request data is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_receipt_update ON public.receipts;
CREATE TRIGGER guard_receipt_update
BEFORE UPDATE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_receipt_update();

-- ============ PHASE 5 + 6: atomic admin activation ============
CREATE OR REPLACE FUNCTION public.approve_receipt(p_receipt_id uuid)
RETURNS TABLE (receipt_id uuid, institute_id uuid, subscription_end timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.receipts%ROWTYPE;
  new_end timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed: administrators only' USING ERRCODE = '42501';
  END IF;

  -- atomic claim: only a still-pending receipt can be approved (blocks double activation)
  UPDATE public.receipts
     SET status = 'confirmed'::receipt_status,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   WHERE id = p_receipt_id
     AND status = 'pending'::receipt_status
  RETURNING * INTO r;

  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Receipt not found or already reviewed' USING ERRCODE = '42501';
  END IF;

  IF public.plan_months(r.plan) IS NULL OR r.months IS DISTINCT FROM public.plan_months(r.plan) THEN
    RAISE EXCEPTION 'Receipt data is inconsistent with the pricing rules' USING ERRCODE = '22023';
  END IF;

  SELECT GREATEST(now(), COALESCE(i.subscription_end, now())) + make_interval(months => r.months)
    INTO new_end
    FROM public.institutes i
   WHERE i.id = r.institute_id
     FOR UPDATE;

  IF new_end IS NULL THEN
    RAISE EXCEPTION 'Institute not found for this receipt' USING ERRCODE = '22023';
  END IF;

  UPDATE public.institutes
     SET subscription_status = 'active'::subscription_status,
         subscription_end = new_end
   WHERE id = r.institute_id;

  RETURN QUERY SELECT r.id, r.institute_id, new_end;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_receipt(p_receipt_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed: administrators only' USING ERRCODE = '42501';
  END IF;
  UPDATE public.receipts
     SET status = 'cancelled'::receipt_status, reviewed_at = now(), reviewed_by = auth.uid()
   WHERE id = p_receipt_id AND status = 'pending'::receipt_status
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Receipt not found or already reviewed' USING ERRCODE = '42501';
  END IF;
  RETURN v_id;
END;
$$;

-- admin manual grant / cancel (quick actions)
CREATE OR REPLACE FUNCTION public.admin_adjust_subscription(
  p_institute_id uuid,
  p_days integer DEFAULT 0,
  p_months integer DEFAULT 0,
  p_cancel boolean DEFAULT false
)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_end timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed: administrators only' USING ERRCODE = '42501';
  END IF;

  IF p_cancel THEN
    UPDATE public.institutes SET subscription_status = 'cancelled'::subscription_status
     WHERE id = p_institute_id RETURNING subscription_end INTO new_end;
    IF NOT FOUND THEN RAISE EXCEPTION 'Institute not found' USING ERRCODE = '22023'; END IF;
    RETURN new_end;
  END IF;

  IF COALESCE(p_days,0) < 0 OR COALESCE(p_months,0) < 0
     OR COALESCE(p_days,0) > 365 OR COALESCE(p_months,0) > 24
     OR (COALESCE(p_days,0) = 0 AND COALESCE(p_months,0) = 0) THEN
    RAISE EXCEPTION 'Invalid extension range' USING ERRCODE = '22023';
  END IF;

  SELECT GREATEST(now(), COALESCE(i.subscription_end, now()))
         + make_interval(months => COALESCE(p_months,0), days => COALESCE(p_days,0))
    INTO new_end FROM public.institutes i WHERE i.id = p_institute_id FOR UPDATE;

  IF new_end IS NULL THEN RAISE EXCEPTION 'Institute not found' USING ERRCODE = '22023'; END IF;

  UPDATE public.institutes
     SET subscription_status = 'active'::subscription_status, subscription_end = new_end
   WHERE id = p_institute_id;

  RETURN new_end;
END;
$$;

-- ============ PHASE 10: role escalation surface ============
REVOKE ALL ON public.user_roles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- ============ execute privileges ============
REVOKE ALL ON FUNCTION public.approve_receipt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_receipt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_adjust_subscription(uuid, integer, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.plan_price(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.plan_months(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.approve_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_subscription(uuid, integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_price(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_months(text) TO authenticated;
