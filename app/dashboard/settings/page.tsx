import { getUser } from '@/lib/auth/me';
import { execute, queryAll, queryOne, bool, str, strOrNull } from '@/lib/turso/client';
import SettingsForm from '@/components/settings/settings-form';
import WebhookIntegrations from '@/components/settings/webhook-integrations';
import { platforms } from '@/lib/platforms';
import type { Profile, WebhookIntegration } from '@/lib/types';

function mapIntegration(r: Record<string, unknown>): WebhookIntegration {
  return {
    id: str(r.id),
    creator_id: str(r.creator_id),
    platform: str(r.platform),
    webhook_token: str(r.webhook_token),
    platform_username: strOrNull(r.platform_username),
    is_connected: bool(r.is_connected),
    first_payload: strOrNull(r.first_payload) ? JSON.parse(str(r.first_payload)) : null,
    connected_at: strOrNull(r.connected_at),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
}

async function getOrCreateIntegrations(userId: string): Promise<WebhookIntegration[]> {
  const existing = await queryAll(
    'SELECT * FROM webhook_integrations WHERE creator_id = ?',
    [userId]
  );

  const integrations = existing.map(mapIntegration);
  const existingPlatforms = new Set(integrations.map((i) => i.platform));

  for (const platform of platforms) {
    if (!existingPlatforms.has(platform.id)) {
      const token = Array.from({ length: 48 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      const created = await queryOne(
        `INSERT INTO webhook_integrations (id, creator_id, platform, webhook_token)
         VALUES (?, ?, ?, ?)
         RETURNING *`,
        [crypto.randomUUID(), userId, platform.id, token]
      );

      if (created) integrations.push(mapIntegration(created));
    }
  }

  return integrations;
}

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) return null;

  const [profile, integrations] = await Promise.all([
    queryOne(
      'SELECT display_name, email, bio, store_slug FROM profiles WHERE id = ?',
      [user.id]
    ),
    getOrCreateIntegrations(user.id),
  ]);

  const safeProfile = {
    display_name: profile ? strOrNull(profile.display_name) : null,
    email: (profile ? strOrNull(profile.email) : null) ?? user.email ?? '',
    bio: profile ? strOrNull(profile.bio) : null,
    store_slug: profile ? strOrNull(profile.store_slug) : null,
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola profil dan konfigurasi integrasi</p>
      </div>
      <div className="max-w-2xl space-y-8">
        <SettingsForm profile={safeProfile} />
        <WebhookIntegrations integrations={integrations} appUrl={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'} />
      </div>
    </div>
  );
}
