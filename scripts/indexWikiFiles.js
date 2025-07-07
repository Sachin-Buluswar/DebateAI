const fs = require('fs/promises');
const path = require('path');
const pdfParse = require('pdf-parse'); // Import pdf-parse
const AdmZip = require('adm-zip'); // Import adm-zip
const axios = require('axios');

// --- Configuration ---
const WIKI_FILES_DIR = path.join(__dirname, '..', 'wiki-files'); // Assumes wiki-files directory is in the project root
const API_ENDPOINT = process.env.WIKI_INDEX_ENDPOINT || 'http://localhost:3001/api/wiki-index'; // Your running Next.js app endpoint
const CONCURRENT_REQUESTS = 3; // Limit concurrent requests to avoid overwhelming the server/API
const CLEANUP_EXTRACTED_FOLDERS = true; // Set to false to keep extracted folders for debugging
const WIKI_DIR = path.join(__dirname, '..', 'data', 'wiki-files');
const BATCH_SIZE = 20;
// -------------------

// Main execution wrapped in IIAFE
(async () => {
  // Make sure fetch is available (native in Node 18+)
  if (typeof fetch === 'undefined') {
    console.error("[ERROR] Native fetch is not available. Please use Node.js v18 or later, or install 'node-fetch'.");
    process.exit(1);
  }

  async function indexFile(filePath) {
    const fileName = path.basename(filePath);
    const fileExt = path.extname(fileName).toLowerCase();
    console.log(`[INFO] Reading file: ${fileName}...`);
    let fileContent;

    try {
      // --- Extract content based on file type ---
      if (fileExt === '.pdf') {
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(dataBuffer);
        fileContent = pdfData.text;
        if (!fileContent || fileContent.trim().length === 0) {
           console.warn(`[WARN] Extracted empty content from PDF: ${fileName}. Skipping.`);
           return { success: false, file: fileName, reason: 'Empty PDF content' };
        }
        console.log(`[INFO] Extracted text from PDF: ${fileName}`);
      } else if (['.txt', '.md', '.json', '.html', '.xml'].includes(fileExt)) { // Add other text-based formats if needed
        fileContent = await fs.readFile(filePath, 'utf-8');
        console.log(`[INFO] Read text file: ${fileName}`);
      } else {
        console.warn(`[WARN] Skipping unsupported file type: ${fileName} (extension: ${fileExt})`);
        return { success: false, file: fileName, reason: 'Unsupported type' };
      }
      // ------------------------------------------

      console.log(`[INFO] Sending ${fileName} (${Math.round(fileContent.length / 1024)} KB) to API: ${API_ENDPOINT}...`);

      const requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: fileName, // Send original filename for metadata
            fileContent: fileContent,
          }),
        };

      const response = await fetch(API_ENDPOINT, requestOptions);

      if (!response.ok) {
        let errorBody = '[Could not read error body]';
        try {
          errorBody = await response.text();
        } catch (e) { /* Ignore error reading body */ }
        console.error(`[ERROR] Failed to index ${fileName}. Status: ${response.status}. Response: ${errorBody}`);
        return { success: false, file: fileName, reason: `API Error: ${response.status}` };
      } else {
        let result = { message: '[Could not read success body]' };
        try {
          result = await response.json();
        } catch (e) { /* Ignore error reading body */ }
        console.log(`[SUCCESS] Indexing initiated for ${fileName}. API Response: ${result.message}`);
        return { success: true, file: fileName };
      }
    } catch (error) {
      console.error(`[ERROR] Exception processing ${fileName}:`, error);
      return { success: false, file: fileName, reason: 'Processing exception' };
    }
  }

  // --- NEW: Recursive function to find processable files ---
  async function findFilesRecursive(dirPath) {
    let processableFiles = [];
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                // Recursively search subdirectories
                processableFiles = processableFiles.concat(await findFilesRecursive(fullPath));
            } else if (entry.isFile()) {
                const fileExt = path.extname(entry.name).toLowerCase();
                // Check if it's a directly processable file type
                if (['.pdf', '.txt', '.md', '.json', '.html', '.xml'].includes(fileExt)) {
                    if (path.basename(entry.name)[0] !== '.') { // Skip hidden files
                         processableFiles.push(fullPath);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[ERROR] Failed to read directory ${dirPath} during recursive scan:`, error);
    }
    return processableFiles;
  }
  // ---------------------------------------------------------

  // --- UPDATED: processDirectory to handle ZIPs and scan recursively ---
  async function processDirectory() {
    console.log(`[INFO] Scanning directory: ${WIKI_FILES_DIR}`);
    let topLevelEntries;
    try {
      topLevelEntries = await fs.readdir(WIKI_FILES_DIR, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`[ERROR] Directory not found: ${WIKI_FILES_DIR}`);
        console.error('[INSTRUCTION] Please create the \'wiki-files\' directory in your project root and place your wiki files inside it.');
      } else {
        console.error(`[ERROR] Failed to read directory ${WIKI_FILES_DIR}:`, error);
      }
      return;
    }

    if (topLevelEntries.length === 0) {
      console.log('[INFO] No files or directories found in the wiki-files directory.');
      return;
    }

    console.log(`[INFO] Found ${topLevelEntries.length} top-level entries.`);

    let filesToProcess = [];
    const extractedFolders = []; // Keep track of folders created from ZIPs for potential cleanup

    for (const entry of topLevelEntries) {
        const fullPath = path.join(WIKI_FILES_DIR, entry.name);
        if (entry.isDirectory()) {
            // If it's a directory, scan it recursively for processable files
            console.log(`[INFO] Scanning existing subdirectory: ${entry.name}...`);
            filesToProcess = filesToProcess.concat(await findFilesRecursive(fullPath));
        } else if (entry.isFile()) {
            const fileExt = path.extname(entry.name).toLowerCase();
            if (fileExt === '.zip') {
                // --- Handle ZIP file ---
                console.log(`[INFO] Found ZIP file: ${entry.name}. Extracting...`);
                const zip = new AdmZip(fullPath);
                const targetExtractDir = path.join(WIKI_FILES_DIR, `${path.parse(entry.name).name}_extracted`);
                extractedFolders.push(targetExtractDir); // Mark for potential cleanup
                try {
                    await fs.mkdir(targetExtractDir, { recursive: true }); // Ensure target dir exists
                    zip.extractAllTo(targetExtractDir, /*overwrite*/ true);
                    console.log(`[INFO] Extracted ${entry.name} to ${targetExtractDir}. Scanning for files...`);
                    // Scan the newly extracted directory recursively
                    filesToProcess = filesToProcess.concat(await findFilesRecursive(targetExtractDir));
                } catch (zipError) {
                    console.error(`[ERROR] Failed to extract or scan ZIP file ${entry.name}:`, zipError);
                    // Optionally remove partially extracted folder?
                    // await fs.rm(targetExtractDir, { recursive: true, force: true }).catch(e => console.error(`Cleanup failed for ${targetExtractDir}`, e));
                }
                // ---------------------
            } else if (['.pdf', '.txt', '.md', '.json', '.html', '.xml'].includes(fileExt)) {
                // Handle loose processable files directly in wiki-files
                 if (path.basename(entry.name)[0] !== '.') { // Skip hidden files
                     filesToProcess.push(fullPath);
                 }
            } else {
                 console.warn(`[WARN] Skipping unsupported file type at top level: ${entry.name}`);
            }
        }
    }

    // Remove duplicates just in case
    const uniqueFilesToProcess = [...new Set(filesToProcess)];

    if (uniqueFilesToProcess.length === 0) {
      console.log('[INFO] No processable files (.pdf, .txt, etc.) found directly or within ZIP archives.');
      return;
    }
    console.log(`[INFO] Found a total of ${uniqueFilesToProcess.length} processable files.`);

    const results = [];
    const queue = [...uniqueFilesToProcess]; // Use the list of found files

    // Process files in batches to limit concurrency
    async function worker(id) {
      // console.log(`[Worker ${id}] Starting...`);
      while(queue.length > 0) {
          const filePath = queue.shift();
          if (!filePath) continue;
          try {
              const stat = await fs.stat(filePath);
              if (stat.isFile()) {
                  const result = await indexFile(filePath);
                  results.push(result);
              } else {
                  // This case should ideally not happen if findFilesRecursive works correctly
                  console.log(`[WARN] Worker skipping non-file item from queue: ${path.basename(filePath)}`);
              }
          } catch (statError) {
              console.error(`[ERROR] Worker could not get stats for ${path.basename(filePath)}:`, statError);
              results.push({ success: false, file: path.basename(filePath), reason: 'Stat error' });
          }
      }
      // console.log(`[Worker ${id}] Finished.`);
    }

    const workers = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
        workers.push(worker(i + 1));
    }

    await Promise.all(workers);

    // --- Cleanup Extracted Folders ---
    if (CLEANUP_EXTRACTED_FOLDERS && extractedFolders.length > 0) {
        console.log('\n--- Cleaning up extracted folders ---');
        for (const folderPath of extractedFolders) {
            try {
                console.log(`[INFO] Removing ${folderPath}...`);
                await fs.rm(folderPath, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error(`[ERROR] Failed to remove extracted folder ${folderPath}:`, cleanupError);
            }
        }
        console.log('-------------------------------------');
    }
    // ---------------------------------

    // --- Summary ---
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    console.log('\n--- Indexing Complete ---');
    console.log(`Successfully initiated indexing for: ${successCount} files.`);
    console.log(`Failed to initiate indexing for:    ${failureCount} files.`);
    if (failureCount > 0) {
      console.log('Failed files:');
      results.filter(r => !r.success).forEach(r => console.log(`- ${r.file} (Reason: ${r.reason || 'Unknown'})`));
    }
    console.log('-------------------------');
  }

  // Run the processing function inside the IIAFE
  console.log('--- Starting Wiki File Indexing Script ---');
  try {
      await processDirectory();
  } catch (error) {
      console.error('[FATAL] An unexpected error occurred during the indexing process:', error);
  } finally {
      console.log('--- Indexing Script Finished ---');
  }

})(); // Immediately invoke the async function 