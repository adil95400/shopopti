import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

import { supabase } from '../lib/supabase';

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  timezone: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  loading: boolean;
  refresh: () => Promise<void>;
  update: (values: Partial<Pick<Workspace, 'name' | 'timezone' | 'currency'>>) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', userId)
      .single();
    if (data) {
      setWorkspace(data as Workspace);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspace();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchWorkspace();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const update = async (values: Partial<Pick<Workspace, 'name' | 'timezone' | 'currency'>>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const updates = { ...workspace, ...values, owner_id: userId } as Partial<Workspace> & { owner_id: string };
    const { data } = await supabase
      .from('workspaces')
      .upsert(updates, { onConflict: 'owner_id' })
      .select()
      .single();
    if (data) {
      setWorkspace(data as Workspace);
    }
  };

  return (
    <WorkspaceContext.Provider value={{ workspace, loading, refresh: fetchWorkspace, update }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
};

