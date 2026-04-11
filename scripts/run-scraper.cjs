#!/usr/bin/env node
/**
 * Standalone scraper script — run from your laptop.
 * Downloads ZIP archives from Backblaze, extracts DOCX/PDF,
 * generates embeddings via OpenAI, stores in Supabase pgvector.
 *
 * Usage:
 *   node scripts/run-scraper.cjs                    # Scrape 2020-2025
 *   node scripts/run-scraper.cjs 2025               # Single year
 *   node scripts/run-scraper.cjs 2023 2024 2025     # Specific years
 *
 * Estimated time: ~2-5 min per file (mostly OpenAI API latency)
 * Estimated cost: ~$3.65 for all 6 years (text-embedding-3-small)
 *
 * Safe to interrupt (Ctrl+C) — already-indexed files are skipped on restart.
 *
 * Requires DATABASE_URL env var (direct Postgres connection string).
 * Get it from: Supabase Dashboard → Settings → Database → Connection string (URI)
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const OpenAI = require('openai').default;
const mammoth = require('mammoth');

// Validate env
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'DATABASE_URL']) {
  if (!process.env[key]) {
    if (key === 'DATABASE_URL') {
      console.error('Missing DATABASE_URL env var.');
      console.error('Get it from: Supabase Dashboard → Settings → Database → Connection string (URI)');
      console.error('Add it to .env.local: DATABASE_URL=postgresql://postgres.[ref]:[password]@...:5432/postgres');
    } else {
      console.error(`Missing env var: ${key}`);
    }
    process.exit(1);
  }
}

// Supabase REST client (for reads + document record management)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Direct Postgres connection (for chunk inserts — bypasses PostgREST timeout)
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  statement_timeout: 120000, // 120 seconds — plenty for batch inserts
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ZIP_BASE_URL = 'https://caselist-files.s3.us-east-005.backblazeb2.com/openev';
const CHUNK_SIZE = 3200;
const CHUNK_OVERLAP = 800;
const EMBEDDING_BATCH_SIZE = 50;
const DB_INSERT_BATCH_SIZE = 20; // Safe with direct PG connection

// ---- Chunking ----
function chunkText(text, fileName) {
  const chunks = [];
  const lines = text.split('\n');
  let currentSection;
  let currentText = '';
  let chunkIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 120 &&
        (trimmed === trimmed.toUpperCase() || /^\d+[.)]\s/.test(trimmed))) {
      currentSection = trimmed;
    }
    currentText += line + '\n';

    if (currentText.length >= CHUNK_SIZE) {
      const bp = findBreakPoint(currentText, CHUNK_SIZE);
      const content = currentText.slice(0, bp).trim();
      if (content.length > 50) {
        const prefix = `[Source: ${fileName}${currentSection ? `, Section: ${currentSection}` : ''}]`;
        chunks.push({ content: `${prefix}\n\n${content}`, sectionTitle: currentSection, chunkIndex: chunkIndex++ });
      }
      currentText = currentText.slice(Math.max(0, bp - CHUNK_OVERLAP));
    }
  }

  if (currentText.trim().length > 50) {
    const prefix = `[Source: ${fileName}${currentSection ? `, Section: ${currentSection}` : ''}]`;
    chunks.push({ content: `${prefix}\n\n${currentText.trim()}`, sectionTitle: currentSection, chunkIndex: chunkIndex });
  }

  return chunks;
}

function findBreakPoint(text, target) {
  const start = Math.max(0, target - 500);
  const end = Math.min(text.length, target + 200);
  const range = text.slice(start, end);
  const sent = range.lastIndexOf('. ');
  if (sent !== -1) return start + sent + 2;
  const nl = range.lastIndexOf('\n');
  if (nl !== -1) return start + nl + 1;
  return target;
}

// ---- Embeddings ----
async function generateEmbeddings(texts) {
  const all = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: batch });
    for (const item of resp.data) all.push(item.embedding);
  }
  return all;
}

// ---- Index a document (uses direct PG connection) ----
async function indexDocument(docId, text, fileName) {
  const chunks = chunkText(text, fileName);
  if (chunks.length === 0) return 0;

  const embeddings = await generateEmbeddings(chunks.map(c => c.content));

  const client = await pgPool.connect();
  try {
    for (let i = 0; i < chunks.length; i += DB_INSERT_BATCH_SIZE) {
      const batch = chunks.slice(i, i + DB_INSERT_BATCH_SIZE);
      const batchEmb = embeddings.slice(i, i + DB_INSERT_BATCH_SIZE);

      // Build parameterized multi-row INSERT
      const values = [];
      const params = [];
      let idx = 1;

      for (let j = 0; j < batch.length; j++) {
        values.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}::vector, $${idx+5}::jsonb)`);
        params.push(
          docId,
          batch[j].chunkIndex,
          batch[j].content,
          batch[j].sectionTitle || null,
          `[${batchEmb[j].join(',')}]`,  // pgvector literal format
          JSON.stringify({})
        );
        idx += 6;
      }

      await client.query(
        `INSERT INTO document_chunks (document_id, chunk_index, content, section_title, embedding, metadata)
         VALUES ${values.join(', ')}`,
        params
      );
    }
  } finally {
    client.release();
  }

  // Update indexed_at via Supabase REST (small update, no timeout risk)
  await supabase.from('documents').update({ indexed_at: new Date().toISOString() }).eq('id', docId);
  return chunks.length;
}

// ---- Metadata ----
function extractMetadata(fileName, filePath, year) {
  const metadata = { year };
  const campPatterns = [
    [/DDI|DDW/i, 'DDI/DDW'], [/Michigan|UMICH|UM7/i, 'Michigan'],
    [/Northwestern/i, 'Northwestern'], [/Berkeley/i, 'Berkeley'],
    [/Emory/i, 'Emory'], [/Georgetown/i, 'Georgetown'],
    [/Wake\s*Forest/i, 'Wake Forest'], [/Gonzaga/i, 'Gonzaga'],
    [/CNDI/i, 'CNDI'], [/GDI/i, 'GDI'], [/SDI/i, 'SDI'],
  ];
  for (const [pattern, name] of campPatterns) {
    if (pattern.test(filePath) || pattern.test(fileName)) { metadata.camp = name; break; }
  }
  metadata.title = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  return metadata;
}

// ---- Parse unzip -l output ----
function parseUnzipList(output) {
  const files = [];
  for (const line of output.split('\n')) {
    const m = line.trim().match(/\d+\s+\d{2}-\d{2}-\d{2,4}\s+\d{2}:\d{2}\s+(.+)$/);
    if (!m) continue;
    const fp = m[1];
    const ext = path.extname(fp).toLowerCase();
    if ((ext === '.docx' || ext === '.pdf') && !fp.startsWith('__MACOSX') && !path.basename(fp).startsWith('.')) {
      files.push(fp);
    }
  }
  return files;
}

// ---- Process one year ----
async function scrapeYear(year) {
  const zipUrl = `${ZIP_BASE_URL}/${year}OpenEv.zip`;
  const tmpDir = path.join(os.tmpdir(), `eris-scrape-${year}-${Date.now()}`);
  const zipPath = path.join(tmpDir, `${year}OpenEv.zip`);
  let indexed = 0, skipped = 0, failed = 0;

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    console.log(`\n  Downloading ${year} ZIP...`);
    const resp = await fetch(zipUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    fs.writeFileSync(zipPath, Buffer.from(await resp.arrayBuffer()));
    console.log(`  Downloaded: ${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(1)} MB`);

    const listOutput = execSync(`unzip -l "${zipPath}" 2>/dev/null`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const entries = parseUnzipList(listOutput);
    const total = entries.length;
    console.log(`  Files: ${total}`);

    const extractDir = path.join(tmpDir, 'out');
    fs.mkdirSync(extractDir, { recursive: true });

    for (let i = 0; i < entries.length; i++) {
      const entryPath = entries[i];
      const fileName = path.basename(entryPath);
      const progress = `[${i + 1}/${total}]`;

      try {
        // Skip if already indexed
        const { data: existing } = await supabase
          .from('documents').select('id')
          .eq('file_name', fileName).eq('source_type', 'opencaselist').limit(1);
        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        // Extract single file
        try {
          execSync(`unzip -o -j "${zipPath}" "${entryPath}" -d "${extractDir}" 2>/dev/null`, { maxBuffer: 50 * 1024 * 1024 });
        } catch { failed++; continue; }

        const extractedPath = path.join(extractDir, fileName);
        if (!fs.existsSync(extractedPath)) { failed++; continue; }

        const fileBuffer = fs.readFileSync(extractedPath);
        const ext = path.extname(fileName).toLowerCase();
        let text = '';

        if (ext === '.docx') {
          text = (await mammoth.extractRawText({ buffer: fileBuffer })).value;
        } else if (ext === '.pdf') {
          const pdfParse = await import('pdf-parse').then(m => m.default || m);
          text = (await pdfParse(fileBuffer)).text;
        }

        // Clean up extracted file immediately
        try { fs.unlinkSync(extractedPath); } catch {}

        if (text.trim().length < 100) { skipped++; continue; }

        const metadata = extractMetadata(fileName, entryPath, year);

        const { data: doc, error: docErr } = await supabase.from('documents').insert({
          title: metadata.title || fileName,
          file_name: fileName, file_url: '',
          file_size: fileBuffer.length, source_url: zipUrl,
          source_type: 'opencaselist', content: text.substring(0, 5000), metadata,
        }).select().single();
        if (docErr) throw docErr;

        const numChunks = await indexDocument(doc.id, text, fileName);
        indexed++;
        console.log(`  ${progress} ✓ ${fileName} (${text.length} chars, ${numChunks} chunks)`);

      } catch (err) {
        failed++;
        console.error(`  ${progress} ✗ ${fileName}: ${err.message || err}`);
      }
    }

    return { total, indexed, skipped, failed };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ---- Repair incomplete documents ----
async function repairIncomplete() {
  console.log('\n  Checking for incomplete documents (failed chunk inserts)...');

  const { data: incomplete, error } = await supabase
    .from('documents')
    .select('id, file_name')
    .eq('source_type', 'opencaselist')
    .is('indexed_at', null);

  if (error) {
    console.error('  Could not check for incomplete docs:', error.message);
    return 0;
  }

  if (!incomplete || incomplete.length === 0) {
    console.log('  No incomplete documents found.');
    return 0;
  }

  console.log(`  Found ${incomplete.length} incomplete documents. Cleaning up...`);

  // Use direct PG for faster bulk delete
  const client = await pgPool.connect();
  try {
    for (const doc of incomplete) {
      await client.query('DELETE FROM document_chunks WHERE document_id = $1', [doc.id]);
      await client.query('DELETE FROM documents WHERE id = $1', [doc.id]);
      console.log(`    Cleaned: ${doc.file_name}`);
    }
  } finally {
    client.release();
  }

  console.log(`  Repaired ${incomplete.length} documents. They will be re-processed.\n`);
  return incomplete.length;
}

// ---- Main ----
async function main() {
  const args = process.argv.slice(2);
  const years = args.length > 0
    ? args.map(Number).filter(n => n >= 2013 && n <= 2030)
    : [2025, 2024, 2023, 2022, 2021, 2020];

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Eris Debate — OpenCaseList Scraper          ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Years: ${years.join(', ')}`);
  console.log(`Embedding model: text-embedding-3-small`);
  console.log(`DB: direct Postgres connection (120s timeout)`);
  console.log(`Safe to Ctrl+C — progress is saved, skips already-indexed files.\n`);

  // Verify PG connection works
  try {
    const res = await pgPool.query('SELECT 1 as ok');
    if (res.rows[0].ok === 1) console.log('  ✓ Database connection verified');
  } catch (err) {
    console.error(`  ✗ Database connection failed: ${err.message}`);
    console.error('  Check your DATABASE_URL in .env.local');
    process.exit(1);
  }

  // Repair any incomplete documents from previous failed runs
  await repairIncomplete();

  const startTime = Date.now();
  let grandTotal = 0, grandIndexed = 0, grandSkipped = 0, grandFailed = 0;

  for (const year of years) {
    console.log(`\n━━━ ${year} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    try {
      const result = await scrapeYear(year);
      grandTotal += result.total;
      grandIndexed += result.indexed;
      grandSkipped += result.skipped;
      grandFailed += result.failed;
      console.log(`  Year ${year} done: ${result.indexed} indexed, ${result.skipped} skipped, ${result.failed} failed`);
    } catch (err) {
      console.error(`  Year ${year} FAILED: ${err.message || err}`);
    }
  }

  // Close PG pool
  await pgPool.end();

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  COMPLETE                                    ║`);
  console.log(`╚══════════════════════════════════════════════╝`);
  console.log(`Total files:  ${grandTotal}`);
  console.log(`Indexed:      ${grandIndexed}`);
  console.log(`Skipped:      ${grandSkipped}`);
  console.log(`Failed:       ${grandFailed}`);
  console.log(`Time:         ${elapsed} minutes`);
  console.log(`Memory:       ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0)} MB`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
