import mammoth from 'mammoth';
import { supabaseAdmin as supabase } from '@/server/lib/supabaseAdmin';
import { EnhancedIndexingService } from './enhancedIndexingService';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync } from 'child_process';

const ZIP_BASE_URL = 'https://caselist-files.s3.us-east-005.backblazeb2.com/openev';

export interface ScrapeResult {
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
}

export class OpenCaseListScraper {
  private indexingService: EnhancedIndexingService;

  constructor() {
    this.indexingService = new EnhancedIndexingService();
  }

  async scrapeYears(years: number[]): Promise<ScrapeResult> {
    let total = 0;
    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (const year of years) {
      try {
        const result = await this.scrapeYear(year);
        total += result.total;
        indexed += result.indexed;
        skipped += result.skipped;
        failed += result.failed;
      } catch (_error) {
        await this.logScrape(
          `${ZIP_BASE_URL}/${year}OpenEv.zip`,
          'failed',
          undefined,
          _error instanceof Error ? _error.message : 'Unknown error'
        );
      }
    }

    return { total, indexed, skipped, failed };
  }

  private async scrapeYear(year: number): Promise<ScrapeResult> {
    const zipUrl = `${ZIP_BASE_URL}/${year}OpenEv.zip`;
    const tmpDir = path.join(os.tmpdir(), `eris-scrape-${year}-${Date.now()}`);
    const zipPath = path.join(tmpDir, `${year}OpenEv.zip`);
    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    try {
      // Create temp directory
      fs.mkdirSync(tmpDir, { recursive: true });

      // Download ZIP to disk using streaming
      const response = await fetch(zipUrl);
      if (!response.ok) {
        throw new Error(`Failed to download ZIP for ${year}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));

      // List files in ZIP using unzip -l
      const listOutput = execFileSync('unzip', ['-l', zipPath], {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const fileEntries = this.parseUnzipList(listOutput);

      const total = fileEntries.length;

      // Process files one at a time
      const extractDir = path.join(tmpDir, 'extracted');
      fs.mkdirSync(extractDir, { recursive: true });
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per extracted file
      const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2GB total per year
      let totalExtractedSize = 0;

      for (const entryPath of fileEntries) {
        try {
          const fileName = path.basename(entryPath);

          // Check if already processed
          const { data: existing } = await supabase
            .from('documents')
            .select('id')
            .eq('file_name', fileName)
            .eq('source_type', 'opencaselist')
            .limit(1);

          if (existing && existing.length > 0) {
            skipped++;
            continue;
          }

          // Extract single file to disk
          try {
            execFileSync('unzip', ['-o', '-j', zipPath, entryPath, '-d', extractDir], {
              encoding: 'utf-8',
              maxBuffer: 50 * 1024 * 1024,
              stdio: ['pipe', 'pipe', 'ignore'],
            });
          } catch {
            failed++;
            continue;
          }

          const extractedPath = path.join(extractDir, fileName);
          if (!fs.existsSync(extractedPath)) {
            failed++;
            continue;
          }

          // Zip bomb protection: check extracted file size
          const fileStats = fs.statSync(extractedPath);
          if (fileStats.size > MAX_FILE_SIZE) {
            fs.unlinkSync(extractedPath);
            failed++;
            continue;
          }
          totalExtractedSize += fileStats.size;
          if (totalExtractedSize > MAX_TOTAL_SIZE) {
            fs.unlinkSync(extractedPath);
            throw new Error('Total extracted size exceeds safety limit');
          }

          // Read file and extract text
          const fileBuffer = fs.readFileSync(extractedPath);
          const ext = path.extname(fileName).toLowerCase();
          let text = '';

          if (ext === '.docx') {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            text = result.value;
          } else if (ext === '.pdf') {
            const pdfParse = await import('pdf-parse').then((m) => m.default || m);
            const pdfData = await pdfParse(fileBuffer);
            text = pdfData.text;
          }

          // Clean up extracted file immediately
          fs.unlinkSync(extractedPath);

          if (text.trim().length < 100) {
            skipped++;
            continue;
          }

          const metadata = this.extractMetadata(fileName, entryPath, year);

          // Create document record
          const { data: doc, error: docError } = await supabase
            .from('documents')
            .insert({
              title: (metadata.title as string) || fileName,
              file_name: fileName,
              file_url: '',
              file_size: fileBuffer.length,
              source_url: zipUrl,
              source_type: 'opencaselist',
              content: text.substring(0, 5000),
              metadata,
            })
            .select()
            .single();

          if (docError) throw docError;

          // Index: chunk + embed + store
          await this.indexingService.indexDocument(doc.id, text, fileName);

          await this.logScrape(`${zipUrl}#${entryPath}`, 'completed', doc.id);

          indexed++;
        } catch (_error) {
          failed++;
          await this.logScrape(
            `${ZIP_BASE_URL}/${year}#${entryPath}`,
            'failed',
            undefined,
            _error instanceof Error ? _error.message : 'Unknown error'
          );
        }
      }

      return { total, indexed, skipped, failed };
    } finally {
      // Clean up temp directory
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup
      }
    }
  }

  private parseUnzipList(output: string): string[] {
    const files: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // unzip -l format: "  length  date  time  name"
      // Match lines that end with .docx or .pdf
      const match = trimmed.match(/\d+\s+\d{2}-\d{2}-\d{2,4}\s+\d{2}:\d{2}\s+(.+)$/);
      if (!match) continue;

      const filePath = match[1];
      const ext = path.extname(filePath).toLowerCase();

      if (
        (ext === '.docx' || ext === '.pdf') &&
        !filePath.startsWith('__MACOSX') &&
        !path.basename(filePath).startsWith('.')
      ) {
        files.push(filePath);
      }
    }

    return files;
  }

  private extractMetadata(
    fileName: string,
    filePath: string,
    year: number
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = { year };

    const campPatterns: Array<[RegExp, string]> = [
      [/DDI|DDW/i, 'DDI/DDW'],
      [/Michigan|UMICH|UM7/i, 'Michigan'],
      [/Northwestern/i, 'Northwestern'],
      [/Berkeley/i, 'Berkeley'],
      [/Emory/i, 'Emory'],
      [/Georgetown/i, 'Georgetown'],
      [/Wake\s*Forest/i, 'Wake Forest'],
      [/Gonzaga/i, 'Gonzaga'],
      [/CNDI/i, 'CNDI'],
      [/GDI/i, 'GDI'],
      [/SDI/i, 'SDI'],
    ];

    for (const [pattern, name] of campPatterns) {
      if (pattern.test(filePath) || pattern.test(fileName)) {
        metadata.camp = name;
        break;
      }
    }

    metadata.title = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return metadata;
  }

  private async logScrape(
    url: string,
    status: string,
    documentId?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabase.from('opencaselist_scrape_log').insert({
        url,
        status,
        document_id: documentId,
        error_message: errorMessage,
        attempted_at: new Date().toISOString(),
        completed_at: status === 'completed' ? new Date().toISOString() : undefined,
      });
    } catch {
      // Non-critical
    }
  }

  async getScrapingStatus(): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
  }> {
    const { data } = await supabase.from('opencaselist_scrape_log').select('status');

    if (!data) return { total: 0, completed: 0, failed: 0, pending: 0 };

    return {
      total: data.length,
      completed: data.filter((d) => d.status === 'completed').length,
      failed: data.filter((d) => d.status === 'failed').length,
      pending: data.filter((d) => d.status === 'pending' || d.status === 'processing').length,
    };
  }
}
