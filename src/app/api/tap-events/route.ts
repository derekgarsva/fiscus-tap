import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, user_agent, metadata } = body;

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (merchant) {
          await supabase.from('tap_events').insert({
            merchant_id: merchant.id,
            user_agent: user_agent || '',
            metadata: metadata || {},
          });
        }
      } catch {}
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
