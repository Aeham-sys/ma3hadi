CREATE UNIQUE INDEX receipts_one_pending_per_institute
  ON public.receipts (institute_id)
  WHERE status = 'pending'::receipt_status;