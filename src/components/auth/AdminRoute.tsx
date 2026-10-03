import { Navigate, Outlet } from 'react-router-dom';

import { useRole } from '@/context/RoleContext';

const AdminRoute = () => {
  const { isAdmin, loading } = useRole();

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
