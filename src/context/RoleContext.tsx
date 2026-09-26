import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

import { supabase } from '@/lib/supabase';

// Define user roles
export type UserRole = 'user' | 'admin' | 'superadmin';

interface RoleContextType {
  role: UserRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  permissions: string[];
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

// Define permissions for each role
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
    'suppliers.view',
    'suppliers.create',
    'suppliers.edit',
    'analytics.view.advanced',
    'users.view',
    'users.edit'
  ],
  superadmin: [
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
    const resolveRole = async (userId?: string | null) => {
      if (!userId) {
        setRole('user');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (error) throw error;

        const roles = (data ?? []).map((row) => String(row.role));
        setRole(roles.includes('admin') ? 'admin' : 'user');
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('user');
      } finally {
        setLoading(false);
      }
    };

    const fetchUserRole = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await resolveRole(session?.user?.id);
    };

    void fetchUserRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      void resolveRole(session?.user?.id);
    });

    return () => {
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
        isAdmin: role === 'admin' || role === 'superadmin',
        isSuperAdmin: role === 'superadmin',
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