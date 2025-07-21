# Code Patterns

## API Routes

### POST Route
```typescript
// src/app/api/[endpoint]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rateLimit';
import { validateRequest } from '@/lib/validation';
import { logger } from '@/lib/monitoring/logger';
import { z } from 'zod';

const requestSchema = z.object({
  field1: z.string(),
  field2: z.number().optional(),
});

export async function POST(request: NextRequest) {
  const { success, response } = await withRateLimit(request);
  if (!success) return response;

  const { data, error } = await validateRequest(request, requestSchema);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  try {
    const result = await serviceCall(data);
    return NextResponse.json({ 
      success: true,
      data: result 
    });
  } catch (error) {
    logger.error('API Error', { 
      error, 
      endpoint: '/api/[endpoint]',
      method: 'POST' 
    });
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
```

### Protected Route
```typescript
// src/app/api/protected/[endpoint]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  // Protected logic here
}
```

## Components

### Server Component
```typescript
// src/app/[page]/page.tsx
import { createClient } from '@/lib/supabaseClient';

export default async function PageName() {
  const supabase = createClient();
  const { data } = await supabase
    .from('table_name')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto p-4">
      <h1>Title</h1>
      {/* Render data */}
    </div>
  );
}
```

### Client Component
```typescript
// src/components/[component]/ComponentName.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';

interface ComponentNameProps {
  initialData?: string;
  onSubmit: (data: string) => Promise<void>;
}

export function ComponentName({ initialData = '', onSubmit }: ComponentNameProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState(initialData);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      await onSubmit(data);
      toast.success('Operation successful');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={handleSubmit} />;

  return (
    <div>
      <Button onClick={handleSubmit} disabled={loading}>
        Submit
      </Button>
    </div>
  );
}
```

## Services

### Service Class
```typescript
// src/backend/services/serviceName.ts
import { withRetry } from '@/lib/errorRecovery';
import { logger } from '@/lib/monitoring/logger';
import { z } from 'zod';

const inputSchema = z.object({
  query: z.string().min(1),
  options: z.object({
    limit: z.number().default(10),
  }).optional(),
});

type ServiceInput = z.infer<typeof inputSchema>;

class ServiceName {
  private client: ClientType;

  constructor() {
    this.client = new ClientType({
      apiKey: process.env.API_KEY!,
    });
  }

  async performOperation(params: ServiceInput): Promise<Result> {
    const validated = inputSchema.parse(params);

    return withRetry(
      async () => {
        const response = await this.client.call(validated);
        return this.processResponse(response);
      },
      {
        maxRetries: 3,
        backoff: 'exponential',
        onRetry: (error, attempt) => {
          logger.warn('Retry attempt', { error, attempt });
        },
      }
    );
  }

  private processResponse(response: any): Result {
    return transformedResult;
  }
}

export const serviceName = new ServiceName();
```

### OpenAI Integration
```typescript
// src/backend/modules/[module]/aiOperations.ts
import { openAIService } from '@/backend/services/openaiService';
import { logger } from '@/lib/monitoring/logger';

export async function generateContent(prompt: string): Promise<string> {
  try {
    const response = await openAIService.generateCompletion({
      prompt,
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
    });
    
    return response.content;
  } catch (error) {
    logger.error('OpenAI generation failed', { error, prompt });
    throw new Error('Failed to generate content');
  }
}
```

## Error Handling

### Custom Errors
```typescript
// src/lib/errors.ts
export class ValidationError extends Error {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ExternalServiceError extends Error {
  constructor(
    message: string,
    public service: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

export function handleError(error: unknown): ErrorResponse {
  if (error instanceof ValidationError) {
    return {
      error: error.message,
      fields: error.fields,
      status: 400,
    };
  }
  
  if (error instanceof ExternalServiceError) {
    logger.error('External service error', {
      service: error.service,
      statusCode: error.statusCode,
    });
    return {
      error: 'Service temporarily unavailable',
      status: 503,
    };
  }
  
  logger.error('Unhandled error', { error });
  return {
    error: 'Internal server error',
    status: 500,
  };
}
```

### Error Recovery
```typescript
// src/lib/resilientCall.ts
import { withRetry, withTimeout, withCircuitBreaker } from '@/lib/errorRecovery';

export async function resilientApiCall(data: any) {
  return withCircuitBreaker(
    'external-api',
    async () => {
      return withTimeout(
        withRetry(
          async () => {
            const response = await fetch('/external-api', {
              method: 'POST',
              body: JSON.stringify(data),
            });
            
            if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
            }
            
            return response.json();
          },
          { maxRetries: 3 }
        ),
        5000
      );
    }
  );
}
```

## Database

