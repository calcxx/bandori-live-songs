export const adminAuthCookieName = "bdr-admin-auth";
export const adminAuthCookieMaxAgeSeconds = 60 * 60 * 24 * 30;

const tokenVersion = "v1";
const tokenPayload = "bdr-events-to-songs:admin-auth:v1";

function getExpectedAdminKey() {
  return (process.env.SETLIST_IMPORT_KEY ?? "").trim();
}

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function signAdminAuthToken(secret: string) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(tokenPayload));

  return toHex(signature);
}

export function isAdminKeyConfigured(expectedKey = getExpectedAdminKey()) {
  return expectedKey.length > 0;
}

export function isValidAdminKey(input: string, expectedKey = getExpectedAdminKey()) {
  const submittedKey = input.trim();
  return isAdminKeyConfigured(expectedKey) && constantTimeEqual(submittedKey, expectedKey);
}

export async function buildAdminAuthToken(secret = getExpectedAdminKey()) {
  if (!isAdminKeyConfigured(secret)) {
    return "";
  }

  return `${tokenVersion}.${await signAdminAuthToken(secret)}`;
}

export async function verifyAdminAuthToken(token: string | undefined, secret = getExpectedAdminKey()) {
  if (!token || !isAdminKeyConfigured(secret)) {
    return false;
  }

  const expectedToken = await buildAdminAuthToken(secret);
  return constantTimeEqual(token, expectedToken);
}

export function normalizeAdminNextPath(value: string | null | undefined) {
  if (!value) {
    return "/admin";
  }

  let url: URL;
  try {
    url = new URL(value, "https://bdrsongs.local");
  } catch {
    return "/admin";
  }

  if (url.origin !== "https://bdrsongs.local") {
    return "/admin";
  }

  if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) {
    return "/admin";
  }

  return `${url.pathname}${url.search}`;
}
