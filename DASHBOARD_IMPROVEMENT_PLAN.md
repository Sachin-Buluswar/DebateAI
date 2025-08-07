# Dashboard Statistics Improvement Plan

## Executive Summary
This plan addresses critical data consistency issues in the Eris Debate dashboard statistics system, focusing on score standardization, accurate duration tracking, and data migration strategies.

## Current State Analysis

### Score Storage Issues
- **3 different score formats** currently in use:
  - NSDA format (25-30): 9 records use `feedback.speakerScore`
  - JSON object format: 5 records use `feedback.score` as object
  - Simple score: 1 record uses `feedback.score` as number
  - **Unused column**: `overall_score` column exists but has 0 records (always NULL)

### Duration Tracking Issues
- **Hardcoded default**: Audio duration always returns 60 seconds (see `audioUtils.ts:16`)
- **Inconsistent estimates**: Dashboard assumes 3 minutes for 60-second recordings
- **Actual data ignored**: Database has real durations (60-1545 seconds) but not used
- **Average duration**: 160 seconds in database, but calculations use hardcoded values

### Data Flow Touchpoints
1. **Score Input**: `speechFeedbackService.ts:422` - Stores as `speakerScore` in JSON
2. **Score Display**: 
   - `dashboard/page.tsx:48` - `extractScore()` function handles conversion
   - `history/page.tsx` - Direct access to feedback fields
   - `EnhancedFeedbackDisplay.tsx` - Score display component
3. **Duration Input**: `speechFeedbackService.ts:221` - Gets duration via `getAudioDuration()`
4. **Duration Storage**: `speechFeedbackService.ts:526` - Stores in `duration_seconds`
5. **Duration Usage**: Dashboard hardcodes estimates instead of using stored values

## Improvement Plan

### Phase 1: Immediate Fixes (1-2 days)

#### 1.1 Fix Audio Duration Detection
**Problem**: `getAudioDuration()` always returns 60 seconds
**Solution**: Implement proper audio duration detection

```typescript
// Option A: Use web-audio-api for browser-safe duration detection
import { parseBuffer } from 'music-metadata-browser';

export async function getAudioDuration(filePath: string): Promise<number> {
  const buffer = await fs.readFile(filePath);
  const metadata = await parseBuffer(buffer);
  return metadata.format.duration || 60;
}

// Option B: Use ffprobe in a child process (server-side only)
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    return parseFloat(stdout) || 60;
  } catch (error) {
    console.error('[audioUtils] FFprobe error:', error);
    return 60;
  }
}
```

#### 1.2 Standardize Score Storage
**Problem**: Multiple score formats in feedback JSON
**Solution**: Always store in `overall_score` column AND standardized JSON format

```typescript
// speechFeedbackService.ts - Update storage logic
const standardizedScore = convertToPercentage(feedback.speakerScore);

const { data, error } = await supabaseAdmin
  .from('speech_feedback')
  .insert({
    user_id: userId,
    topic,
    speech_type: speechType,
    user_side: userSide,
    feedback: {
      ...feedback,
      standardizedScore: standardizedScore // Always include percentage
    },
    overall_score: Math.round(standardizedScore), // Populate the column!
    audio_url: audioUrl,
    transcription: JSON.stringify(transcription),
    file_size_bytes: processedFileSize,
    duration_seconds: processedAudio.durationSeconds // Use real duration
  });
```

### Phase 2: Data Migration (1 day)

#### 2.1 Create Migration Script
```sql
-- migrations/0002_standardize_scores.sql

-- Update overall_score column for all existing records
UPDATE public.speech_feedback
SET overall_score = 
  CASE 
    -- NSDA format (25-30) to percentage
    WHEN feedback->>'speakerScore' IS NOT NULL 
      THEN ROUND(((CAST(feedback->>'speakerScore' AS FLOAT) - 25) / 5) * 100)
    -- JSON object format with 'overall' field
    WHEN feedback->>'score' LIKE '{%' AND 
         json_extract_path_text((feedback->>'score')::json, 'overall') IS NOT NULL
      THEN CAST(json_extract_path_text((feedback->>'score')::json, 'overall') AS INTEGER)
    -- Simple numeric score
    WHEN feedback->>'score' IS NOT NULL AND feedback->>'score' NOT LIKE '{%'
      THEN CAST(feedback->>'score' AS INTEGER)
    ELSE NULL
  END
WHERE overall_score IS NULL;

-- Add standardizedScore to feedback JSON for consistency
UPDATE public.speech_feedback
SET feedback = jsonb_set(
  feedback,
  '{standardizedScore}',
  to_jsonb(overall_score)
)
WHERE overall_score IS NOT NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_speech_feedback_overall_score 
ON public.speech_feedback(overall_score) 
WHERE overall_score IS NOT NULL;
```

