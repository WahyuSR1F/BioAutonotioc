'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Loader2,
  Copy,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { platforms } from '@/lib/platforms';
import type { WebhookIntegration } from '@/lib/supabase/types';

interface Props {
  integrations: WebhookIntegration[];
  appUrl: string;
}

export default function WebhookIntegrations({ integrations, appUrl }: Props) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Integrasi Platform</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Hubungkan BioAutomate ke platform link-bio favorit Anda
        </p>
      </div>
      <div className="grid gap-6">
        {platforms.map((platform) => {
          const integration = integrations.find((i) => i.platform === platform.id);
          return (
            <PlatformCard
              key={platform.id}
              platform={platform}
              integration={integration ?? null}
              appUrl={appUrl}
            />
          );
        })}
      </div>
    </section>
  );
}

function PlatformCard({
  platform,
  integration,
  appUrl,
}: {
  platform: (typeof platforms)[number];
  integration: WebhookIntegration | null;
  appUrl: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);

  const webhookUrl = integration
    ? `${appUrl}/api/webhooks/integration?platform=${platform.id}&token=${integration.webhook_token}`
    : null;

  async function handleReset() {
    setResetting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sesi habis'); setResetting(false); return; }

    const token = Array.from({ length: 48 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    const { error } = await supabase
      .from('webhook_integrations')
      .upsert({
        creator_id: user.id,
        platform: platform.id,
        webhook_token: token,
        is_connected: false,
        first_payload: null,
        connected_at: null,
        platform_username: null,
        updated_at: new Date().toISOString(),
      });

    if (error) { toast.error(error.message); }
    else { toast.success('Token diperbarui'); router.refresh(); }
    setResetting(false);
  }

  async function handleVerify() {
    setVerifying(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sesi habis'); setVerifying(false); return; }

    const { data, error } = await supabase
      .from('webhook_integrations')
      .select('is_connected, platform_username, first_payload')
      .eq('creator_id', user.id)
      .eq('platform', platform.id)
      .maybeSingle();

    if (error) { toast.error(error.message); }
    else if (data?.is_connected) {
      toast.success(`Koneksi ${platform.name} aktif!`);
    } else {
      toast.error('Belum ada data masuk. Lakukan transaksi uji coba dulu.');
    }
    setVerifying(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${platform.bgColor} flex items-center justify-center`}>
            <span className={`text-sm font-bold ${platform.color}`}>{platform.icon}</span>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{platform.name}</h3>
            {integration?.is_connected && integration.platform_username && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Terhubung sebagai {integration.platform_username}
              </p>
            )}
          </div>
        </div>
        {integration?.is_connected ? (
          <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Terhubung
          </Badge>
        ) : integration ? (
          <Badge variant="outline" className="text-muted-foreground text-xs gap-1 shrink-0">
            <AlertCircle className="w-3 h-3" />
            Menunggu
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground text-xs shrink-0">
            Belum Aktif
          </Badge>
        )}
      </div>

      {/* Not connected warning */}
      {integration && !integration.is_connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-medium">Belum terhubung</p>
            <p className="mt-0.5">Ikuti langkah di bawah untuk menghubungkan {platform.name}.</p>
          </div>
        </div>
      )}

      {/* Webhook URL */}
      {webhookUrl && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">URL Webhook</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-secondary/50 border border-border rounded-lg px-3 py-2 font-mono text-muted-foreground overflow-x-auto whitespace-nowrap">
              {webhookUrl}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast.success('URL disalin!');
              }}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Setup steps */}
      {(!integration || !integration.is_connected) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Panduan Setup:</p>
          <div className="space-y-1.5">
            {platform.setupSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          )}
          Reset Token
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleVerify}
          disabled={verifying}
        >
          {verifying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
          )}
          Verifikasi Koneksi
        </Button>
      </div>
    </div>
  );
}
