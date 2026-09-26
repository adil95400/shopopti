const ENCRYPTION_VERSION = 1;

type SecretEnvelope = {
  v: number;
  alg: "AES-GCM";
  iv: string;
  ciphertext: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importEncryptionKey(rawKey: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(rawKey);
  if (keyBytes.byteLength !== 32) {
    throw new Error("Credential encryption key must be a base64-encoded 32-byte key");
  }

  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecretPayload(
  payload: Record<string, string>,
  rawKey: string,
): Promise<SecretEnvelope> {
  const key = await importEncryptionKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  return {
    v: ENCRYPTION_VERSION,
    alg: "AES-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptSecretPayload(
  envelope: SecretEnvelope,
  rawKey: string,
): Promise<Record<string, string>> {
  if (envelope.v !== ENCRYPTION_VERSION || envelope.alg !== "AES-GCM") {
    throw new Error("Unsupported credential envelope");
  }

  const key = await importEncryptionKey(rawKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ciphertext),
  );

  const parsed = JSON.parse(new TextDecoder().decode(plaintext));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid credential payload");
  }

  return parsed as Record<string, string>;
}
