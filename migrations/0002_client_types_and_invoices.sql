-- Add client type and extended fields
ALTER TABLE clients ADD COLUMN client_type TEXT DEFAULT 'person' CHECK(client_type IN ('person','ip','company'));

-- Passport data (for person/IP)
ALTER TABLE clients ADD COLUMN passport_series TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN passport_number TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN passport_date TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN passport_issued TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN passport_code TEXT DEFAULT '';

-- Company/IP legal data
ALTER TABLE clients ADD COLUMN company_name TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN inn TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN kpp TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN ogrn TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN legal_address TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN contact_person TEXT DEFAULT '';

-- Bank details
ALTER TABLE clients ADD COLUMN bank_name TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN bank_bik TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN bank_account TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN bank_corr_account TEXT DEFAULT '';

-- Owner (executor) settings
CREATE TABLE IF NOT EXISTS owner_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  company_name TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  owner_name_short TEXT DEFAULT '',
  ogrn TEXT DEFAULT '',
  inn TEXT DEFAULT '',
  kpp TEXT DEFAULT '',
  legal_address TEXT DEFAULT '',
  actual_address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  phone2 TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  bank_bik TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  bank_corr_account TEXT DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','cancelled')),
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
