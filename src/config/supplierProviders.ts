import type { SupplierProviderType } from '@/types/supplier';

export type SupplierCapability =
  | 'catalog'
  | 'import'
  | 'price'
  | 'stock'
  | 'variants'
  | 'shipping'
  | 'orders'
  | 'tracking';

export type SupplierConnectorStage = 'implemented' | 'planned' | 'legacy' | 'custom';

export interface SupplierProviderDefinition {
  type: SupplierProviderType;
  name: string;
  stage: SupplierConnectorStage;
  priority: 1 | 2 | 3;
  region: string;
  capabilities: Partial<Record<SupplierCapability, 'implemented' | 'documented' | 'planned' | 'unknown'>>;
}

export const supplierProviders: SupplierProviderDefinition[] = [
  {
    type: 'cj_dropshipping',
    name: 'CJdropshipping',
    stage: 'implemented',
    priority: 1,
    region: 'Global',
    capabilities: {
      catalog: 'implemented',
      import: 'implemented',
      price: 'implemented',
      stock: 'implemented',
      variants: 'implemented',
      shipping: 'implemented',
      orders: 'implemented',
      tracking: 'implemented',
    },
  },
  {
    type: 'bigbuy',
    name: 'BigBuy',
    stage: 'planned',
    priority: 1,
    region: 'Europe',
    capabilities: {
      catalog: 'documented',
      import: 'implemented',
      price: 'documented',
      stock: 'documented',
      variants: 'documented',
      shipping: 'documented',
      orders: 'documented',
      tracking: 'unknown',
    },
  },
  {
    type: 'aliexpress',
    name: 'AliExpress',
    stage: 'planned',
    priority: 1,
    region: 'Global',
    capabilities: {
      catalog: 'planned',
      import: 'planned',
      price: 'planned',
      stock: 'planned',
      variants: 'planned',
      shipping: 'planned',
      orders: 'planned',
      tracking: 'planned',
    },
  },
  {
    type: 'alibaba',
    name: 'Alibaba',
    stage: 'planned',
    priority: 2,
    region: 'Global',
    capabilities: {},
  },
  {
    type: 'banggood',
    name: 'Banggood',
    stage: 'planned',
    priority: 2,
    region: 'Global',
    capabilities: {},
  },
  {
    type: 'dhgate',
    name: 'DHgate',
    stage: 'planned',
    priority: 2,
    region: 'Global',
    capabilities: {},
  },
  {
    type: 'cdiscount',
    name: 'Cdiscount',
    stage: 'legacy',
    priority: 2,
    region: 'France / Europe',
    capabilities: {},
  },
  {
    type: 'spocket',
    name: 'Spocket',
    stage: 'legacy',
    priority: 3,
    region: 'Global',
    capabilities: {},
  },
  {
    type: 'eprolo',
    name: 'EPROLO',
    stage: 'legacy',
    priority: 3,
    region: 'Global',
    capabilities: {},
  },
  {
    type: 'custom_api',
    name: 'API personnalisée',
    stage: 'custom',
    priority: 1,
    region: 'Custom',
    capabilities: {},
  },
  {
    type: 'custom_csv',
    name: 'CSV',
    stage: 'custom',
    priority: 1,
    region: 'Custom',
    capabilities: {},
  },
  {
    type: 'custom_xml',
    name: 'XML',
    stage: 'custom',
    priority: 1,
    region: 'Custom',
    capabilities: {},
  },
  {
    type: 'custom_ftp',
    name: 'FTP',
    stage: 'custom',
    priority: 1,
    region: 'Custom',
    capabilities: {},
  },
];

export const getSupplierProviderDefinition = (type: SupplierProviderType) =>
  supplierProviders.find((provider) => provider.type === type);
