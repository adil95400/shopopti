import { supabase } from '@/lib/supabase';
import { shopifyService } from '@/services/shopifyService';

export interface Platform {
  id: string;
  name: string;
  type: 'marketplace' | 'webstore' | 'social';
  connected: boolean;
  lastSync?: string;
  settings?: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  message: string;
  details?: {
    itemsProcessed: number;
    itemsSucceeded: number;
    itemsFailed: number;
    platforms: Array<{
      id: string;
      name: string;
      status: 'success' | 'error' | 'skipped';
      details?: string;
    }>;
  };
}

export interface SyncHistoryRecord {
  id: string;
  created_at: string;
  status: string;
  type: string;
  platforms: unknown;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  duration: number;
  initiated_by: string;
  error?: string | null;
  details?: unknown;
}

async function authenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Authentication is required.');
  return data.user.id;
}

function unsupported(platformId: string): never {
  throw new Error(`${platformId} is not available through the production integration path.`);
}

export const platformService = {
  async getPlatforms(): Promise<Platform[]> {
    const userId = await authenticatedUserId();
    const [{ data, error }, shopifyStatus] = await Promise.all([
      supabase
        .from('platform_connections')
        .select('platform_id, name, type, status, last_sync, settings')
        .eq('user_id', userId)
        .neq('platform_id', 'shopify'),
      shopifyService.getStatus(),
    ]);
    if (error) throw error;

    const platforms = (data || []).map(platform => ({
      id: platform.platform_id,
      name: platform.name,
      type: platform.type,
      connected: platform.status === 'active',
      lastSync: platform.last_sync,
      settings: platform.settings,
    }));
    if (shopifyStatus.connected && shopifyStatus.connection) {
      platforms.unshift({
        id: 'shopify',
        name: shopifyStatus.connection.name,
        type: 'webstore',
        connected: true,
        lastSync: shopifyStatus.connection.last_sync || undefined,
        settings: shopifyStatus.connection.settings,
      });
    }
    return platforms;
  },

  async connectPlatform(platformId: string, credentials: Record<string, string>): Promise<boolean> {
    if (platformId !== 'shopify') unsupported(platformId);
    const connection = await shopifyService.connect(credentials.storeUrl, credentials.accessToken);
    return connection.status === 'active';
  },

  async disconnectPlatform(platformId: string): Promise<boolean> {
    if (platformId !== 'shopify') unsupported(platformId);
    await shopifyService.disconnect();
    return true;
  },

  async validatePlatformCredentials(
    platformId: string,
    credentials: Record<string, string>,
  ): Promise<{ success: boolean; message: string }> {
    if (platformId !== 'shopify') unsupported(platformId);
    await shopifyService.validate(credentials.storeUrl, credentials.accessToken);
    return { success: true, message: 'Shopify confirmed the store identity and required scopes.' };
  },

  async synchronizePlatforms(): Promise<SyncResult> {
    throw new Error('Bulk platform synchronization is not implemented. No synchronization was started.');
  },

  async getPlatformCategories(platformId: string): Promise<Array<{ id: string; name: string }>> {
    if (platformId === 'shopify') return shopifyService.getCategories();
    return [];
  },

  async saveCategoryMappings(mappings: unknown[]): Promise<void> {
    const userId = await authenticatedUserId();
    const { error } = await supabase.from('category_mappings').insert(
      mappings.map(mapping => ({ user_id: userId, primary_category: 'custom', mappings: mapping })),
    );
    if (error) throw error;
  },

  async getSyncHistory(): Promise<SyncHistoryRecord[]> {
    const userId = await authenticatedUserId();
    const { data, error } = await supabase
      .from('sync_history')
      .select('id, created_at, status, type, platforms, items_processed, items_succeeded, items_failed, duration, initiated_by, error, details')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as SyncHistoryRecord[];
  },

  async saveNotificationSettings(settings: Record<string, unknown>): Promise<void> {
    const userId = await authenticatedUserId();
    const { data: existing, error: readError } = await supabase
      .from('notification_settings')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (readError) throw readError;
    const { error } = existing
      ? await supabase.from('notification_settings').update(settings).eq('id', existing.id).eq('user_id', userId)
      : await supabase.from('notification_settings').insert({ user_id: userId, ...settings });
    if (error) throw error;
  },

  async saveSyncSettings(settings: Record<string, unknown>): Promise<void> {
    const userId = await authenticatedUserId();
    const { data: existing, error: readError } = await supabase
      .from('sync_settings')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (readError) throw readError;
    const { error } = existing
      ? await supabase.from('sync_settings').update(settings).eq('id', existing.id).eq('user_id', userId)
      : await supabase.from('sync_settings').insert({ user_id: userId, ...settings });
    if (error) throw error;
  },
};
