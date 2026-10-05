import { supabase } from '@/lib/supabase';

type CjAction =
  | 'categories'
  | 'search'
  | 'detail'
  | 'variants'
  | 'stock'
  | 'freight'
  | 'order_create'
  | 'order_confirm'
  | 'order_detail'
  | 'balance'
  | 'order_pay'
  | 'tracking'
  | 'webhook_set'
  | 'webhook_subscribe_products';

interface CjRequest {
  supplierId: string;
  action: CjAction;
  params?: Record<string, string | number | boolean | undefined>;
  payload?: Record<string, unknown>;
  filters?: Record<string, string | number | boolean | undefined>;
  productId?: string;
  productSku?: string;
  countryCode?: string;
  variantId?: string;
}

interface CjResponse<T = unknown> {
  success: boolean;
  provider?: 'cj_dropshipping';
  action?: CjAction;
  fetchedAt?: string;
  data?: T;
  error?: string;
}

const invoke = async <T = unknown>(request: CjRequest): Promise<CjResponse<T>> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Authentication required');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cj-dropshipping`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(request),
    }
  );

  const result = (await response.json()) as CjResponse<T>;
  if (!response.ok || result.success !== true) {
    throw new Error(result.error || 'CJdropshipping request failed');
  }
  return result;
};

export const cjSupplierService = {
  getCategories(supplierId: string) {
    return invoke({ supplierId, action: 'categories' });
  },

  searchProducts(
    supplierId: string,
    filters: {
      page?: number;
      size?: number;
      keyWord?: string;
      categoryId?: string;
      countryCode?: string;
      minPrice?: number;
      maxPrice?: number;
    } = {}
  ) {
    return invoke({ supplierId, action: 'search', filters });
  },

  getProductDetail(supplierId: string, productId: string) {
    return invoke({ supplierId, action: 'detail', productId });
  },

  getVariants(
    supplierId: string,
    params: { productId?: string; productSku?: string; countryCode?: string }
  ) {
    return invoke({
      supplierId,
      action: 'variants',
      productId: params.productId,
      productSku: params.productSku,
      countryCode: params.countryCode,
    });
  },

  getStock(supplierId: string, variantId: string) {
    return invoke({ supplierId, action: 'stock', variantId });
  },

  calculateFreight(supplierId: string, payload: Record<string, unknown>) {
    return invoke({ supplierId, action: 'freight', payload });
  },

  createOrder(supplierId: string, payload: Record<string, unknown>) {
    return invoke({ supplierId, action: 'order_create', payload });
  },

  confirmOrder(supplierId: string, payload: Record<string, unknown>) {
    return invoke({ supplierId, action: 'order_confirm', payload });
  },

  getOrderDetail(supplierId: string, params: Record<string, string>) {
    return invoke({ supplierId, action: 'order_detail', params });
  },

  getBalance(supplierId: string) {
    return invoke({ supplierId, action: 'balance' });
  },

  payOrder(supplierId: string, payload: Record<string, unknown>) {
    return invoke({ supplierId, action: 'order_pay', payload });
  },

  getTracking(supplierId: string, params: Record<string, string>) {
    return invoke({ supplierId, action: 'tracking', params });
  },

  configureWebhooks(supplierId: string) {
    return invoke({ supplierId, action: 'webhook_set' });
  },

  subscribeWebhookProducts(supplierId: string, productIds: string[]) {
    return invoke({ supplierId, action: 'webhook_subscribe_products', payload: { productIds } });
  },
};
