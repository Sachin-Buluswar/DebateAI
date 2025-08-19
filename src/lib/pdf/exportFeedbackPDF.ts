/**
 * PDF Export Utility for Speech Feedback
 * Converts markdown feedback to professionally formatted PDF
 */

import { marked } from 'marked';

interface PDFExportOptions {
  filename?: string;
  showLoadingIndicator?: boolean;
}

/**
 * Export speech feedback as a professionally formatted PDF
 * @param markdownContent The markdown content to convert to PDF
 * @param options Export options including filename
 * @returns Promise that resolves when PDF is downloaded
 */
export async function exportFeedbackAsPDF(
  markdownContent: string,
  options: PDFExportOptions = {}
): Promise<void> {
  const { filename = 'speech-feedback.pdf' } = options;

  try {
    // Dynamically import html2pdf to avoid SSR issues
    const html2pdf = (await import('html2pdf.js')).default;
    
    // Configure marked for clean HTML output
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    
    // Convert markdown to HTML
    const htmlContent = await marked.parse(markdownContent);
    
    // Create styled HTML document that matches the professional look
    const styledHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: white;
            padding: 40px;
            font-size: 11pt;
          }
          
          /* Headers */
          h1 {
            font-size: 24pt;
            font-weight: 700;
            margin-bottom: 20px;
            color: #000;
            border-bottom: 2px solid #e5e5e5;
            padding-bottom: 10px;
          }
          
          h2 {
            font-size: 18pt;
            font-weight: 600;
            margin-top: 30px;
            margin-bottom: 15px;
            color: #1a1a1a;
          }
          
          h3 {
            font-size: 14pt;
            font-weight: 600;
            margin-top: 25px;
            margin-bottom: 12px;
            color: #333;
          }
          
          /* Paragraphs and text */
          p {
            margin-bottom: 12px;
            text-align: justify;
            line-height: 1.7;
          }
          
          /* Lists */
          ul, ol {
            margin-left: 25px;
            margin-bottom: 15px;
          }
          
          li {
            margin-bottom: 8px;
            line-height: 1.6;
          }
          
          /* Strong emphasis for score and key points */
          strong {
            font-weight: 600;
            color: #000;
          }
          
          /* Code blocks for examples */
          code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 10pt;
          }
          
          pre {
            background: #f5f5f5;
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
            margin-bottom: 15px;
          }
          
          /* Special formatting for metadata */
          h2 + ul {
            list-style: none;
            margin-left: 0;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e5e5e5;
          }
          
          h2 + ul li {
            display: inline-block;
            margin-right: 20px;
            color: #666;
          }
          
          /* Score badge styling */
          p:first-of-type strong:first-child {
            background: #f0f4f8;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 8px;
          }
          
          /* Section spacing */
          h3 + p,
          h3 + ul {
            margin-top: 8px;
          }
          
          /* Page break control for PDF */
          h2 {
            page-break-after: avoid;
          }
          
          h3 {
            page-break-after: avoid;
          }
          
          p {
            orphans: 3;
            widows: 3;
          }
          
          /* Ensure sections stay together */
          .section {
            page-break-inside: avoid;
          }
          
          /* Force page break for Training Plan section */
          .page-break-before {
            page-break-before: always;
            margin-top: 0;
          }
          
          /* Training plan styles */
          h4 {
            font-size: 12pt;
            font-weight: 600;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #444;
          }
          
          /* Exercise boxes */
          .exercise {
            border: 1px solid #e5e5e5;
            padding: 10px;
            margin-bottom: 15px;
            border-radius: 4px;
            background: #fafafa;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;
    
    // Configure PDF generation options
    const pdfOptions = {
      margin: [15, 15, 15, 15], // top, left, bottom, right in mm
      filename: filename,
      image: { 
        type: 'jpeg', 
        quality: 0.98 
      },
      html2canvas: { 
        scale: 2, // Higher scale for better quality
        useCORS: true,
        letterRendering: true,
        logging: false
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' as const,
        compress: true
      },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: ['h2', 'h3', '.section']
      }
    };
    
    // Generate and download PDF
    await html2pdf()
      .set(pdfOptions)
      .from(styledHTML)
      .save();
      
  } catch (error) {
    // PRODUCTION: Console disabled
    // console.error('PDF generation failed:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Test if PDF generation is supported in the current browser
 */
export function isPDFExportSupported(): boolean {
  // Check for required browser APIs
  return typeof window !== 'undefined' && 
         typeof Blob !== 'undefined' && 
         typeof URL !== 'undefined' &&
         typeof URL.createObjectURL === 'function';
}

/**
 * Format markdown content specifically for PDF export
 * Ensures consistent formatting and structure
 */
export function formatMarkdownForPDF(content: string): string {
  // Ensure proper spacing between sections
  let formatted = content
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .replace(/^#+\s+/gm, '\n$&') // Add space before headers
    .trim();
  
  // Ensure bullet points are properly formatted
  formatted = formatted.replace(/^-\s+/gm, '• ');
  
  return formatted;
}