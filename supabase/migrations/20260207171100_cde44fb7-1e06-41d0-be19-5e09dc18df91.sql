-- Fix: Add ON DELETE CASCADE to blood_unit_history -> hospitals FK
ALTER TABLE blood_unit_history 
  DROP CONSTRAINT blood_unit_history_hospital_id_fkey;
ALTER TABLE blood_unit_history 
  ADD CONSTRAINT blood_unit_history_hospital_id_fkey 
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;

-- Also add ON DELETE SET NULL for blood_unit_id FK (so history survives unit deletion)
ALTER TABLE blood_unit_history
  DROP CONSTRAINT blood_unit_history_blood_unit_id_fkey;
ALTER TABLE blood_unit_history
  ADD CONSTRAINT blood_unit_history_blood_unit_id_fkey
  FOREIGN KEY (blood_unit_id) REFERENCES blood_units(id) ON DELETE SET NULL;