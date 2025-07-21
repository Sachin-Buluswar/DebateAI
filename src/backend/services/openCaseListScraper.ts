import puppeteer, { type Page } from 'puppeteer';
import { DocumentStorageService } from './documentStorageService';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class OpenCaseListScraper {
  private documentStorage: DocumentStorageService;
  private email: string;
  private password: string;
  private baseUrl = 'https://opencaselist.com';
  
  constructor() {
    this.documentStorage = new DocumentStorageService();
    
    // Get credentials from environment variables
    this.email = process.env.OPENCASELIST_EMAIL || '';
    this.password = process.env.OPENCASELIST_PASSWORD || '';
    
    if (!this.email || !this.password) {
      throw new Error('OpenCaseList credentials not configured. Please set OPENCASELIST_EMAIL and OPENCASELIST_PASSWORD environment variables.');
    }
  }

  async scrapeWikiFiles(): Promise<void> {
    let browser;
    
    try {
      console.log('Starting OpenCaseList scraping...');
      
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Login
      await this.login(page);
      
      // Navigate to OpenEv wiki section
      await page.goto(`${this.baseUrl}/openev`, { waitUntil: 'networkidle2' });
      
      // Get all wiki file links
      const wikiLinks = await this.extractWikiLinks(page);
      console.log(`Found ${wikiLinks.length} wiki files to scrape`);
      
      // Process each wiki file
      for (const link of wikiLinks) {
        await this.processWikiFile(page, link);
      }
      
    } catch (error) {
      console.error('Scraping error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async login(page: Page): Promise<void> {
    console.log('Logging in to OpenCaseList...');
    
    // Go to login page
    await page.goto(`${this.baseUrl}/login`, { waitUntil: 'networkidle2' });
    
    // Fill in credentials
    await page.type('input[name="email"]', this.email);
    await page.type('input[name="password"]', this.password);
    
    // Submit form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"]')
    ]);
    
    console.log('Login successful');
  }

  private async extractWikiLinks(page: Page): Promise<string[]> {
    return await page.evaluate(() => {
      const links: string[] = [];
      const linkElements = document.querySelectorAll('a[href*="/openev/"]');
      
      linkElements.forEach(el => {
        const href = el.getAttribute('href');
        if (href && (href.includes('.pdf') || href.includes('.doc') || href.includes('.docx'))) {
          links.push(href);
        }
      });
      
      return links;
    });
  }

  private async processWikiFile(page: Page, fileLink: string): Promise<void> {
    try {
      const fullUrl = fileLink.startsWith('http') ? fileLink : `${this.baseUrl}${fileLink}`;
      const fileName = path.basename(fileLink);
      
      console.log(`Processing: ${fileName}`);
      
      // Check if already processed
      const { data: existingLog } = await supabase
        .from('opencaselist_scrape_log')
        .select()
        .eq('url', fullUrl)
        .eq('status', 'completed')
        .single();
      
      if (existingLog) {
        console.log(`Skipping ${fileName} - already processed`);
        return;
      }
      
      // Create scrape log entry
      const { data: scrapeLog } = await supabase
        .from('opencaselist_scrape_log')
        .insert({
          url: fullUrl,
          status: 'processing',
          attempted_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (!scrapeLog) throw new Error('Failed to create scrape log');
      
      // Download file
      const fileBuffer = await this.downloadFile(page, fullUrl);
      
      // Upload to Supabase Storage
      const { url: storageUrl, path: storagePath } = await this.documentStorage.uploadPDF(
        fileBuffer,
        fileName
      );
      
      // Extract metadata from filename/path
      const metadata = this.extractMetadata(fileName, fileLink);
      
      // Create document record
      const document = await this.documentStorage.createDocument(
        metadata.title || fileName,
        fileName,
        storageUrl,
        fileBuffer.length,
        undefined, // Page count will be determined during indexing
        fullUrl,
        'opencaselist',
        metadata
      );
      
      // Update scrape log
      await supabase
        .from('opencaselist_scrape_log')
        .update({
          status: 'completed',
          document_id: document.id,
          completed_at: new Date().toISOString()
        })
        .eq('id', scrapeLog.id);
      
      console.log(`Successfully processed: ${fileName}`);
      
    } catch (error) {
      console.error(`Error processing ${fileLink}:`, error);
      
      // Log failure
      await supabase
        .from('opencaselist_scrape_log')
        .insert({
          url: fileLink,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          attempted_at: new Date().toISOString()
        });
    }
  }

  private async downloadFile(page: Page, url: string): Promise<Buffer> {
    // Get cookies from puppeteer
    const cookies = await page.cookies();
    const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
    
    // Download file using fetch with cookies
    const response = await fetch(url, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    return buffer;
  }

  private extractMetadata(fileName: string, filePath: string): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Extract year from path if present
    const yearMatch = filePath.match(/20\d{2}/);
    if (yearMatch) {
      metadata.year = yearMatch[0];
    }
    
    // Extract camp name if present
    const campPatterns = [
      /DDI|DDW/i,
      /Michigan/i,
      /Northwestern/i,
      /Berkeley/i,
      /Emory/i,
      /Georgetown/i,
      /Wake Forest/i
    ];
    
    for (const pattern of campPatterns) {
      if (pattern.test(filePath) || pattern.test(fileName)) {
        metadata.camp = pattern.source.replace(/[/\\]/g, '');
        break;
      }
    }
    
    // Extract topic from filename
    const topicPatterns = {
      'Immigration': /immigr/i,
      'Space': /space/i,
      'Arms Sales': /arms?\s*sales?/i,
      'Climate': /climate/i,
      'Energy': /energy/i,
      'NATO': /nato/i,
      'China': /china/i,
      'Russia': /russia/i
    };
    
    for (const [topic, pattern] of Object.entries(topicPatterns)) {
      if (pattern.test(fileName)) {
        metadata.topic = topic;
        break;
      }
    }
    
    // Clean title from filename
    metadata.title = fileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    return metadata;
  }

  async getScrapingStatus(): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
  }> {
    const { data } = await supabase
      .from('opencaselist_scrape_log')
      .select('status');
    
    if (!data) return { total: 0, completed: 0, failed: 0, pending: 0 };
    
    return {
      total: data.length,
      completed: data.filter(d => d.status === 'completed').length,
      failed: data.filter(d => d.status === 'failed').length,
      pending: data.filter(d => d.status === 'pending' || d.status === 'processing').length
    };
  }
}