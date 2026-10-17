import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { Merchant } from '@/types';

// Fallback merchants for when Supabase is not configured
const FALLBACK_MERCHANTS: Merchant[] = [
  {
    id: 'fb-001',
    slug: 'sharky',
    name: 'SHARKY',
    default_amount: 250.0,
    currency: 'VES',
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fb-002',
    slug: 'cafeteria-central',
    name: 'Cafeter\u00eda Central',
    currency: 'VES',
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fb-003',
    slug: 'demo',
    name: 'Demo Store',
    default_amount: 100.0,
    currency: 'VES',
    active: true,
    created_at: new Date().toISOString(),
  },
];

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  // Try Supabase first
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .single();

    if (data && !error) {
      return NextResponse.json(data);
    }
  }

  // Fallback to local data
  const merchant = FALLBACK_MERCHANTS.find((m) => m.slug === slug);
  if (merchant) {
    return NextResponse.json(merchant);
  }

  return NextResponse.json(
    { error: 'Comercio no encontrado' },
    { status: 404 }
  );
}
