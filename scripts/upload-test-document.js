/**
 * Script to upload a test document for RAG system
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Sample document content about US-China relations
const sampleContent = `
# US-China Relations and Environmental Policy

## Introduction
The relationship between the United States and China represents one of the most significant bilateral relationships in the 21st century. Environmental policies, including regulations on single-use plastics, have become an increasingly important aspect of this relationship.

## Political Implications of Environmental Regulations

### Single-Use Plastics Ban
If the United States were to implement a comprehensive ban on single-use plastics, several political implications would emerge for US-China relations:

1. **Trade Dynamics**: China is a major exporter of plastic products to the US market. A ban would significantly impact Chinese manufacturers and could lead to trade disputes.

2. **Environmental Leadership**: Such a move would position the US as a leader in environmental protection, potentially pressuring China to implement similar measures.

3. **Economic Competition**: The transition away from single-use plastics could create new markets for sustainable alternatives, leading to competition between US and Chinese companies.

### Broader Environmental Cooperation

Despite tensions in other areas, environmental policy remains a potential area for US-China cooperation:

- Climate change initiatives
- Clean energy development
- Ocean pollution reduction
- Sustainable manufacturing practices

## Economic and Military Aspects

The US-China relationship encompasses various dimensions beyond environmental policy:

### Economic Relations
- Trade volume exceeding $600 billion annually
- Technology transfer concerns
- Intellectual property disputes
- Supply chain dependencies

### Military Considerations
- South China Sea tensions
- Taiwan strait issues
- Military modernization programs
- Regional security alliances

## Conclusion

Environmental legislation, such as a potential ban on single-use plastics, would have multifaceted impacts on US-China relations. While it could create short-term trade tensions, it also presents opportunities for cooperation on global environmental challenges. The overall relationship will continue to be influenced by a complex interplay of economic, military, and environmental factors.
`;

async function uploadTestDocument() {
  console.log('📤 Uploading test document...\n');
  
  try {
    // 1. Create a temporary text file
    const fileName = 'US-China-Environmental-Policy-Test.txt';
    const filePath = path.join(__dirname, fileName);
    await fs.writeFile(filePath, sampleContent);
    
    // 2. Read file as buffer
    const fileBuffer = await fs.readFile(filePath);
    
    // 3. Upload to storage
    console.log('Uploading to storage...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `test-documents/${timestamp}_${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('debate-documents')
      .upload(storagePath, fileBuffer, {
        contentType: 'text/plain',
        upsert: false
      });
      
    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      await fs.unlink(filePath);
      return;
    }
    
    console.log('✅ File uploaded to storage');
    
    // 4. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('debate-documents')
      .getPublicUrl(storagePath);
      
    console.log('Public URL:', publicUrl);
    
    // 5. Create document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title: 'US-China Relations and Environmental Policy',
        file_name: fileName,
        file_url: publicUrl,
        file_size: fileBuffer.length,
        source_type: 'upload',
        metadata: {
          description: 'Test document for RAG system',
          topics: ['US-China relations', 'environmental policy', 'single-use plastics']
        }
      })
      .select()
      .single();
      
    if (docError) {
      console.error('❌ Document creation error:', docError);
      await fs.unlink(filePath);
      return;
    }
    
    console.log('✅ Document record created:', document.id);
    
    // 6. Create document chunks for search
    const chunks = sampleContent
      .split('\n\n')
      .filter(chunk => chunk.trim().length > 50)
      .map((content, index) => ({
        document_id: document.id,
        chunk_index: index,
        content: content.trim(),
        page_number: 1,
        metadata: {}
      }));
      
    const { data: chunkData, error: chunkError } = await supabase
      .from('document_chunks')
      .insert(chunks)
      .select();
      
    if (chunkError) {
      console.error('❌ Chunk creation error:', chunkError);
    } else {
      console.log(`✅ Created ${chunkData.length} document chunks`);
    }
    
    // 7. Clean up temp file
    await fs.unlink(filePath);
    
    console.log('\n✨ Test document uploaded successfully!');
    console.log('You can now search for terms like:');
    console.log('- "US China relationship"');
    console.log('- "single use plastics"');
    console.log('- "political implications"');
    console.log('- "environmental policy"');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the upload
uploadTestDocument().catch(console.error);