import { error, text } from 'mcp-use/server';
import { AppError } from '#lib/errors.ts';
import { createLogger } from '#lib/logger.ts';

const logger = createLogger('knowledgeMcpServer');

export async function readPage(read: () => Promise<string>) {
  try {
    return text(await read());
  } catch (err) {
    if (err instanceof AppError) {
      return error(err.message);
    }
    logger.error('failed to read knowledge page', err);
    return error('Failed to read the knowledge page');
  }
}

export async function readJson(read: () => Promise<unknown>) {
  try {
    return text(JSON.stringify(await read(), null, 2));
  } catch (err) {
    if (err instanceof AppError) {
      return error(err.message);
    }
    logger.error('failed to read MCP data', err);
    return error('Failed to read MCP data');
  }
}
