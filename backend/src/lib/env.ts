declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL?: string;
      readonly PORT?: string;
      readonly BRAIN_API_KEY?: string;
      readonly BRAIN_SESSION_SECRET?: string;
    }
  }
}

const DEFAULT_PORT = 3010;

type Env = {
  databaseUrl: string;
  port: number;
  brainApiKey: string;
  brainSessionSecret: string;
};

function loadEnv(): Env {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  const brainApiKey = process.env.BRAIN_API_KEY;
  if (!brainApiKey) {
    throw new Error('Missing required environment variable: BRAIN_API_KEY');
  }

  return {
    databaseUrl,
    port: process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT,
    brainApiKey,
    brainSessionSecret: process.env.BRAIN_SESSION_SECRET ?? brainApiKey,
  };
}

export const env = loadEnv();
