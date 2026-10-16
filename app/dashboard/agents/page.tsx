import { getUser } from '@/lib/auth/me';
import { redirect } from 'next/navigation';
import { ensureDefaultAgent, listAgents, isAiConfigured } from '@/lib/ai';
import AgentsManager from '@/components/ai/agents-manager';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const user = await getUser();
  if (!user) redirect('/login?e=1');

  await ensureDefaultAgent(user.id);
  const agents = await listAgents(user.id);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agen AI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola banyak agent AI — aktifkan, nonaktifkan, atau atur agent default untuk mode Auto
        </p>
      </div>

      <AgentsManager initialAgents={agents} configured={isAiConfigured()} />
    </div>
  );
}
