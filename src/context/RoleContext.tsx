import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

import { supabase } from '../lib/supabase';

// Define user roles
export type UserRole = 'viewer' | 'manager' | 'admin';

interface RoleContextType {
  role: UserRole;
  isAdmin: boolean;
  isManager: boolean;
  hasPermission: (permission: string) => boolean;
  permissions: string[];
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

// Define permissions for each role
const rolePermissions: Record<UserRole, string[]> = {
  viewer: [
    'products.view',
    'orders.view.any',
    'suppliers.view',
    'analytics.view.basic'
  ],
  manager: [
    'products.view',
    'products.create',
    'products.edit.any',
    'orders.view.any',
    'orders.create',
    'orders.update.any',
    'suppliers.view',
    'suppliers.create',
    'suppliers.edit',
    'analytics.view.advanced',
    'users.view'
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
  const [role, setRole] = useState<UserRole>('viewer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setRole('viewer');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (error || !data) {
          console.error('Error fetching user role:', error);
          setRole('viewer');
        } else {
          setRole(data.role as UserRole);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('viewer');
        setLoading(false);
      }
    };
    
    fetchUserRole();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single();

          if (error || !data) {
            setRole('viewer');
          } else {
            setRole(data.role as UserRole);
          }
        } else {
          setRole('viewer');
        }

        setLoading(false);
      }
    );
    
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
        isAdmin: role === 'admin',
        isManager: role === 'manager',
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