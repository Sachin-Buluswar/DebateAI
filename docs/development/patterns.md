# Code Patterns and Best Practices

This guide outlines the coding patterns, conventions, and best practices for the DebateAI codebase.

## API Route Patterns

### Standard API Route Structure

All API routes should follow this pattern for consistency:

```typescript
// src/app/api/[endpoint]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rateLimit';
import { validateRequest } from '@/lib/validation';
import { logger } from '@/lib/monitoring/logger';
import { z } from 'zod';

// Define request schema
const requestSchema = z.object({
  field1: z.string(),
  field2: z.number().optional(),
});

export async function POST(request: NextRequest) {
  // 1. Rate limiting
  const { success, response } = await withRateLimit(request);
  if (!success) return response;

  // 2. Input validation
  const { data, error } = await validateRequest(request, requestSchema);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  // 3. Business logic with error recovery
  try {
    const result = await serviceCall(data);
    
    // 4. Success response
    return NextResponse.json({ 
      success: true,
      data: result 
    });
  } catch (error) {
    // 5. Error handling
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

### Protected Routes

For authenticated endpoints:

```typescript
import { createClient } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  // Get auth session
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Continue with authenticated logic
  const userId = session.user.id;
  // ...
}
```

## React Component Patterns

### Server Components (Default)

Use server components by default for better performance:

```typescript
// No 'use client' directive - this is a server component
import { createClient } from '@/lib/supabaseClient';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('debates')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto p-4">
      <h1>Dashboard</h1>
      {/* Render data */}
    </div>
  );
}
```

### Client Components

Only use client components when necessary:

```typescript
'use client'; // Required for hooks, state, or browser APIs

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';

interface ComponentProps {
  initialData?: string;
  onSubmit: (data: string) => Promise<void>;
}

export function InteractiveComponent({ initialData = '', onSubmit }: ComponentProps) {
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

  // Always handle loading and error states
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={handleSubmit} />;

  return (
    <div>
      {/* Component UI */}
      <Button onClick={handleSubmit} disabled={loading}>
        Submit
      </Button>
    </div>
  );
}
```

## Service Layer Patterns

### Service Class Structure

```typescript
// src/backend/services/exampleService.ts
import { withRetry } from '@/lib/errorRecovery';
import { logger } from '@/lib/monitoring/logger';
import { z } from 'zod';

// Define schemas
const inputSchema = z.object({
  query: z.string().min(1),
  options: z.object({
    limit: z.number().default(10),
  }).optional(),
});

type ServiceInput = z.infer<typeof inputSchema>;

class ExampleService {
  private client: SomeClient;

  constructor() {
    this.client = new SomeClient({
      // Configuration
    });
  }

  async performOperation(params: ServiceInput): Promise<Result> {
    // Validate input
    const validated = inputSchema.parse(params);

    // Use retry wrapper for external calls
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
    // Process and transform response
    return transformedResult;
  }
}

// Export singleton instance
export const exampleService = new ExampleService();
```

### OpenAI Integration Pattern

```typescript
// Using the centralized OpenAI client
import { openAIService } from '@/backend/services/openaiService';

async function generateContent(prompt: string) {
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

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
// Define custom error types
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

// Error handler utility
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
  
  // Unknown errors
  logger.error('Unhandled error', { error });
  return {
    error: 'Internal server error',
    status: 500,
  };
}
```

### Using Error Recovery

```typescript
import { withRetry, withTimeout, withCircuitBreaker } from '@/lib/errorRecovery';

// Combine multiple error recovery strategies
async function resilientApiCall(data: any) {
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
        5000 // 5 second timeout
      );
    }
  );
}
```

## Database Patterns

### Supabase Query Pattern

```typescript
import { createClient } from '@/lib/supabaseClient';

