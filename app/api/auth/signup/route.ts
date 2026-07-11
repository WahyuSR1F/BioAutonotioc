import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Create user directly via Auth Admin REST API
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json({
        error: result.msg || result.error || result.message || 'Gagal membuat akun',
      }, { status: 400 });
    }

    const userId = result.id;
    if (!userId) {
      return NextResponse.json({ error: 'Gagal membuat user' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      email,
      display_name: displayName || null,
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message || 'Gagal menyimpan profil' }, { status: 500 });
    }

    return NextResponse.json({ user: { id: userId, email } });
  } catch (err) {
    console.error('Signup error', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
