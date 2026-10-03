import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  RefreshCw,
  Search,
  Shield,
  Trash,
  UserPlus,
  Users as UsersIcon,
  XCircle
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useRole } from '@/context/RoleContext';
import {
  adminUserService,
  type AdminRole,
  type AdminUserRecord
} from '@/services/adminUserService';
import { Button } from '@/components/ui/button';

const roleLabels: Record<AdminRole, string> = {
  user: 'Utilisateur',
  admin: 'Admin',
  staff: 'Staff',
  agency: 'Agence'
};

const UsersAdmin: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  const fetchUsers = async (targetPage = page) => {
    try {
      setLoading(true);
      const result = await adminUserService.listUsers(targetPage, 50);
      setUsers(result.users);
      setPage(result.page);
      setLastPage(result.lastPage);
      setTotal(result.total);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Impossible de charger les utilisateurs'
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void fetchUsers(1);
    }
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !search ||
        user.email.toLowerCase().includes(search) ||
        user.name.toLowerCase().includes(search) ||
        (user.company_name?.toLowerCase().includes(search) ?? false);

      const matchesRole = selectedRole ? user.role === selectedRole : true;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, selectedRole]);

  const handleInvite = async () => {
    const email = window.prompt("Adresse e-mail de l'utilisateur à inviter :")?.trim();
    if (!email) return;

    const name = window.prompt('Nom (facultatif) :')?.trim() ?? '';

    try {
      await adminUserService.inviteUser(email, name);
      toast.success('Invitation envoyée');
      await fetchUsers(1);
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error(
        error instanceof Error ? error.message : "Échec de l'invitation"
      );
    }
  };

  const handleRoleChange = async (user: AdminUserRecord, role: AdminRole) => {
    if (role === user.role) return;

    try {
      setActionUserId(user.id);
      await adminUserService.setRole(user.id, role);
      toast.success('Rôle mis à jour : ' + roleLabels[role]);
      await fetchUsers(page);
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error(
        error instanceof Error ? error.message : 'Échec du changement de rôle'
      );
    } finally {
      setActionUserId(null);
    }
  };

  const handleToggleUserStatus = async (user: AdminUserRecord) => {
    const suspend = user.is_active;
    const confirmation = suspend
      ? 'Suspendre le compte ' + user.email + ' ?'
      : 'Réactiver le compte ' + user.email + ' ?';

    if (!window.confirm(confirmation)) return;

    try {
      setActionUserId(user.id);
      await adminUserService.setSuspended(user.id, suspend);
      toast.success(suspend ? 'Compte suspendu' : 'Compte réactivé');
      await fetchUsers(page);
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error(
        error instanceof Error ? error.message : 'Échec du changement de statut'
      );
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeleteUser = async (user: AdminUserRecord) => {
    if (
      !window.confirm(
        'Supprimer définitivement ' +
          user.email +
          ' ? Cette action est irréversible.'
      )
    ) {
      return;
    }

    try {
      setActionUserId(user.id);
      await adminUserService.deleteUser(user.id);
      toast.success('Utilisateur supprimé');
      await fetchUsers(page);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(
        error instanceof Error ? error.message : "Échec de la suppression"
      );
    } finally {
      setActionUserId(null);
    }
  };

  if (roleLoading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-gray-500">
            Comptes Supabase réels, rôles, suspensions et historique d'administration
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchUsers(page)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={() => void handleInvite()}>
            <UserPlus className="h-4 w-4 mr-2" />
            Inviter
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Utilisateurs Auth</div>
          <div className="mt-1 text-2xl font-bold">{total}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Actifs sur cette page</div>
          <div className="mt-1 text-2xl font-bold">
            {users.filter((user) => user.is_active).length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Admins sur cette page</div>
          <div className="mt-1 text-2xl font-bold">
            {users.filter((user) => user.role === 'admin').length}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou société..."
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-gray-300 px-3 py-2"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value)}
        >
          <option value="">Tous les rôles</option>
          <option value="user">Utilisateur</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="agency">Agence</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Inscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Dernière connexion
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-gray-500" />
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const actionLoading = actionUserId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                            <UsersIcon className="h-5 w-5 text-gray-500" />
                          </div>
                          <div className="ml-4 min-w-0">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {user.name || 'Utilisateur sans nom'}
                            </div>
                            <div className="truncate text-sm text-gray-500">
                              {user.email}
                            </div>
                            {user.company_name && (
                              <div className="truncate text-xs text-gray-400">
                                {user.company_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {user.role === 'admin' && (
                            <Shield className="h-4 w-4 text-blue-600" />
                          )}
                          <select
                            className="rounded border border-gray-200 px-2 py-1 text-sm"
                            value={user.role}
                            disabled={actionLoading}
                            onChange={(event) =>
                              void handleRoleChange(
                                user,
                                event.target.value as AdminRole
                              )
                            }
                          >
                            <option value="user">Utilisateur</option>
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                            <option value="agency">Agence</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={
                            user.is_active
                              ? 'inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800'
                              : 'inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800'
                          }
                        >
                          {user.is_active ? 'Actif' : 'Suspendu'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleString('fr-FR')
                          : 'Jamais'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => void handleToggleUserStatus(user)}
                            className={
                              user.is_active
                                ? 'rounded-full p-1 text-amber-600 hover:text-amber-900 disabled:opacity-40'
                                : 'rounded-full p-1 text-green-600 hover:text-green-900 disabled:opacity-40'
                            }
                            title={user.is_active ? 'Suspendre' : 'Réactiver'}
                          >
                            {user.is_active ? (
                              <XCircle className="h-5 w-5" />
                            ) : (
                              <CheckCircle className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => void handleDeleteUser(user)}
                            className="rounded-full p-1 text-red-600 hover:text-red-900 disabled:opacity-40"
                            title="Supprimer"
                          >
                            <Trash className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Page {page}
          {lastPage ? ' / ' + lastPage : ''}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={loading || page <= 1}
            onClick={() => void fetchUsers(page - 1)}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            disabled={loading || (lastPage !== null && page >= lastPage)}
            onClick={() => void fetchUsers(page + 1)}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UsersAdmin;
