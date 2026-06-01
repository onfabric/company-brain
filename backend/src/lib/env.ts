declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL?: string;
      readonly PORT?: string;
    }
  }
}

const DEFAULT_PORT = 3010;

type Env = {
  databaseUrl: string;
  port: number;
};

function loadEnv(): Env {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  return {
    databaseUrl,
    port: process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT,
  };
}

export const env = loadEnv();
