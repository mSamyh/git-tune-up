ALTER TABLE points_transactions 
DROP CONSTRAINT points_transactions_related_donation_id_fkey;

ALTER TABLE points_transactions
ADD CONSTRAINT points_transactions_related_donation_id_fkey 
FOREIGN KEY (related_donation_id) 
REFERENCES donation_history(id) 
ON DELETE SET NULL;