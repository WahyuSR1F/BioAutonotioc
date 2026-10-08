import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth/me';
import { queryAll, queryOne, bool, num, numOrNull, str, strOrNull } from '@/lib/turso/client';
import ProductForm from '@/components/products/product-form';
import type { Product, ProductFile } from '@/lib/types';

interface Props {
  params: { id: string };
}

export default async function EditProductPage({ params }: Props) {
  const user = await getUser();
  if (!user) return null;

  const productRow = await queryOne(
    'SELECT id, title, description, price, cover_url, is_active FROM products WHERE id = ? AND creator_id = ?',
    [params.id, user.id]
  );

  if (!productRow) notFound();

  const product: Pick<Product, 'id' | 'title' | 'description' | 'price' | 'cover_url' | 'is_active'> = {
    id: str(productRow.id),
    title: str(productRow.title),
    description: strOrNull(productRow.description),
    price: num(productRow.price),
    cover_url: strOrNull(productRow.cover_url),
    is_active: bool(productRow.is_active),
  };

  const fileRows = await queryAll(
    'SELECT id, file_name, file_size FROM product_files WHERE product_id = ?',
    [params.id]
  );

  const files: Pick<ProductFile, 'id' | 'file_name' | 'file_size'>[] = fileRows.map((r) => ({
    id: str(r.id),
    file_name: str(r.file_name),
    file_size: numOrNull(r.file_size),
  }));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Produk</h1>
        <p className="text-sm text-muted-foreground mt-1">{product.title}</p>
      </div>
      <div className="bg-white rounded-2xl border border-border p-6">
        <ProductForm defaultValues={product} existingFiles={files} />
      </div>
    </div>
  );
}
