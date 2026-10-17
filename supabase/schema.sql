-- =====================================================
-- Fiscus Tap – Supabase Schema Completo
-- =====================================================
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase.
-- Incluye: Tablas, RLS, Políticas de acceso y Realtime WebSockets.

-- 1. Comercios (Merchants)
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  default_amount NUMERIC(12,2),
  currency TEXT DEFAULT 'VES',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Telemetría de Taps NFC (Tap Events)
CREATE TABLE IF NOT EXISTS tap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- 3. Registro de Pagos e Intentos (Payment Intents)
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'VES',
  bank_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  reference TEXT,
  payer_phone TEXT,
  payer_document TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 4. Sesiones de Cobro en Tiempo Real (Charge Sessions para Terminal POS)
CREATE TABLE IF NOT EXISTS charge_sessions (
  id TEXT PRIMARY KEY,
  merchant_name TEXT NOT NULL,
  merchant_phone TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'VES',
  status TEXT DEFAULT 'waiting', -- 'waiting', 'paid', 'expired'
  paid_at TIMESTAMPTZ,
  reference TEXT,
  bank_code TEXT,
  payer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- Habilitar Supabase Realtime para WebSockets
-- =====================================================
-- Esto permite que el teléfono del cobrador reciba la confirmación
-- en milisegundos cuando el cliente toca "Pagar" en el otro celular.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'charge_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE charge_sessions;
  END IF;
END $$;

-- =====================================================
-- Políticas de Seguridad RLS (Row Level Security)
-- =====================================================
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para acceso público anónimo (MVP / Sandbox)
DROP POLICY IF EXISTS "Permitir lectura de comercios" ON merchants;
CREATE POLICY "Permitir lectura de comercios" 
  ON merchants FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Permitir registro de taps" ON tap_events;
CREATE POLICY "Permitir registro de taps" 
  ON tap_events FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir registro de pagos" ON payment_intents;
CREATE POLICY "Permitir registro de pagos" 
  ON payment_intents FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura de pagos" ON payment_intents;
CREATE POLICY "Permitir lectura de pagos" 
  ON payment_intents FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Permitir crear sesiones de cobro" ON charge_sessions;
CREATE POLICY "Permitir crear sesiones de cobro" 
  ON charge_sessions FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura de sesiones de cobro" ON charge_sessions;
CREATE POLICY "Permitir lectura de sesiones de cobro" 
  ON charge_sessions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Permitir actualizar sesiones de cobro" ON charge_sessions;
CREATE POLICY "Permitir actualizar sesiones de cobro" 
  ON charge_sessions FOR UPDATE TO anon USING (true);

-- =====================================================
-- 5. Billeteras y Saldos de Usuarios (Wallets & Ledger)
-- =====================================================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  user_name TEXT NOT NULL,
  balance NUMERIC(12,2) NOT NULL DEFAULT 1450.00,
  currency TEXT DEFAULT 'VES',
  default_bank TEXT DEFAULT 'banesco',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Transacciones del Ledger (Audit Trail)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES charge_sessions(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'payment_sent', 'payment_received', 'deposit', 'withdrawal'
  amount NUMERIC(12,2) NOT NULL,
  balance_before NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  counterparty_phone TEXT,
  counterparty_name TEXT,
  bank_code TEXT NOT NULL,
  reference TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para Wallets y Transacciones
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica de billeteras" ON wallets;
CREATE POLICY "Permitir lectura publica de billeteras" 
  ON wallets FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Permitir actualizar billeteras" ON wallets;
CREATE POLICY "Permitir actualizar billeteras" 
  ON wallets FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Permitir crear billeteras" ON wallets;
CREATE POLICY "Permitir crear billeteras" 
  ON wallets FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura de transacciones" ON wallet_transactions;
CREATE POLICY "Permitir lectura de transacciones" 
  ON wallet_transactions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Permitir registro de transacciones" ON wallet_transactions;
CREATE POLICY "Permitir registro de transacciones" 
  ON wallet_transactions FOR INSERT TO anon WITH CHECK (true);

-- Habilitar Realtime para wallets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'wallets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
  END IF;
END $$;

-- =====================================================
-- Procedimiento Almacenado Atómico: execute_tap_transfer
-- =====================================================
-- Realiza el débito del pagador y el abono al comercio de forma
-- 100% atómica mediante bloqueo FOR UPDATE, previniendo doble gasto.
CREATE OR REPLACE FUNCTION execute_tap_transfer(
  p_session_id TEXT,
  p_payer_phone TEXT,
  p_reference TEXT,
  p_bank_code TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session charge_sessions%ROWTYPE;
  v_payer wallets%ROWTYPE;
  v_merchant wallets%ROWTYPE;
  v_payer_before NUMERIC(12,2);
  v_payer_after NUMERIC(12,2);
  v_merch_before NUMERIC(12,2);
  v_merch_after NUMERIC(12,2);
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Bloquear y verificar la sesión de cobro
  SELECT * INTO v_session FROM charge_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND');
  END IF;

  IF v_session.status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_paid', true,
      'reference', v_session.reference,
      'amount', v_session.amount
    );
  END IF;

  -- 2. Bloquear y verificar billetera del pagador
  SELECT * INTO v_payer FROM wallets WHERE phone = p_payer_phone FOR UPDATE;
  IF NOT FOUND THEN
    -- Si no existe billetera para el pagador, inicializar con saldo base
    INSERT INTO wallets (phone, user_name, balance, default_bank)
    VALUES (p_payer_phone, 'Cliente Fiscus', 1450.00, p_bank_code)
    RETURNING * INTO v_payer;
  END IF;

  IF v_payer.balance < v_session.amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_FUNDS');
  END IF;

  -- 3. Bloquear o inicializar billetera del comercio
  IF v_session.merchant_phone IS NOT NULL AND v_session.merchant_phone <> '' THEN
    SELECT * INTO v_merchant FROM wallets WHERE phone = v_session.merchant_phone FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO wallets (phone, user_name, balance, default_bank)
      VALUES (v_session.merchant_phone, v_session.merchant_name, 1000.00, p_bank_code)
      RETURNING * INTO v_merchant;
    END IF;
  END IF;

  -- 4. Mutación atómica de saldos
  v_payer_before := v_payer.balance;
  v_payer_after := v_payer_before - v_session.amount;
  UPDATE wallets SET balance = v_payer_after, updated_at = v_now WHERE id = v_payer.id;

  IF v_merchant.id IS NOT NULL THEN
    v_merch_before := v_merchant.balance;
    v_merch_after := v_merch_before + v_session.amount;
    UPDATE wallets SET balance = v_merch_after, updated_at = v_now WHERE id = v_merchant.id;
  END IF;

  -- 5. Actualizar sesión de cobro
  UPDATE charge_sessions
  SET status = 'paid',
      paid_at = v_now,
      reference = p_reference,
      bank_code = p_bank_code,
      payer_name = v_payer.user_name
  WHERE id = p_session_id;

  -- 6. Insertar registros de auditoría en el ledger
  INSERT INTO wallet_transactions (
    wallet_id, session_id, type, amount, balance_before, balance_after,
    counterparty_phone, counterparty_name, bank_code, reference, created_at
  ) VALUES (
    v_payer.id, v_session.id, 'payment_sent', v_session.amount, v_payer_before, v_payer_after,
    v_session.merchant_phone, v_session.merchant_name, p_bank_code, p_reference, v_now
  );

  IF v_merchant.id IS NOT NULL THEN
    INSERT INTO wallet_transactions (
      wallet_id, session_id, type, amount, balance_before, balance_after,
      counterparty_phone, counterparty_name, bank_code, reference, created_at
    ) VALUES (
      v_merchant.id, v_session.id, 'payment_received', v_session.amount, v_merch_before, v_merch_after,
      v_payer.phone, v_payer.user_name, p_bank_code, p_reference, v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'reference', p_reference,
    'amount', v_session.amount,
    'new_payer_balance', v_payer_after,
    'new_merchant_balance', v_merch_after,
    'paid_at', v_now
  );
END;
$$;

-- =====================================================
-- Datos Semilla (Comercios y Billeteras Demo)
-- =====================================================
INSERT INTO merchants (slug, name, default_amount) VALUES
  ('sharky', 'SHARKY', 250.00),
  ('cafeteria-central', 'Cafetería Central', NULL),
  ('demo', 'Demo Store', 100.00)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO wallets (phone, user_name, balance, default_bank) VALUES
  ('04121234567', 'Comercio Fiscus Demo', 1000.00, 'banesco'),
  ('04149876543', 'Cliente Fiscus Demo', 1450.00, 'bdv')
ON CONFLICT (phone) DO NOTHING;

