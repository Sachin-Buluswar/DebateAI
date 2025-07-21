# OpenAI API Reference

> **Status:** ✅ Updated with latest API information

## Overview

Eris Debate uses OpenAI's API for three core capabilities:

1. **Chat Completions (GPT-4o)** – Generate structured speeches, rebuttals, and post-debate analysis
2. **Embeddings** – Convert wiki documents into searchable vectors
3. **Vector Stores** – Store and search embedded documents for evidence retrieval (RAG)

## Quick Links

- [Official Chat API Docs](https://platform.openai.com/docs/api-reference/chat)
- [Official Embeddings Docs](https://platform.openai.com/docs/api-reference/embeddings)
- [Official Vector Stores Docs](https://platform.openai.com/docs/assistants/tools/file-search/vector-stores)

---

## Authentication

All requests require the `Authorization` header:

```http
Authorization: Bearer $OPENAI_API_KEY
```

Store the key in `.env.local`:
```env
OPENAI_API_KEY=sk-...
```

---

## Chat Completions

Used in: `src/backend/modules/speechFeedback/`, debate generation logic

### Basic Request

```ts
const response = await openai.chat.completions.create({
  model: 'gpt-4o',  // Latest model for best performance
  messages: [
    { role: 'system', content: 'You are a debate coach...' },
    { role: 'user', content: userInput }
  ],
  temperature: 0.7,  // 0.7 for creative responses, lower for factual
  max_tokens: 1024
})

const generatedText = response.choices[0].message.content
```

### Streaming Responses

For long speeches, use streaming to improve perceived latency:

```ts
const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: messages,
  stream: true
})

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || ''
  // Process each chunk as it arrives
}
```

### Best Practices

- **Temperature**: Use 0.5-0.7 for debate speeches (balanced creativity)
- **System Prompts**: Keep concise and structured
- **Token Limits**: Monitor usage; gpt-4o supports up to 128K context
- **Error Handling**: Implement retry logic for rate limits

---

## Embeddings

Used in: `src/app/api/wiki-index/route.ts`

### Creating Embeddings

```ts
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',  // Cost-effective, good performance
  input: documentChunk,
  encoding_format: 'float'
})

const embedding = response.data[0].embedding  // Array of 1536 floats
```

### Model Comparison

| Model | Dimensions | Price | Use Case |
|-------|------------|-------|----------|
| text-embedding-3-small | 1536 | $0.02/1M tokens | Default choice |
| text-embedding-3-large | 3072 | $0.13/1M tokens | Higher accuracy needs |

### Optimization Tips

- **Batch Processing**: Send multiple texts in one request (up to 2048 inputs)
- **Dimension Reduction**: Use `dimensions` parameter to reduce vector size if needed
- **Caching**: Store embeddings to avoid re-processing identical text

---

## Vector Stores (RAG)

Used in: `src/app/api/wiki-search/route.ts`, `src/backend/modules/wikiSearch/`

### Create Vector Store

```ts
// Create store
const vectorStore = await openai.beta.vectorStores.create({
  name: 'debate-evidence'
})

// Upload files
const file = await openai.files.create({
  file: fs.createReadStream('evidence.pdf'),
  purpose: 'assistants'
})

await openai.beta.vectorStores.files.createAndPoll({
  vector_store_id: vectorStore.id,
  file_id: file.id
})
```

### Search Implementation

```ts
// Search for relevant evidence
const results = await openai.beta.vectorStores.search({
  vector_store_id: process.env.OPENAI_VECTOR_STORE_ID,
  query: userQuery,
  limit: 5  // Return top 5 results
})

// Use results in completion
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: 'Answer based on the provided evidence.'
    },
    {
      role: 'user',
      content: `Evidence: ${formatResults(results)}\n\nQuestion: ${userQuery}`
    }
  ]
})
```

### File Management

- **Supported Formats**: PDF, DOCX, TXT, MD, JSON
- **Size Limits**: 512 MB per file, 5M tokens max
- **Chunking**: Default 800 tokens with 400 token overlap

---

## Rate Limits & Error Handling

### Rate Limits (GPT-4o)

| Tier | RPM | TPM | 
|------|-----|-----|
| Tier 1 | 500 | 30,000 |
| Tier 2 | 5,000 | 450,000 |
| Tier 3 | 10,000 | 800,000 |

### Error Handling Pattern

```ts
async function callOpenAI(request, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await request()
    } catch (error) {
      if (error.status === 429) {
        // Rate limit - exponential backoff
        const delay = Math.pow(2, i) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}
```

### Common Error Codes

- `401`: Invalid API key
- `429`: Rate limit exceeded (check headers for retry-after)
- `500`: OpenAI server error (retry with backoff)
- `503`: Service temporarily unavailable

---

## Cost Optimization

### Token Counting

```ts
import { encoding_for_model } from 'tiktoken'

const encoder = encoding_for_model('gpt-4o')
const tokenCount = encoder.encode(text).length
```

### Cost Reduction Strategies

1. **Cache Embeddings**: Store computed embeddings in Supabase
2. **Optimize Prompts**: Shorter system prompts save tokens
3. **Use Appropriate Models**: text-embedding-3-small for most embedding tasks
4. **Implement Streaming**: Better UX without extra cost
5. **Set max_tokens**: Prevent unexpectedly long responses

---

## Project-Specific Patterns

### Speech Generation

```ts
// Pattern used in speech feedback module
const SPEECH_ANALYSIS_PROMPT = `
Analyze this debate speech and provide:
1. Delivery score (1-10)
2. Argument strength (1-10)
3. Specific improvements
4. Overall feedback
`
```

### Evidence Search

```ts
// Pattern for wiki search
const searchWithContext = async (query: string) => {
  // 1. Search vector store
  const results = await vectorStore.search(query)
  
  // 2. Format results
  const context = results.map(r => r.content).join('\n')
  
  // 3. Generate response with context
  return await generateResponse(query, context)
}
``` 