### Query Pattern
```typescript
// src/lib/db/queries.ts
import { createClient } from '@/lib/supabaseClient';
import { logger } from '@/lib/monitoring/logger';

export async function getUserDebates(userId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('debates')
    .select(`
      *,
      debate_messages (
        id,
        content,
        created_at
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    logger.error('Database query failed', { error, userId });
    throw new Error('Failed to fetch debates');
  }

  return data;
}
```

### Transaction Pattern
```typescript
// src/lib/db/transactions.ts
import { createClient } from '@/lib/supabaseClient';
import { logger } from '@/lib/monitoring/logger';

export async function createDebateWithMessages(
  debateData: DebateInput,
  messages: MessageInput[]
) {
  const supabase = createClient();
  
  try {
    const { data: debate, error: debateError } = await supabase
      .from('debates')
      .insert(debateData)
      .select()
      .single();

    if (debateError) throw debateError;

    const messagesWithDebateId = messages.map(msg => ({
      ...msg,
      debate_id: debate.id,
    }));

    const { error: messagesError } = await supabase
      .from('debate_messages')
      .insert(messagesWithDebateId);

    if (messagesError) {
      await supabase.from('debates').delete().eq('id', debate.id);
      throw messagesError;
    }

    return debate;
  } catch (error) {
    logger.error('Transaction failed', { error });
    throw new Error('Failed to create debate');
  }
}
```

## Socket.IO

### Event Handlers
```typescript
// src/backend/socket/handlers.ts
import { Server, Socket } from 'socket.io';
import { logger } from '@/lib/monitoring/logger';

interface DebateEvents {
  'debate:join': (debateId: string) => void;
  'debate:leave': (debateId: string) => void;
  'debate:message': (message: DebateMessage) => void;
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    const userId = authenticateSocket(socket);
    if (!userId) {
      socket.disconnect();
      return;
    }

    socket.join(`user:${userId}`);

    socket.on('debate:join', async (debateId: string) => {
      try {
        const hasAccess = await validateDebateAccess(userId, debateId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(`debate:${debateId}`);
        socket.emit('debate:joined', { debateId });
        socket.to(`debate:${debateId}`).emit('user:joined', { userId });
      } catch (error) {
        logger.error('Socket error', { error, event: 'debate:join' });
        socket.emit('error', { message: 'Failed to join debate' });
      }
    });
  });
}
```

## Security

### Input Validation
```typescript
// src/lib/validation/userInput.ts
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

const userInputSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email(),
  message: z.string().max(1000).transform(val => DOMPurify.sanitize(val)),
});

export function processUserInput(rawInput: unknown) {
  const result = userInputSchema.safeParse(rawInput);
  
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
  }
  
  return result.data;
}
```

### Auth Middleware
```typescript
// src/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';

export async function requireAuth(request: NextRequest) {
  const session = await getSession(request);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  request.headers.set('x-user-id', session.user.id);
  request.headers.set('x-user-role', session.user.role);
  
  return session;
}

export async function requireRole(request: NextRequest, requiredRole: string) {
  const session = await requireAuth(request);
  
  if (session.user.role !== requiredRole) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  return session;
}
```

## Performance

### Dynamic Imports
```typescript
// src/components/[component]/index.tsx
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});

export async function processWithHeavyLib(data: any) {
  const { processData } = await import('heavy-processing-lib');
  return processData(data);
}
```

### Caching
```typescript
// src/lib/cache/operations.ts
import { unstable_cache } from 'next/cache';

export const getCachedData = unstable_cache(
  async (userId: string) => {
    const data = await fetchUserAnalytics(userId);
    return data;
  },
  ['user-analytics'],
  {
    revalidate: 3600,
    tags: ['analytics'],
  }
);
```

## Next.js App Router Patterns

### Metadata and Viewport Configuration
```typescript
// src/app/layout.tsx
import type { Metadata, Viewport } from "next";

// Metadata export - DO NOT include viewport here
export const metadata: Metadata = {
  title: "Eris Debate",
  description: "AI-powered debate practice and speech feedback platform",
  // viewport should NOT be in metadata
};

// Viewport should be a separate export in Next.js 14+
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};
```

## Testing

### Unit Test
```typescript
// __tests__/services/serviceName.test.ts
import { serviceName } from '@/backend/services/serviceName';
import { mockClient } from '@/__mocks__/client';

describe('ServiceName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('performOperation', () => {
    it('should handle successful response', async () => {
      const input = { query: 'test query' };
      const expectedResponse = { result: 'success' };
      mockClient.call.mockResolvedValue(expectedResponse);

      const result = await serviceName.performOperation(input);

      expect(result).toEqual(expectedResponse);
      expect(mockClient.call).toHaveBeenCalledWith(input);
    });

    it('should retry on failure', async () => {
      mockClient.call
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ result: 'success' });

      const result = await serviceName.performOperation({ query: 'test' });

      expect(mockClient.call).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ result: 'success' });
    });
  });
});
```