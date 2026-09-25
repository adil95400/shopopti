const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

type AdminClient = any;

export interface CjCredentialRecord {
  supplier_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  open_id: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
}

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

export const getCjCredentials = async (
  admin: AdminClient,
  supplierId: string
): Promise<CjCredentialRecord> => {
  const { data, error } = await admin
    .schema("private")
    .from("supplier_credentials")
    .select(
      "supplier_id,provider,access_token,refresh_token,open_id,access_token_expires_at,refresh_token_expires_at"
    )
    .eq("supplier_id", supplierId)
    .eq("provider", "cj_dropshipping")
    .single();

  if (error || !data?.access_token) {
    throw new Error("CJ credential is missing");
  }

  return data as CjCredentialRecord;
};

export const getValidCjAccessToken = async (
  admin: AdminClient,
  supplierId: string
): Promise<string> => {
  const credential = await getCjCredentials(admin, supplierId);
  const now = Date.now();
  const refreshAheadMs = 24 * 60 * 60 * 1000;
  const accessExpiry = parseDate(credential.access_token_expires_at);

  if (!accessExpiry || accessExpiry - now > refreshAheadMs) {
    return credential.access_token;
  }

  const refreshExpiry = parseDate(credential.refresh_token_expires_at);
  if (
    !credential.refresh_token ||
    (refreshExpiry !== null && refreshExpiry <= now)
  ) {
    throw new Error("CJ authorization expired; reconnect this supplier");
  }

  const response = await fetch(`${CJ_BASE_URL}/authentication/refreshAccessToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ refreshToken: credential.refresh_token }),
  });

  const payload = await response.json().catch(() => null);
  const data = payload?.data ?? {};
  const accessToken = data?.accessToken ?? data?.access_token ?? null;
  const refreshToken =
    data?.refreshToken ?? data?.refresh_token ?? credential.refresh_token;
  const accessTokenExpiryDate =
    data?.accessTokenExpiryDate ?? data?.access_token_expiry_date ?? null;
  const refreshTokenExpiryDate =
    data?.refreshTokenExpiryDate ??
    data?.refresh_token_expiry_date ??
    credential.refresh_token_expires_at;

  if (!response.ok || payload?.result !== true || !accessToken) {
    throw new Error(payload?.message || "CJ token refresh failed");
  }

  const { error } = await admin
    .schema("private")
    .from("supplier_credentials")
    .update({
      access_token: String(accessToken),
      refresh_token: refreshToken ? String(refreshToken) : null,
      access_token_expires_at: accessTokenExpiryDate,
      refresh_token_expires_at: refreshTokenExpiryDate,
      updated_at: new Date().toISOString(),
    })
    .eq("supplier_id", supplierId)
    .eq("provider", "cj_dropshipping");

  if (error) {
    throw new Error("CJ token refresh could not be persisted");
  }

  return String(accessToken);
};
