import type { Records } from '#db/tables.ts';
import { Repository } from '#repositories/repository.ts';

export type IngestBatch = {
  dataSourceId: string;
  connectionId: number;
  model: string;
  externalIds: string[];
};

export abstract class RecordsRepositoryContract {
  abstract ingestBatch(batch: IngestBatch): Promise<number>;
}

export class RecordsRepository extends Repository implements RecordsRepositoryContract {
  async ingestBatch(batch: IngestBatch): Promise<number> {
    if (batch.externalIds.length === 0) {
      return 0;
    }

    const rows = await this.sql<Pick<Records, 'id'>[]>`
      WITH source AS (
        SELECT
          r.connection_id,
          r.model,
          r.id,
          rd.data
        FROM nango_records.records r
        JOIN nango_records.records_data rd
          ON rd.connection_id = r.connection_id
          AND rd.model = r.model
          AND rd.id = r.id
        WHERE r.connection_id = ${batch.connectionId}
          AND r.model = ${batch.model}
          AND r.external_id IN ${this.sql(batch.externalIds)}
          AND r.deleted_at IS NULL
      )
      INSERT INTO brain.records (
        created_at,
        updated_at,
        data_source_id,
        nango_connection_id,
        nango_model,
        nango_id,
        body
      )
      SELECT
        (data->>'created_at')::timestamptz,
        COALESCE((data->>'updated_at')::timestamptz, (data->>'created_at')::timestamptz),
        ${batch.dataSourceId},
        connection_id,
        model,
        id,
        data->>'body'
      FROM source
      WHERE data ? 'body'
        AND data ? 'created_at'
      ON CONFLICT (nango_connection_id, nango_model, nango_id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        data_source_id = EXCLUDED.data_source_id,
        body = EXCLUDED.body
      RETURNING id
    `;

    return rows.length;
  }
}
