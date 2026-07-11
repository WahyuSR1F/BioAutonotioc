import ProductForm from '@/components/products/product-form';

export default function NewProductPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Produk Baru</h1>
        <p className="text-sm text-muted-foreground mt-1">Isi detail produk digital Anda</p>
      </div>
      <div className="bg-white rounded-2xl border border-border p-6">
        <ProductForm />
      </div>
    </div>
  );
}
