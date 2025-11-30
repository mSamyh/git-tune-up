-- Make district nullable since users prefer atoll/island
ALTER TABLE donor_directory ALTER COLUMN district DROP NOT NULL;

-- Also make district nullable in profiles table for consistency
ALTER TABLE profiles ALTER COLUMN district DROP NOT NULL;