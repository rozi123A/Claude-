import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Only attempt cookie-based session auth if OAUTH is configured
    // This app primarily uses Telegram WebApp auth (via verifyTelegramWebApp)
    if (ENV.oAuthServerUrl) {
      user = await sdk.authenticateRequest(opts.req);
    }
  } catch {
    // Authentication is optional for public procedures.
    // Most endpoints use Telegram WebApp auth instead
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
