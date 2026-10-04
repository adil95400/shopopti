import { supabase } from '@/lib/supabase';

export interface ShopifyConnection {
  id: string;
  platform_id: 'shopify';
  name: string;
  type: 'webstore';
  status: 'active';
  settings: {
    shop_id?: string;
    shop_domain?: string;
    plan?: string | null;
    scopes?: string[];
    location_id?: string;
    api_version?: string;
    validated_at?: string;
    oauth_managed?: boolean;
  };
  last_sync?: string | null;
  connected_at?: string | null;
}

export interface ShopifyStatus {
  connected: boolean;
  connection: ShopifyConnection | null;
}

export interface ShopifyPublication {
  status: 'pending' | 'published' | 'failed';
  shopify_product_id?: string | null;
  shopify_variant_id?: string | null;
  remote_snapshot?: Record<string, unknown>;
  published_at?: string | null;
  updated_at?: string;
}

interface ShopifyErrorPayload {
  code?: string;
  message?: string;
  retryable?: boolean;
}

export class ShopifyServiceError extends Error {
  constructor(
    message: string,
    public readonly code = 'SHOPIFY_REQUEST_FAILED',
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ShopifyServiceError';
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('shopify', { body });
  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    let payload: { error?: ShopifyErrorPayload } | null = null;
    try {
      payload = context?.json ? await context.json() as { error?: ShopifyErrorPayload } : null;
    } catch {
      payload = null;
    }
    throw new ShopifyServiceError(
      payload?.error?.message || error.message || 'Shopify request failed.',
      payload?.error?.code || 'SHOPIFY_REQUEST_FAILED',
      payload?.error?.retryable === true,
    );
  }

  const response = data as { success?: boolean; error?: ShopifyErrorPayload } | null;
  if (!response?.success) {
    throw new ShopifyServiceError(
      response?.error?.message || 'Shopify did not confirm the operation.',
      response?.error?.code || 'SHOPIFY_REQUEST_FAILED',
      response?.error?.retryable === true,
    );
  }
  return data as T;
}

export const shopifyService = {
  async getStatus(): Promise<ShopifyStatus> {
    const response = await invoke<{ success: true } & ShopifyStatus>({ action: 'status' });
    return { connected: response.connected === true, connection: response.connection ?? null };
  },

  async validate(storeUrl: string, accessToken: string) {
    return invoke<{ success: true; validated: true; shop: Record<string, unknown> }>({
      action: 'validate',
      store_url: storeUrl,
      access_token: accessToken,
    });
  },

  async connect(storeUrl: string, accessToken: string): Promise<ShopifyConnection> {
    const response = await invoke<{ success: true; connected: true; connection: ShopifyConnection }>({
      action: 'connect',
      store_url: storeUrl,
      access_token: accessToken,
    });
    if (response.connected !== true || response.connection?.status !== 'active') {
      throw new ShopifyServiceError('Shopify did not confirm the connection.', 'SHOPIFY_CONNECTION_UNCONFIRMED');
    }
    return response.connection;
  },

  async disconnect(): Promise<void> {
    const response = await invoke<{ success: true; connected: boolean }>({ action: 'disconnect' });
    if (response.connected !== false) {
      throw new ShopifyServiceError('Shopify did not confirm the disconnection.', 'SHOPIFY_DISCONNECT_UNCONFIRMED');
    }
  },

  async getPublication(productId: string): Promise<{ published: boolean; publication: ShopifyPublication | null }> {
    const response = await invoke<{
      success: true;
      published: boolean;
      publication: ShopifyPublication | null;
    }>({ action: 'publication_status', product_id: productId });
    return { published: response.published === true, publication: response.publication ?? null };
  },

  async publishProduct(productId: string) {
    return invoke<{
      success: true;
      published: true;
      confirmed: true;
      operation: 'created' | 'updated';
      product: Record<string, unknown>;
    }>({ action: 'publish_product', product_id: productId });
  },

  async updatePrice(productId: string, price: number) {
    return invoke<{ success: true; confirmed: true; product: Record<string, unknown> }>({
      action: 'update_price',
      product_id: productId,
      price,
    });
  },

  async updateInventory(productId: string, stock: number) {
    return invoke<{ success: true; confirmed: true; product: Record<string, unknown> }>({
      action: 'update_inventory',
      product_id: productId,
      stock,
    });
  },

  async getCategories(): Promise<Array<{ id: string; name: string }>> {
    const response = await invoke<{ success: true; available: false; categories: [] }>({ action: 'categories' });
    return response.categories;
  },
};
