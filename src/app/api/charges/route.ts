import { NextRequest, NextResponse } from 'next/server';
import { ChargeSession } from '@/types';
import { getSupabase } from '@/lib/supabase';

// In-memory fallback
const globalForCharges = globalThis as unknown as {
  fiscusCharges?: Map<string, ChargeSession>;
};

const chargesStore = globalForCharges.fiscusCharges || new Map<string, ChargeSession>();
if (!globalForCharges.fiscusCharges) {
  globalForCharges.fiscusCharges = chargesStore;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, merchant_name, merchant_phone } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }

    const id = `ch_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const session: ChargeSession = {
      id,
      merchant_name: merchant_name || 'Comercio Fiscus',
      merchant_phone: merchant_phone || '',
      amount: Number(amount),
      currency: 'VES',
      status: 'waiting',
      created_at: new Date().toISOString(),
    };

    // 1. Always keep in local memory
    chargesStore.set(id, session);

    // 2. Persist in Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('charge_sessions').insert(session);
      } catch (err) {
        console.warn('Error inserting into Supabase, using local fallback:', err);
      }
    }

    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: 'Error al crear sesión de cobro' }, { status: 500 });
  }
}

export async function GET() {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('charge_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && !error) {
        return NextResponse.json(data);
      }
    } catch {}
  }

  const sessions = Array.from(chargesStore.values());
  return NextResponse.json(sessions);
}
