-- Keeps invoice schema compatible after removing legacy Create Invoice form fields.
-- Safe to run multiple times.

ALTER TABLE invoices
  ALTER COLUMN machine_description DROP NOT NULL,
  ALTER COLUMN serial_no DROP NOT NULL,
  ALTER COLUMN support_technician DROP NOT NULL,
  ALTER COLUMN support_technician_percentage DROP NOT NULL,
  ALTER COLUMN machine_count SET DEFAULT 0;

-- Quotation date is now auto-aligned to invoice date from backend create flow.
-- Backfill only missing rows (non-destructive).
UPDATE invoices
SET quotation_date = invoice_date
WHERE quotation_date IS NULL
  AND invoice_date IS NOT NULL;
