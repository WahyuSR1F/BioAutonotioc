import { getUser } from '@/lib/auth/me';
import { queryAll, bool, num, str, strOrNull } from '@/lib/turso/client';
import Link from 'next/link';
import { Plus, Package, ToggleLeft, ToggleRight, Link2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';
import type { Product } from '@/lib/types';

interface ProductRow extends Pick<Product, 'id' | 'title' | 'price' | 'currency' | 'cover_url' | 'is_active'> {
  order_count: number;
  link_count: number;
}

export default async function ProductsPage() {
  const user = await getUser();
  if (!user) return null;

  const rows = await queryAll(
    `SELECT p.id, p.title, p.price, p.currency, p.cover_url, p.is_active,
            (SELECT COUNT(*) FROM orders o WHERE o.product_id = p.id) AS order_count,
            (SELECT COUNT(*) FROM payment_links l WHERE l.product_id = p.id) AS link_count
     FROM products p
     WHERE p.creator_id = ?
     ORDER BY p.created_at DESC`,
    [user.id]
  );

  const products: ProductRow[] = rows.map((r) => ({
    id: str(r.id),
    title: str(r.title),
    price: num(r.price),
    currency: str(r.currency),
    cover_url: strOrNull(r.cover_url),
    is_active: bool(r.is_active),
    order_count: num(r.order_count),
    link_count: num(r.link_count),
  }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produk</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola produk digital Anda</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/products/new">
            <Plus className="w-4 h-4 mr-2" />
            Produk Baru
          </Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border border-dashed p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Belum ada produk</h3>
          <p className="text-sm text-muted-foreground mb-4">Upload produk digital pertama Anda</p>
          <Button asChild size="sm">
            <Link href="/dashboard/products/new">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Produk
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => {
            const orderCount = product.order_count;
            const linkCount = product.link_count;
            return (
              <div key={product.id} className="bg-white rounded-2xl border border-border p-5 flex items-center gap-5">
                {/* Cover */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary shrink-0">
                  {product.cover_url ? (
                    <Image src={product.cover_url} alt={product.title} width={64} height={64} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{product.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatCurrency(product.price, product.currency)}
                    <span className="mx-2 text-border">·</span>
                    {orderCount} pesanan
                    <span className="mx-2 text-border">·</span>
                    {linkCount} payment link
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 shrink-0">
                  {product.is_active ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                      <ToggleRight className="w-3.5 h-3.5" /> Aktif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                      <ToggleLeft className="w-3.5 h-3.5" /> Nonaktif
                    </span>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/products/${product.id}/links`}>
                      <Link2 className="w-3.5 h-3.5 mr-1.5" />
                      Links
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/products/${product.id}`}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
