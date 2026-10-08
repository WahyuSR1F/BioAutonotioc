import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth/me';
import { queryAll, queryOne, bool, str, strOrNull } from '@/lib/turso/client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaymentLinksManager from '@/components/products/payment-links-manager';
import type { PaymentLink, Product } from '@/lib/types';

interface Props {
  params: { id: string };
}

export default async function ProductLinksPage({ params }: Props) {
  const user = await getUser();
  if (!user) return null;

  const productRow = await queryOne(
    'SELECT id, title FROM products WHERE id = ? AND creator_id = ?',
    [params.id, user.id]
  );
  if (!productRow) notFound();

  const product: Pick<Product, 'id' | 'title'> = {
    id: str(productRow.id),
    title: str(productRow.title),
  };

  const linkRows = await queryAll(
    'SELECT id, slug, is_active, created_at FROM payment_links WHERE product_id = ? ORDER BY created_at DESC',
    [params.id]
  );

  const links: Pick<PaymentLink, 'id' | 'slug' | 'is_active' | 'created_at'>[] = linkRows.map((r) => ({
    id: str(r.id),
    slug: str(r.slug),
    is_active: bool(r.is_active),
    created_at: str(r.created_at),
  }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/products">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Links</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{product.title}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6">
        <PaymentLinksManager
          productId={product.id}
          productTitle={product.title}
          initialLinks={links}
        />
      </div>
    </div>
  );
}
