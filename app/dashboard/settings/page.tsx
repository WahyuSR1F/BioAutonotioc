import { createClient } from '@/lib/supabase/server';
import SettingsForm from '@/components/settings/settings-form';
import WebhookIntegrations from '@/components/settings/webhook-integrations';
import { platforms } from '@/lib/platforms';
import type { Profile, WebhookIntegration } from '@/lib/supabase/types';

async function getOrCreateIntegrations(userId: string, appUrl: string): Promise<WebhookIntegration[]> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('webhook_integrations')
    .select('*')
    .eq('creator_id', userId);

  const existingPlatforms = new Set((existing ?? []).map((i) => i.platform));
  const integrations = (existing ?? []) as WebhookIntegration[];

  for (const platform of platforms) {
    if (!existingPlatforms.has(platform.id)) {
      const token = Array.from({ length: 48 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      const { data: created } = await supabase
        .from('webhook_integrations')
        .insert({ creator_id: userId, platform: platform.id, webhook_token: token })
        .select()
        .maybeSingle();

      if (created) integrations.push(created as WebhookIntegration);
    }
  }

  return integrations;
}

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const [profileRes, integrations] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, email, bio, store_slug')
      .eq('id', user.id)
      .maybeSingle(),
    getOrCreateIntegrations(user.id, appUrl),
  ]);

  const profile = profileRes.data as Pick<Profile, 'display_name' | 'email' | 'bio' | 'store_slug'> | null;

  const safeProfile = {
    display_name: profile?.display_name ?? null,
    email: profile?.email ?? user.email ?? '',
    bio: profile?.bio ?? null,
    store_slug: profile?.store_slug ?? null,
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola profil dan konfigurasi integrasi</p>
      </div>
      <div className="max-w-2xl space-y-8">
        <SettingsForm profile={safeProfile} />
        <WebhookIntegrations integrations={integrations} appUrl={appUrl} />
      </div>
    </div>
  );
}