// Always use RLS and handle errors
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
// For complex operations requiring consistency
export async function createDebateWithMessages(
  debateData: DebateInput,
  messages: MessageInput[]
) {
  const supabase = createClient();
  
  try {
    // Start transaction
    const { data: debate, error: debateError } = await supabase
      .from('debates')
      .insert(debateData)
      .select()
      .single();

    if (debateError) throw debateError;

    // Insert related data
    const messagesWithDebateId = messages.map(msg => ({
      ...msg,
      debate_id: debate.id,
    }));

    const { error: messagesError } = await supabase
      .from('debate_messages')
      .insert(messagesWithDebateId);

    if (messagesError) {
      // Rollback by deleting the debate
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

## Real-time Patterns

### Socket.IO Event Handling

```typescript
// Consistent event handling with typing
import { Server, Socket } from 'socket.io';

interface DebateEvents {
  'debate:join': (debateId: string) => void;
  'debate:leave': (debateId: string) => void;
  'debate:message': (message: DebateMessage) => void;
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    // Authenticate socket
    const userId = authenticateSocket(socket);
    if (!userId) {
      socket.disconnect();
      return;
    }

    // Join user room
    socket.join(`user:${userId}`);

    // Handle events with error boundaries
    socket.on('debate:join', async (debateId: string) => {
      try {
        // Validate access
        const hasAccess = await validateDebateAccess(userId, debateId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Join debate room
        socket.join(`debate:${debateId}`);
        socket.emit('debate:joined', { debateId });
        
        // Notify others
        socket.to(`debate:${debateId}`).emit('user:joined', { userId });
      } catch (error) {
        logger.error('Socket error', { error, event: 'debate:join' });
        socket.emit('error', { message: 'Failed to join debate' });
      }
    });
  });
}
```

## Testing Patterns

### Unit Test Structure

```typescript
// __tests__/services/exampleService.test.ts
import { exampleService } from '@/backend/services/exampleService';
import { mockClient } from '@/__mocks__/client';

describe('ExampleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('performOperation', () => {
    it('should handle successful response', async () => {
      // Arrange
      const input = { query: 'test query' };
      const expectedResponse = { result: 'success' };
      mockClient.call.mockResolvedValue(expectedResponse);

      // Act
      const result = await exampleService.performOperation(input);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockClient.call).toHaveBeenCalledWith(input);
    });

    it('should retry on failure', async () => {
      // Test retry logic
      mockClient.call
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ result: 'success' });

      const result = await exampleService.performOperation({ query: 'test' });

      expect(mockClient.call).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ result: 'success' });
    });
  });
});
```

## Security Patterns

### Input Validation

Always validate and sanitize inputs:

```typescript
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Define strict schemas
const userInputSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email(),
  message: z.string().max(1000).transform(val => DOMPurify.sanitize(val)),
});

// Validate before processing
export function processUserInput(rawInput: unknown) {
  const result = userInputSchema.safeParse(rawInput);
  
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
  }
  
  return result.data;
}
```

### Authentication & Authorization

```typescript
// Middleware for protected routes
export async function requireAuth(request: NextRequest) {
  const session = await getSession(request);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Add user context to request
  request.headers.set('x-user-id', session.user.id);
  request.headers.set('x-user-role', session.user.role);
  
  return session;
}

// Role-based access
export async function requireRole(request: NextRequest, requiredRole: string) {
  const session = await requireAuth(request);
  
  if (session.user.role !== requiredRole) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  return session;
}
```

## Performance Patterns

### Lazy Loading

```typescript
// Dynamic imports for code splitting
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false, // Disable SSR for client-only components
});

// Lazy load libraries
async function processWithHeavyLib(data: any) {
  const { processData } = await import('heavy-processing-lib');
  return processData(data);
}
```

### Caching Strategy

```typescript
import { unstable_cache } from 'next/cache';

// Cache expensive operations
export const getCachedData = unstable_cache(
  async (userId: string) => {
    // Expensive operation
    const data = await fetchUserAnalytics(userId);
    return data;
  },
  ['user-analytics'], // Cache key
  {
    revalidate: 3600, // 1 hour
    tags: ['analytics'],
  }
);
```

## Summary

Key principles to follow:

1. **Consistency** - Use established patterns
2. **Error Handling** - Always handle errors gracefully
3. **Type Safety** - Leverage TypeScript fully
4. **Security** - Validate inputs, use RLS, implement rate limiting
5. **Performance** - Optimize for user experience
6. **Maintainability** - Write clear, documented code

Remember: This is a production application. Every line of code should be written with reliability, security, and user experience in mind.