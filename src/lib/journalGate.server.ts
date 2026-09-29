import { createHmac, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "journal_access";
const SALT = "48b8813b429c40a66750655dc3d3d032";
const PASSWORD_HASH = "1e2c47f02dacd3ed6eac3e57ad8f99f86d78eefafb29a34367b9f3a6fbd5d29f";
const SCRYPT_KEYLEN = 32;
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30;

function hashPassword(password: string) {
  return scryptSync(password, SALT, SCRYPT_KEYLEN, { N: 16384, r: 8, p: 1 });
}

function accessToken() {
  return createHmac("sha256", PASSWORD_HASH).update("journal-unlocked").digest("hex");
}

export function passwordMatches(password: string) {
  const actual = hashPassword(password);
  const expected = Buffer.from(PASSWORD_HASH, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function tokenMatches(value: string | undefined) {
  if (!value) return false;
  const expected = accessToken();
  const actual = Buffer.from(value);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

export async function isJournalUnlocked() {
  const jar = await cookies();
  return tokenMatches(jar.get(COOKIE_NAME)?.value);
}

export async function grantJournalAccess() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, accessToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/journal",
    maxAge: COOKIE_MAX_AGE_S,
  });
}

export function safeJournalPath(value: string) {
  if (!value.startsWith("/journal")) return "/journal";
  if (value.startsWith("//") || value.includes("\\") || value.includes("://")) return "/journal";
  return value;
}
