import { supabase } from '@/lib/supabase';

async function invokeAi<T>(
  action: string,
  payload: Record<string, unknown>,
  options: { bypassCache?: boolean } = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-hub', {
    body: { action, payload, bypassCache: options.bypassCache === true },
  });

  if (error) {
    console.error(`AI action ${action} failed:`, error);
    throw new Error(error.message || 'AI request failed');
  }

  if (!data || typeof data !== 'object' || !('data' in data)) {
    throw new Error('Invalid AI response');
  }

  return (data as { data: T }).data;
}

export const aiService = {
  async generateProductDescription(product: {
    title: string;
    category: string;
    features: string[];
    targetAudience?: string;
    style?: 'professional' | 'casual' | 'luxury' | 'technical';
  }): Promise<string> {
    return invokeAi<string>('generateProductDescription', product);
  },

  async optimizeProductTitle(title: string, {
    category,
    keywords,
    maxLength = 70
  }: {
    category: string;
    keywords?: string[];
    maxLength?: number;
  }): Promise<string> {
    return invokeAi<string>('optimizeProductTitle', { title, category, keywords, maxLength });
  },

  async optimizeProduct(product: {
    name: string;
    description: string;
    category: string;
  }, options: { bypassCache?: boolean } = {}): Promise<{
    title: string;
    description_html: string;
    tags: string[];
    seo?: {
      metaTitle: string;
      metaDescription: string;
      keywords: string[];
    };
  }> {
    return invokeAi('optimizeProduct', product, options);
  },

  async optimizeForSEO({
    title,
    description,
    category
  }: {
    title: string;
    description: string;
    category: string;
  }): Promise<{
    title: string;
    description: string;
    keywords: string[];
    metaTitle: string;
    metaDescription: string;
  }> {
    return invokeAi('optimizeForSEO', { title, description, category });
  },

  async generateBlogContent(input: {
    title: string;
    keywords: string[];
    type: string;
    targetAudience: string;
    tone: string;
    wordCount: number;
    structure: string[];
  }): Promise<string> {
    return invokeAi('generateBlogContent', input);
  },

  async generateHashtags(input: {
    product: string;
    platform: string;
    count: number;
  }): Promise<string[]> {
    try {
      return await invokeAi<string[]>('generateHashtags', input);
    } catch (error) {
      console.error('Error generating hashtags:', error);
      return [];
    }
  },

  async generateVariants(input: {
    title: string;
    description?: string;
    category?: string;
    attributes?: Record<string, string[]>;
  }): Promise<Array<{ title: string; options: Record<string, string> }>> {
    try {
      return await invokeAi('generateVariants', input);
    } catch (error) {
      console.error('Error generating variants:', error);
      return [];
    }
  },

  async analyzeSentiment(text: string): Promise<'positive' | 'negative' | 'neutral'> {
    try {
      return await invokeAi('analyzeSentiment', { text });
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return 'neutral';
    }
  },

  async generateResponse(input: {
    review: string;
    rating: number;
    sentiment?: 'positive' | 'negative' | 'neutral';
    verified?: boolean;
  }): Promise<string> {
    try {
      return await invokeAi('generateResponse', input);
    } catch (error) {
      console.error('Error generating response:', error);
      return 'Merci pour votre avis. Nous apprécions vos commentaires.';
    }
  },

  async analyzeCampaignPerformance({
    campaign,
    metrics,
    goals
  }: {
    campaign: any;
    metrics: {
      reach: number;
      engagement: number;
      conversions: number;
      revenue: number;
    };
    goals: any;
  }): Promise<{
    metrics: {
      reach: number;
      engagement: number;
      conversions: number;
      revenue: number;
    };
    insights: string[];
    recommendations: string[];
  }> {
    try {
      return await invokeAi('analyzeCampaignPerformance', { campaign, metrics, goals });
    } catch (error) {
      console.error('Error analyzing campaign performance:', error);
      return {
        metrics,
        insights: ['Analyse non disponible en ce moment.'],
        recommendations: ['Réessayez plus tard.']
      };
    }
  }
};
