import { createBackendClient } from './brain-backend/client.js';
import type { CompanyBrainRecord } from './company-brain-record.js';

// The sink is a BatchWriter `afterSave` hook: it tells the brain service which
// records Nango just persisted (by their ids, within this connection + model), so
// the backend can read them back from `nango_records` and copy them into
// `brain.records`. We only send identifiers — the record bodies stay in Nango.
type BrainSinkNango = Parameters<typeof createBackendClient>[0] & {
  providerConfigKey: string;
  nangoConnectionId?: number | undefined;
};

export function createBrainSink(nango: BrainSinkNango) {
  const client = createBackendClient(nango);

  return async (records: readonly CompanyBrainRecord[], model: string): Promise<void> => {
    if (records.length === 0) {
      return;
    }

    if (nango.nangoConnectionId === undefined) {
      throw new Error('brain batch-save requires nangoConnectionId');
    }

    const { error } = await client('/webhooks/batch-save', {
      method: 'POST',
      body: {
        data_source_id: nango.providerConfigKey,
        connection_id: nango.nangoConnectionId,
        model,
        ids: records.map((record) => record.id),
      },
    });

    if (error) {
      throw new Error(`brain batch-save failed: ${JSON.stringify(error.value)}`);
    }
  };
}
