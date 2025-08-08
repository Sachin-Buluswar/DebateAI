# Training Plan Feature Documentation

## Overview
The Training Plan feature provides personalized practice exercises and detailed HOW-TO feedback for debate students based on their skill level and identified weaknesses.

## Key Components

### 1. Enhanced HOW-TO Feedback
All feedback suggestions now follow this format:
- **WHAT**: The specific technique or skill to improve
- **HOW**: Step-by-step instructions (2-3 clear steps)
- **WHEN**: Context for when to apply the technique
- **PRACTICE**: Specific drill with frequency/duration

Example:
```
"HOW TO improve signposting: 
1) Start each contention with 'My [first/second] argument is...'
2) Use transitional phrases like 'This matters because...'
3) Practice by recording your contentions with clear markers
Do this drill for 10 minutes before each practice round."
```

### 2. Personalized Training Plans

Training plans are automatically generated based on:
- **Skill Level**: Novice, Intermediate, or Advanced
- **Identified Weaknesses**: From speech analysis
- **Speech Type**: Specific requirements of the speech

Each training plan includes:
- **2-5 Practice Exercises**: Targeted drills with instructions
- **Weekly Goals**: 3 specific objectives to achieve
- **Progress Tracking**: How to measure improvement

### 3. Skill Level Adaptation

#### Novice (First Year)
- Focus on fundamentals: flowing, time management, basic rebuttals
- Very detailed instructions with examples
- 5-10 minute exercises
- Encouraging language
- Score range: 25-27

#### Intermediate (1-2 Years)
- Focus on strategy: weighing, impact calc, cross-examination
- Balanced detail with assumed knowledge
- 10-15 minute exercises
- Self-assessment metrics
- Score range: 26-29

#### Advanced (Varsity Level)
- Focus on meta-strategy: judge adaptation, crystallization
- Concise but sophisticated guidance
- 15-20 minute exercises
- Tournament prep elements
- Score range: 28-30

## Technical Implementation

### Data Structure
```typescript
trainingPlan: {
  exercises: Array<{
    title: string;
    focus: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    duration: string;
    instructions: string[];
    example?: string;
    metrics?: string[];
  }>;
  weeklyGoals?: string[];
  progressTracking?: string;
}
```

### Files Modified
1. **Backend Service**: `src/backend/modules/speechFeedback/speechFeedbackService.ts`
   - Added `getTrainingPlanInstructions()` function
   - Enhanced prompt engineering for HOW-TO instructions
   - Skill-level specific training generation

2. **UI Component**: `src/components/feedback/TrainingSection.tsx`
   - New component for displaying training plans
   - Collapsible exercise cards
   - Visual difficulty indicators

3. **Type Definitions**: `src/types/index.ts`
   - Added `trainingPlan` to feedback structure

4. **Utilities**: `src/utils/feedbackUtils.ts`
   - Updated markdown conversion for training plans

5. **Display Page**: `src/app/(authenticated)/speech-feedback/[id]/page.tsx`
   - Integrated TrainingSection component
   - Updated PDF export to include training plans

6. **PDF Export**: `src/lib/pdf/exportFeedbackPDF.ts`
   - Added styling for training plan sections
   - Page break before training section

## User Experience

### Viewing Training Plans
1. Upload speech for feedback
2. Select skill level (Novice/Intermediate/Advanced)
3. Receive feedback with embedded training plan
4. View exercises in collapsible cards
5. Export to PDF for offline practice

### Training Plan Display
- **Exercise Cards**: Color-coded by difficulty
- **Instructions**: Step-by-step with examples
- **Success Metrics**: Clear measurement criteria
- **Weekly Goals**: Achievable objectives
- **Progress Tracking**: How to measure improvement

## PDF Export Format
```
[Regular Feedback Sections]
--- Page Break ---
### Personalized Training Plan
#### Practice Exercises
Exercise 1: [Title]
- Focus: [Skill area]
- Duration: [Time]
- Instructions:
  1. Step one...
  2. Step two...

#### Weekly Goals
1. Goal one
2. Goal two

#### Progress Tracking
[How to measure improvement]
```

## Benefits
1. **Actionable Feedback**: Students know exactly HOW to improve
2. **Skill-Appropriate**: Exercises match experience level
3. **Measurable Progress**: Clear metrics for improvement
4. **Practice-Oriented**: Specific drills for skill development
5. **Comprehensive Export**: Full training plan in PDF

## Future Enhancements
- Track completion of exercises
- Progress visualization over time
- Video demonstrations of exercises
- Peer review of practice recordings
- Gamification elements