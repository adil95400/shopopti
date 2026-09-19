import React, { useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface CategoryMappingProps {
  platforms: Array<{
    id: string;
    name: string;
    connected: boolean;
  }>;
  onSaveMapping: (mapping: CategoryMapping[]) => Promise<void>;
  onRefreshCategories: () => Promise<void>;
}

export interface CategoryMapping {
  id: string;
  primaryCategory: string;
  mappings: Array<{
    platformId: string;
    categoryId: string;
    categoryName: string;
  }>;
}

const CategoryMapping: React.FC<CategoryMappingProps> = ({
  platforms,
  onSaveMapping,
  onRefreshCategories,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const mappings: CategoryMapping[] = [];
  const connectedPlatforms = platforms.filter(platform => platform.connected);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshCategories();
      toast.info('No verified Shopify category source is available yet.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Category refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (mappings.length === 0) {
      toast.error('No verified category mapping is available to save.');
      return;
    }
    await onSaveMapping(mappings);
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-medium">Category mapping</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || connectedPlatforms.length === 0}
          >
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={mappings.length === 0}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <p>
          Category synchronization is not implemented through the verified Shopify server path.
          No sample category or mapping is shown or persisted.
        </p>
      </div>
    </div>
  );
};

export default CategoryMapping;
export { CategoryMapping };
