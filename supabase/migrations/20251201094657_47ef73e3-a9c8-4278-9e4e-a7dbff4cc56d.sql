-- Drop the existing BEFORE INSERT trigger
DROP TRIGGER IF EXISTS trigger_merge_donor_on_registration ON profiles;

-- Recreate the trigger to fire AFTER INSERT instead
CREATE TRIGGER trigger_merge_donor_on_registration
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION merge_donor_on_registration();