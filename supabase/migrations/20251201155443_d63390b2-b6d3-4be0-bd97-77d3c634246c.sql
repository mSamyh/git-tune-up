-- Allow all actual transaction_type values used in triggers and logic
ALTER TABLE public.points_transactions
  DROP CONSTRAINT IF EXISTS points_transactions_transaction_type_check;

ALTER TABLE public.points_transactions
  ADD CONSTRAINT points_transactions_transaction_type_check
  CHECK (
    transaction_type = ANY (
      ARRAY[
        'earned'::text,
        'redeemed'::text,
        'expired'::text,
        'adjusted'::text,
        'refunded'::text,
        'deducted'::text
      ]
    )
  );