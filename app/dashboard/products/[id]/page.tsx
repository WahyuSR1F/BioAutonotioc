import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductForm from '@/components/products/product-form';
import type { Product, ProductFile } from '@/lib/supabase/types';

interface Props {
  params: { id: string };
}

export default async function EditProductPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: productData } = await supabase
    .from('products')
    .select('id, title, description, price, cover_url, is_active')
    .eq('id', params.id)
    .eq('creator_id', user.id)
    .maybeSingle();

  const product = productData as Pick<Product, 'id' | 'title' | 'description' | 'price' | 'cover_url' | 'is_active'> | null;
  if (!product) notFound();

  const { data: filesData } = await supabase
    .from('product_files')
    .select('id, file_name, file_size, storage_path')
    .eq('product_id', params.id);

  const files = (filesData ?? []) as Pick<ProductFile, 'id' | 'file_name' | 'file_size' | 'storage_path'>[];

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
