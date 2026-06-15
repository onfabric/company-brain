import type { App } from '@company-brain/backend/types';
import { treaty } from '@elysiajs/eden';

const HTTP_UNAUTHORIZED = 401;

export type BrainClientConfig = {
  domain: string;
  treatyOptions?: Parameters<typeof treaty>[1];
  onUnauthorized?: () => void;
  unauthorizedMessage?: string;
};

export class BrainApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type EdenResult = {
  data: unknown;
  error: { status: number; value: unknown } | null;
  status: number;
};

type EdenData<R extends EdenResult> = R extends { error: null } ? R['data'] : never;

export function createBrainClient(config: BrainClientConfig) {
  const brain = treaty<App>(config.domain, config.treatyOptions);

  function unwrap<R extends EdenResult>(result: R): EdenData<R> {
    if (result.error) {
      if (result.status === HTTP_UNAUTHORIZED) {
        config.onUnauthorized?.();
      }
      throw new BrainApiError(
        errorMessage(config, result.status, result.error.value),
        result.status,
      );
    }
    return result.data as EdenData<R>;
  }

  return { brain, unwrap };
}

function errorMessage(config: BrainClientConfig, status: number, value: unknown) {
  if (status === HTTP_UNAUTHORIZED && config.unauthorizedMessage) {
    return config.unauthorizedMessage;
  }
  const detail = messageDetail(value);
  return detail ? `Brain API ${status}: ${detail}` : `Brain API ${status}: request failed.`;
}

function messageDetail(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  return value == null ? '' : JSON.stringify(value);
}
