import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

import { supabase } from '../lib/supabase';

interface Workspace {
  id: string;
  owner_id: string;
  name: string | null;
  timezone: string | null;
  currency: string | null;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  loading: boolean;
  updateWorkspace: (values: Partial<Workspace>) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', session.user.id)
      .single();
    if (data) {
      setWorkspace(data as Workspace);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspace();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (session?.user) {
        fetchWorkspace();
      } else {
        setWorkspace(null);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateWorkspace = async (values: Partial<Workspace>) => {
    if (!workspace) return;
    const { data } = await supabase
      .from('workspaces')
      .update(values)
      .eq('id', workspace.id)
      .select('*')
      .single();
    if (data) {
      setWorkspace(data as Workspace);
    }
  };

  return (
    <WorkspaceContext.Provider value={{ workspace, loading, updateWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

