import { getUser } from '@/lib/auth/me';
import { redirect } from 'next/navigation';
import { ensureDefaultAgent, listAgents, isAiConfigured } from '@/lib/ai';
import ChatPanel from '@/components/ai/chat-panel';

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const user = await getUser();
  if (!user) redirect('/login?e=1');

  await ensureDefaultAgent(user.id);
  const agents = await listAgents(user.id);
  const configured = isAiConfigured();

  return (
    <div className="p-8 space-y-6 flex flex-col h-full">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Asisten AI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chat dengan agent AI pilihanmu — mode Auto memakai agent default
        </p>
      </div>

      {!configured && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          OPENAI_API_KEY belum di-set di environment server — chat tidak akan berfungsi sampai key
          dipasang.
        </p>
      )}

      <div className="flex-1 min-h-[32rem] bg-white rounded-2xl border border-border overflow-hidden">
        <ChatPanel agents={agents} maxHeight="100%" />
      </div>
    </div>
  );
}
