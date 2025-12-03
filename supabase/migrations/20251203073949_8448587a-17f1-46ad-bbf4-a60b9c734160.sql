-- Disable the award_points_on_donation trigger to prevent double points allocation
-- Points are already being awarded by application code in DonationHistoryManager.tsx
ALTER TABLE public.donation_history DISABLE TRIGGER award_points_on_donation;