#!/usr/bin/env node
/**
 * Builds the HNSW vector index on document_chunks.
 * Runs directly via Postgres connection with no timeout.
 * Takes a few minutes on ~100k rows — safe to leave running.
 */

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log('Connected. Checking current indexes...');

    const { rows: existing } = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'document_chunks' AND indexdef LIKE '%hnsw%'
    `);

    if (existing.length > 0) {
      console.log('HNSW index already exists:', existing.map(r => r.indexname).join(', '));
      console.log('Nothing to do.');
      return;
    }

    const { rows: countRow } = await client.query(
      'SELECT COUNT(*) AS n FROM document_chunks'
    );
    const rowCount = parseInt(countRow[0].n, 10);
    console.log(`Rows in document_chunks: ${rowCount.toLocaleString()}`);
    console.log('Building HNSW index (m=16, ef_construction=64)...');
    console.log('This will take several minutes. Do not interrupt.\n');

    // Disable statement timeout for this session
    await client.query('SET statement_timeout = 0');
    await client.query('SET lock_timeout = 0');

    const start = Date.now();
    await client.query(`
      CREATE INDEX document_chunks_embedding_idx
      ON document_chunks USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);

    console.log(`\nHNSW index built successfully in ${elapsed} minutes.`);
    console.log('Vector search is now using the index (fast approximate nearest-neighbor).');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
