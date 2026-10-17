import { NextRequest, NextResponse } from 'next/server';
import { ChargeSession } from '@/types';
import { getSupabase } from '@/lib/supabase';
import { generateBankingReference } from '@/lib/banking-reference';

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
    const { bank_code, payer_name, payer_phone, reference } = body;

    const local = chargesStore.get(id);
    const amount = local?.amount || body.amount || 150.00;
    const effectiveBankCode = bank_code || 'banesco';
    const effectivePhone = payer_phone || '04149876543';

    // Generate compliant SUDEBAN reference if not supplied
    const finalRef = reference || generateBankingReference({
      bankCode: effectiveBankCode,
      sessionId: id,
      payerPhone: effectivePhone,
      amount,
    });

    const paidSession: Partial<ChargeSession> = {
      status: 'paid',
      paid_at: new Date().toISOString(),
      bank_code: effectiveBankCode,
      payer_name: payer_name || 'Cliente',
      reference: finalRef,
    };

    // 1. Update in-memory fallback
    if (local) {
      Object.assign(local, paidSession);
    }

    // 2. Execute Atomic Settlement in Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Attempt atomic RPC execute_tap_transfer first
        const { data: rpcData, error: rpcError } = await supabase.rpc('execute_tap_transfer', {
          p_session_id: id,
          p_payer_phone: effectivePhone,
          p_reference: finalRef,
          p_bank_code: effectiveBankCode,
        });

        if (rpcData && !rpcError) {
          return NextResponse.json({
            id,
            merchant_name: local?.merchant_name || 'Comercio Fiscus',
            amount,
            currency: 'VES',
            ...paidSession,
            ledgerResult: rpcData,
          });
        }

        // Direct table update fallback if RPC function not yet created in remote DB
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
      amount,
      currency: 'VES',
      ...paidSession,
    });
  } catch {
    return NextResponse.json({ error: 'Error al procesar pago' }, { status: 500 });
  }
}
