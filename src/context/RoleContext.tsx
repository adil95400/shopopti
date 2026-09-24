import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

import { supabase } from '@/lib/supabase';

export type UserRole = 'user' | 'admin';

interface RoleContextType {
  role: UserRole;
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  permissions: string[];
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const rolePermissions: Record<UserRole, string[]> = {
  user: [
    'products.view',
    'products.create',
    'products.edit.own',
    'orders.view.own',
    'orders.create',
    'suppliers.view',
    'analytics.view.basic'
  ],
  admin: [
    'products.view',
    'products.create',
    'products.edit.any',
    'products.delete.any',
    'orders.view.any',
    'orders.create',
    'orders.update.any',
    'orders.delete.any',
    'suppliers.view',
    'suppliers.create',
    'suppliers.edit',
    'suppliers.delete',
    'analytics.view.advanced',
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'settings.view',
    'settings.edit',
    'billing.view',
    'billing.edit'
  ]
};

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const resolveRole = async (userId?: string) => {
      if (!userId) {
        if (mounted) {
          setRole('user');
          setLoading(false);
        }
        return;
      }

      if (mounted) setLoading(true);

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (error) throw error;

        const isAdmin = (data ?? []).some(row => row.role === 'admin');

        if (mounted) {
          setRole(isAdmin ? 'admin' : 'user');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        if (mounted) {
          setRole('user');
          setLoading(false);
        }
      }
    };

    const initializeRole = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        await resolveRole(session?.user?.id);
      } catch (error) {
        console.error('Error reading auth session for role:', error);
        if (mounted) {
          setRole('user');
          setLoading(false);
        }
      }
    };

    initializeRole();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolveRole(session?.user?.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (permission: string): boolean => {
    return rolePermissions[role].includes(permission);
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        isAdmin: role === 'admin',
        hasPermission,
        permissions: rolePermissions[role],
        loading
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
