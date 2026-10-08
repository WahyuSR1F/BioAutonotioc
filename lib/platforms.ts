import type { PlatformConfig } from '@/lib/types';

export const platforms: PlatformConfig[] = [
  {
    id: 'lynk',
    name: 'Lynk.id',
    icon: 'L',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    setupSteps: [
      'Buka dashboard Lynk.id Anda',
      'Pergi ke menu Settings > Advanced Settings',
      'Tempelkan URL webhook ke kolom Webhook / API URL',
      'Klik Save, lalu lakukan transaksi uji coba',
    ],
    docsUrl: 'https://lynk.id',
  },
  {
    id: 'linktree',
    name: 'Linktree',
    icon: 'Li',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    setupSteps: [
      'Buka dashboard Linktree Anda',
      'Pergi ke Settings > integrations',
      'Cari opsi Webhook / API dan tempelkan URL',
      'Simpan dan lakukan uji coba transaksi',
    ],
    docsUrl: 'https://linktr.ee',
  },
  {
    id: 'saweria',
    name: 'Saweria',
    icon: 'S',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    setupSteps: [
      'Buka dashboard Saweria Anda',
      'Pergi ke Pengaturan > Webhook',
      'Tempelkan URL webhook BioAutomate',
      'Simpan dan lakukan uji coba donasi',
    ],
    docsUrl: 'https://saweria.co',
  },
  {
    id: 'sociabuzz',
    name: 'Sociabuzz',
    icon: 'Sb',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    setupSteps: [
      'Buka dashboard Sociabuzz Anda',
      'Pergi ke Settings > Webhook',
      'Tempelkan URL webhook BioAutomate',
      'Simpan dan lakukan uji coba transaksi',
    ],
    docsUrl: 'https://sociabuzz.com',
  },
];

export function getPlatform(id: string): PlatformConfig | undefined {
  return platforms.find((p) => p.id === id);
}
