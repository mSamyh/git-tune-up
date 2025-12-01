-- Disable the trigger that causes foreign key violations
-- The application already handles points deduction manually
ALTER TABLE donation_history DISABLE TRIGGER deduct_points_on_donation_delete;