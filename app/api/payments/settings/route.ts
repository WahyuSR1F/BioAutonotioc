import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getUserFromStore } from '@/lib/auth/me';
import { getPaymentSettings, savePaymentSettings, getProviderEnvStatus } from '@/lib/payments';

export const runtime = 'nodejs';

const schema = z.object({
  midtransEnabled: z.boolean(),
  xenditEnabled: z.boolean(),
  adminFeePercent: z.coerce.number().min(0, 'Persen minimal 0').max(100, 'Persen maksimal 100'),
  adminFeeFlat: z.coerce.number().min(0, 'Biaya tetap minimal 0').max(1_000_000_000, 'Biaya tetap terlalu besar'),
});

export async function GET() {
  const user = await getUserFromStore(cookies());
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await getPaymentSettings(user.id);
  return NextResponse.json({ settings, providers: getProviderEnvStatus() });
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromStore(cookies());
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join('.')}: ${first.message}` : 'Data tidak valid' },
      { status: 400 }
    );
  }

  const settings = await savePaymentSettings({
    creatorId: user.id,
    midtransEnabled: Boolean(parsed.data.midtransEnabled),
    xenditEnabled: Boolean(parsed.data.xenditEnabled),
    adminFeePercent: parsed.data.adminFeePercent,
    adminFeeFlat: parsed.data.adminFeeFlat,
  });

  return NextResponse.json({ settings });
}
