import { NextRequest, NextResponse } from 'next/server';
import { ChargeSession } from '@/types';
import { getSupabase } from '@/lib/supabase';

const globalForCharges = globalThis as unknown as {
  fiscusCharges?: Map<string, ChargeSession>;
};

const chargesStore = globalForCharges.fiscusCharges || new Map<string, ChargeSession>();
if (!globalForCharges.fiscusCharges) {
  globalForCharges.fiscusCharges = chargesStore;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Try Supabase first
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('charge_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (data && !error) {
        return NextResponse.json(data);
      }
    } catch {}
  }

  // Fallback to in-memory store
  const session = chargesStore.get(id);
  if (session) {
    return NextResponse.json(session);
  }

  return NextResponse.json({
    id,
    merchant_name: 'Comercio Fiscus',
    amount: 150.00,
    currency: 'VES',
    status: 'waiting',
    created_at: new Date().toISOString(),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { bank_code, payer_name, reference } = body;

    const paidSession: Partial<ChargeSession> = {
      status: 'paid',
      paid_at: new Date().toISOString(),
      bank_code: bank_code || 'banesco',
      payer_name: payer_name || 'Cliente',
      reference: reference || `FT-${Date.now().toString(36).toUpperCase()}`,
    };

    // 1. Update in-memory fallback
    const local = chargesStore.get(id);
    if (local) {
      Object.assign(local, paidSession);
    }

    // 2. Update Supabase (triggers Realtime WebSocket event to merchant)
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('charge_sessions')
          .update(paidSession)
          .eq('id', id)
          .select()
          .single();

        if (data && !error) {
          return NextResponse.json(data);
        }
      } catch (err) {
        console.warn('Error updating Supabase, using local fallback:', err);
      }
    }

    return NextResponse.json({
      id,
      merchant_name: local?.merchant_name || 'Comercio Fiscus',
      amount: local?.amount || 150.00,
      currency: 'VES',
      ...paidSession,
    });
  } catch {
    return NextResponse.json({ error: 'Error al procesar pago' }, { status: 500 });
  }
}
