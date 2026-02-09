-- =============================================
-- MeuFinanceiro - Schema
-- =============================================

CREATE TABLE IF NOT EXISTS transactions (
  id            SERIAL PRIMARY KEY,
  type          VARCHAR(7) NOT NULL CHECK (type IN ('income', 'expense')),
  category      VARCHAR(20) NOT NULL CHECK (category IN (
                  'alimentacao', 'transporte', 'lazer', 'saude',
                  'educacao', 'moradia', 'salario', 'outros'
                )),
  description   TEXT NOT NULL DEFAULT '',
  amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id            SERIAL PRIMARY KEY,
  category      VARCHAR(20) NOT NULL UNIQUE CHECK (category IN (
                  'alimentacao', 'transporte', 'lazer', 'saude',
                  'educacao', 'moradia', 'salario', 'outros'
                )),
  monthly_limit NUMERIC(12, 2) NOT NULL CHECK (monthly_limit > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions (date_trunc('month', date));