#### 2.2 Migration Execution Plan
1. **Backup first**: `pg_dump -t speech_feedback > backup.sql`
2. **Test on staging**: Run migration on a copy of production data
3. **Execute migration**: Run via Supabase dashboard or migration API
4. **Verify**: Check all records have `overall_score` populated

### Phase 3: Dashboard Updates (1 day)

#### 3.1 Simplify Score Extraction
```typescript
// New simplified extractScore function
const extractScore = (feedback: any): number | null => {
  // First check the standardized column
  if (feedback.overall_score !== undefined && feedback.overall_score !== null) {
    return feedback.overall_score;
  }
  
  // Fallback to standardizedScore in JSON
  if (feedback.standardizedScore !== undefined) {
    return feedback.standardizedScore;
  }
  
  // Legacy fallback (can be removed after migration)
  return legacyScoreExtraction(feedback);
};
```

#### 3.2 Use Actual Durations
```typescript
// dashboard/page.tsx - Update duration calculations
const speechHours = fetchedSpeeches.reduce(
  (sum, speech) => {
    // Use actual duration_seconds from database
    const durationHours = (speech.duration_seconds || 180) / 3600;
    return sum + durationHours;
  },
  0
);

// For debates, query actual duration from debate_sessions
const { data: debateSessions } = await supabase
  .from('debate_sessions')
  .select('id, started_at, ended_at')
  .eq('user_id', userId);

const debateHours = debateSessions.reduce((sum, session) => {
  if (session.started_at && session.ended_at) {
    const duration = new Date(session.ended_at) - new Date(session.started_at);
    return sum + (duration / (1000 * 60 * 60)); // Convert ms to hours
  }
  return sum + (10 / 60); // Default 10 minutes if no end time
}, 0);
```

### Phase 4: Validation & Testing (1 day)

#### 4.1 Create Validation Tests
```typescript
// tests/dashboard-stats.test.ts
describe('Dashboard Statistics', () => {
  it('should correctly calculate average score', async () => {
    const scores = [27, 28, 29]; // NSDA scores
    const expected = 56; // Average percentage
    // Test implementation
  });
  
  it('should use actual durations from database', async () => {
    // Test that duration_seconds is used, not hardcoded values
  });
  
  it('should handle all score formats after migration', async () => {
    // Test standardized score access
  });
});
```

#### 4.2 Add Monitoring
```typescript
// Add logging to track score format usage
const trackScoreFormat = (format: 'nsda' | 'json' | 'simple' | 'standardized') => {
  logger.info('Score format used', { format });
};
```

### Phase 5: Long-term Improvements (Future)

#### 5.1 Add Score Validation
```typescript
interface ScoreValidation {
  min: number;
  max: number;
  format: 'percentage' | 'nsda' | 'ten-point';
}

const validateScore = (score: number, validation: ScoreValidation): boolean => {
  return score >= validation.min && score <= validation.max;
};
```

#### 5.2 Implement Score History Tracking
```sql
CREATE TABLE score_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  speech_feedback_id UUID REFERENCES speech_feedback(id),
  score INTEGER NOT NULL,
  score_type TEXT NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5.3 Add Performance Metrics
- Track score improvement over time
- Calculate rolling averages
- Identify trending topics
- Generate performance insights

## Implementation Timeline

| Phase | Duration | Priority | Risk |
|-------|----------|----------|------|
| Phase 1: Immediate Fixes | 1-2 days | Critical | Low |
| Phase 2: Data Migration | 1 day | Critical | Medium |
| Phase 3: Dashboard Updates | 1 day | High | Low |
| Phase 4: Testing | 1 day | High | Low |
| Phase 5: Long-term | Ongoing | Medium | Low |

**Total: 4-5 days for critical improvements**

## Success Metrics

1. **Data Consistency**: 100% of records have `overall_score` populated
2. **Duration Accuracy**: Actual durations used, not estimates
3. **Performance**: Dashboard load time < 2 seconds
4. **Reliability**: Zero score calculation errors
5. **User Experience**: Consistent score display across all views

## Risk Mitigation

1. **Backup Strategy**: Full database backup before migration
2. **Rollback Plan**: Keep legacy score extraction as fallback
3. **Gradual Rollout**: Test on subset of users first
4. **Monitoring**: Alert on any score calculation failures
5. **Documentation**: Update all relevant documentation

## Dependencies

- `music-metadata-browser` or `ffprobe` for audio duration
- Database migration access
- Testing environment with production-like data
- Monitoring/logging infrastructure

## Next Steps

1. **Review and approve plan**
2. **Set up development environment**
3. **Implement Phase 1 fixes**
4. **Test on staging environment**
5. **Execute production migration**
6. **Monitor and validate results**