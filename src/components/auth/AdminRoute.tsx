import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useRole } from '@/context/RoleContext';

const AdminRoute = () => {
  const { isAdmin, loading } = useRole();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
