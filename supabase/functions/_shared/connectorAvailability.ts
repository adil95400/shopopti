type AdminClient = any;

export type ConnectorAvailability = 'enabled' | 'maintenance' | 'disabled';

export const getConnectorAvailability = async (
  admin: AdminClient,
  provider: string
): Promise<ConnectorAvailability> => {
  const { data, error } = await admin
    .from('supplier_connector_settings')
    .select('status')
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw new Error('Connector availability could not be verified');
  }

  const status = data?.status;
  if (status === 'enabled' || status === 'maintenance' || status === 'disabled') {
    return status;
  }

  return 'disabled';
};

export const requireConnectorEnabled = async (
  admin: AdminClient,
  provider: string
): Promise<void> => {
  const status = await getConnectorAvailability(admin, provider);

  if (status === 'maintenance') {
    throw new Error('This supplier connector is temporarily in maintenance');
  }

  if (status !== 'enabled') {
    throw new Error('This supplier connector is disabled');
  }
};
