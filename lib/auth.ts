import "server-only";
// Shared by the request proxy and server handlers. Never import into client components.
export const cookieName = process.env.NODE_ENV === "production" ? "__Host-amt_admin" : "amt_admin_dev";
export const lifetime = 8 * 60 * 60;
export function config() {
  const { ADMIN_PASSWORD: password, SESSION_SECRET: secret, APP_ORIGIN: origin,
    AUTH_REDIS_REST_URL: redis, AUTH_REDIS_REST_TOKEN: token } = process.env;
  if (!password || password.length < 20 || password.length > 1024 || !secret || secret.length < 32 || !origin || !redis || !token) throw new Error("Authentication is not configured");
  const url = new URL(origin);
  if (url.origin !== origin || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("Invalid APP_ORIGIN");
  if (url.username || url.password || (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Invalid APP_ORIGIN");
  if (new URL(redis).protocol !== "https:") throw new Error("Redis requires HTTPS");
  return { password, secret, origin, redis, token };
}
export async function redisCommand(command: (string | number)[]) {
  const c = config();
  const response = await fetch(c.redis, { method: "POST", headers: {
    Authorization: `Bearer ${c.token}`, "Content-Type": "application/json"
  }, body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Authentication store unavailable");
  const body = await response.json();
  if (body.error) throw new Error("Authentication store unavailable");
  return body.result;
}
export async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}
async function sessionKey(token: string) {
  const c = config();
  return `amt:session:${await digest(c.secret + ":" + c.password + ":" + token)}`;
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
}
export async function validSession(token?: string) {
  config();
  return Boolean(token && /^[a-f0-9]{64}$/.test(token) && await redisCommand(["GET", await sessionKey(token)]) === "1");
}
export async function createSession() {
  const token = randomToken();
  await redisCommand(["SET", await sessionKey(token), "1", "EX", lifetime]);
  return token;
}
export async function deleteSession(token?: string) {
  if (token && /^[a-f0-9]{64}$/.test(token)) await redisCommand(["DEL", await sessionKey(token)]);
}
export async function allowAttempt() {
  // Global shared counter: cannot be bypassed by spoofing forwarded IPs or adding instances.
  const key = `amt:login:${await digest(config().secret)}`;
  const count = await redisCommand(["EVAL", "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n", 1, key]);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Invalid rate limit response");
  return count <= 30;
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === config().origin && !["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? "");
}
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: lifetime };
