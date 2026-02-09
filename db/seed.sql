-- =============================================
-- MeuFinanceiro - Dados de exemplo
-- =============================================

-- Limpa dados existentes
TRUNCATE transactions RESTART IDENTITY CASCADE;
TRUNCATE goals RESTART IDENTITY CASCADE;

-- Transações do mês atual
INSERT INTO transactions (type, category, description, amount, date) VALUES
  ('income',  'salario',     'Salário',           5500.00, date_trunc('month', CURRENT_DATE) + INTERVAL '4 days'),
  ('expense', 'moradia',     'Aluguel',           1800.00, date_trunc('month', CURRENT_DATE) + INTERVAL '4 days'),
  ('expense', 'alimentacao', 'Supermercado Extra', 347.85, date_trunc('month', CURRENT_DATE) + INTERVAL '6 days'),
  ('expense', 'transporte',  'Uber',               32.50, date_trunc('month', CURRENT_DATE) + INTERVAL '7 days'),
  ('expense', 'saude',       'Farmácia',            89.90, date_trunc('month', CURRENT_DATE) + INTERVAL '8 days'),
  ('expense', 'lazer',       'Netflix',             39.90, date_trunc('month', CURRENT_DATE)),
  ('expense', 'alimentacao', 'iFood - Janta',       52.00, date_trunc('month', CURRENT_DATE) + INTERVAL '9 days'),
  ('expense', 'educacao',    'Curso Udemy',          29.90, date_trunc('month', CURRENT_DATE) + INTERVAL '2 days'),
  ('expense', 'transporte',  'Gasolina',           210.00, date_trunc('month', CURRENT_DATE) + INTERVAL '5 days'),
  ('expense', 'lazer',       'Spotify',             21.90, date_trunc('month', CURRENT_DATE)),
  ('expense', 'alimentacao', 'Padaria',             18.50, date_trunc('month', CURRENT_DATE) + INTERVAL '10 days'),
  ('income',  'outros',      'Freelance',          800.00, date_trunc('month', CURRENT_DATE) + INTERVAL '14 days');

-- Transações do mês anterior
INSERT INTO transactions (type, category, description, amount, date) VALUES
  ('income',  'salario',     'Salário',           5500.00, date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '4 days'),
  ('expense', 'moradia',     'Aluguel',           1800.00, date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '4 days'),
  ('expense', 'alimentacao', 'Supermercado',       412.30, date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '7 days'),
  ('expense', 'transporte',  'Uber',                55.00, date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '11 days'),
  ('expense', 'lazer',       'Cinema',              65.00, date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '19 days');

-- Metas
INSERT INTO goals (category, monthly_limit) VALUES
  ('alimentacao', 500.00),
  ('transporte',  350.00),
  ('lazer',       200.00);
