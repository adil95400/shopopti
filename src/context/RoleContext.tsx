import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

import { supabase } from '@/lib/supabase';

export type UserRole = 'user' | 'admin';

interface RoleContextType {
  role: UserRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
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

const normalizeRole = (value: unknown): UserRole => value === 'admin' ? 'admin' : 'user';

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchUserRole = async () => {
      setLoading(true);

      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (mounted) {
            setRole('user');
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase.rpc('get_current_user_role');

        if (error) {
          console.error('Error fetching user role:', error);
          if (mounted) {
            setRole('user');
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setRole(normalizeRole(data));
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

    fetchUserRole();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        if (mounted) {
          setRole('user');
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase.rpc('get_current_user_role');

      if (error) {
        console.error('Error refreshing user role:', error);
        if (mounted) {
          setRole('user');
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setRole(normalizeRole(data));
        setLoading(false);
      }
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
        isSuperAdmin: false,
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
