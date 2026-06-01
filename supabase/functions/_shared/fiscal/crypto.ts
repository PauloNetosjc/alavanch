// AES-256-GCM helpers usando Web Crypto API (Deno nativo).
// FISCAL_CRYPTO_KEY deve ser uma string base64 representando 32 bytes.
// Nunca logue valores cifrados/decifrados nem a chave.

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("FISCAL_CRYPTO_KEY");
  if (!raw) throw new Error("FISCAL_CRYPTO_KEY não configurado");
  let keyBytes: Uint8Array;
  try {
    keyBytes = b64ToBytes(raw);
  } catch {
    keyBytes = new TextEncoder().encode(raw);
  }
  if (keyBytes.length !== 32) {
    // Deriva via SHA-256 caso a chave não tenha 32 bytes
    const hashBuf = await crypto.subtle.digest("SHA-256", keyBytes);
    keyBytes = new Uint8Array(hashBuf);
  }
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(plain: string): Promise<{ cifrado: string; iv: string; tag: string; algoritmo: string }> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plain);
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const ct = new Uint8Array(ctBuf);
  // Web Crypto concatena tag (16 bytes) ao final do ciphertext.
  const tag = ct.slice(ct.length - 16);
  const cipher = ct.slice(0, ct.length - 16);
  return {
    cifrado: bytesToB64(cipher),
    iv: bytesToB64(iv),
    tag: bytesToB64(tag),
    algoritmo: "AES-256-GCM",
  };
}

export async function decryptString(cifrado: string, ivB64: string, tagB64: string): Promise<string> {
  const key = await getKey();
  const iv = b64ToBytes(ivB64);
  const cipher = b64ToBytes(cifrado);
  const tag = b64ToBytes(tagB64);
  const combined = new Uint8Array(cipher.length + tag.length);
  combined.set(cipher, 0);
  combined.set(tag, cipher.length);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  return new TextDecoder().decode(plainBuf);
}
