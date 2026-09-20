import { supabase } from '@/lib/supabase';

export async function auditSEOWithAI({
  title,
  description,
  tags
}: {
  title: string;
  description: string;
  tags: string;
}) {
  const { data, error } = await supabase.functions.invoke('seo-audit', {
    body: { title, description, tags }
  });

  if (error) {
    console.error('SEO audit request failed:', error);
    throw new Error(error.message || 'Failed to get SEO analysis');
  }

  if (!data || typeof data !== 'object' || !('data' in data)) {
    throw new Error('Invalid SEO audit response');
  }

  return (data as { data: unknown }).data;
}
