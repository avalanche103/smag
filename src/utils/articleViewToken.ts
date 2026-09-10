import crypto from "node:crypto";
import { env } from "../config/env";

const TOKEN_TTL_MS = 20 * 60 * 1000;

export function createArticleViewToken(articleId: number): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${articleId}.${exp}`;
  const sig = crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyArticleViewToken(articleId: number, token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!expRaw || !sig || !Number.isFinite(exp) || Date.now() > exp) {
    return false;
  }

  const payload = `${articleId}.${exp}`;
  const expected = crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
  if (expected.length !== sig.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
