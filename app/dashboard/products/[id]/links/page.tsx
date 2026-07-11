import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaymentLinksManager from '@/components/products/payment-links-manager';
import type { PaymentLink, Product } from '@/lib/supabase/types';

interface Props {
  params: { id: string };
}

export default async function ProductLinksPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: productData } = await supabase
    .from('products')
    .select('id, title')
    .eq('id', params.id)
    .eq('creator_id', user.id)
    .maybeSingle();

  const product = productData as Pick<Product, 'id' | 'title'> | null;
  if (!product) notFound();

  const { data: linksData } = await supabase
    .from('payment_links')
    .select('id, slug, is_active, created_at')
    .eq('product_id', params.id)
    .order('created_at', { ascending: false });

  const links = (linksData ?? []) as Pick<PaymentLink, 'id' | 'slug' | 'is_active' | 'created_at'>[];

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
