-- 1) Remove any direct UPDATE/DELETE path through PostgREST
DROP POLICY IF EXISTS "admin update receipts" ON public.receipts;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES ON public.receipts FROM authenticated, anon;
GRANT SELECT, INSERT ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;

-- 2) True state machine, only reachable from the secure RPCs
CREATE OR REPLACE FUNCTION public.guard_receipt_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- only approve_receipt() / reject_receipt() may change a receipt
  IF COALESCE(current_setting('app.receipt_review', true), '') <> '1' THEN
    RAISE EXCEPTION 'Not allowed: receipts can only be reviewed through approve_receipt() or reject_receipt()'
      USING ERRCODE = '42501';
  END IF;

  -- immutable request data
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.institute_id IS DISTINCT FROM OLD.institute_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.months IS DISTINCT FROM OLD.months
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.user_email IS DISTINCT FROM OLD.user_email
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Not allowed: receipt request data is immutable' USING ERRCODE = '42501';
  END IF;

  -- allowed transitions: pending -> confirmed | cancelled ONLY
  IF OLD.status <> 'pending'::receipt_status THEN
    RAISE EXCEPTION 'Not allowed: a reviewed receipt is final' USING ERRCODE = '42501';
  END IF;
  IF NEW.status NOT IN ('confirmed'::receipt_status, 'cancelled'::receipt_status) THEN
    RAISE EXCEPTION 'Invalid receipt state transition' USING ERRCODE = '42501';
  END IF;

  -- review metadata is always server side
  NEW.reviewed_at := now();
  NEW.reviewed_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_receipt_update ON public.receipts;
CREATE TRIGGER guard_receipt_update
BEFORE UPDATE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_receipt_update();

-- block deletes entirely (no DELETE policy exists, but defend the RPC/definer path too)
CREATE OR REPLACE FUNCTION public.guard_receipt_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF session_user IN ('postgres', 'supabase_admin', 'service_role') OR auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Not allowed: receipts cannot be deleted' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS guard_receipt_delete ON public.receipts;
CREATE TRIGGER guard_receipt_delete
BEFORE DELETE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_receipt_delete();

-- 3) The two official transitions open the gate for exactly one statement
CREATE OR REPLACE FUNCTION public.approve_receipt(p_receipt_id uuid)
RETURNS TABLE(receipt_id uuid, institute_id uuid, subscription_end timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r public.receipts%ROWTYPE;
  new_end timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed: administrators only' USING ERRCODE = '42501';
  END IF;

  -- lock the row first, then claim it atomically
  SELECT * INTO r FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'pending'::receipt_status THEN
    RAISE EXCEPTION 'Receipt not found or already reviewed' USING ERRCODE = '42501';
  END IF;

  IF public.plan_months(r.plan) IS NULL OR r.months IS DISTINCT FROM public.plan_months(r.plan) THEN
    RAISE EXCEPTION 'Receipt data is inconsistent with the pricing rules' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.receipt_review', '1', true);
  UPDATE public.receipts
     SET status = 'confirmed'::receipt_status
   WHERE id = p_receipt_id AND status = 'pending'::receipt_status
  RETURNING * INTO r;
  PERFORM set_config('app.receipt_review', '0', true);

  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Receipt not found or already reviewed' USING ERRCODE = '42501';
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
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed: administrators only' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;

  PERFORM set_config('app.receipt_review', '1', true);
  UPDATE public.receipts
     SET status = 'cancelled'::receipt_status
   WHERE id = p_receipt_id AND status = 'pending'::receipt_status
  RETURNING id INTO v_id;
  PERFORM set_config('app.receipt_review', '0', true);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Receipt not found or already reviewed' USING ERRCODE = '42501';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_receipt(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.reject_receipt(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.approve_receipt(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_receipt(uuid) TO authenticated, service_role;