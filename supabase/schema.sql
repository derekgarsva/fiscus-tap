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
-- Datos Semilla (Comercios Demo)
-- =====================================================
INSERT INTO merchants (slug, name, default_amount) VALUES
  ('sharky', 'SHARKY', 250.00),
  ('cafeteria-central', 'Cafetería Central', NULL),
  ('demo', 'Demo Store', 100.00)
ON CONFLICT (slug) DO NOTHING;
