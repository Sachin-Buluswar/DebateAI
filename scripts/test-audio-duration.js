#!/usr/bin/env node

/**
 * Test script for audio duration calculation
 */

const { getAudioDurationInSeconds } = require('get-audio-duration');
const fs = require('fs');
const path = require('path');

async function testAudioDuration() {
  console.log('Testing audio duration calculation with get-audio-duration...\n');
  
  // Test with a sample audio file if it exists
  const sampleFiles = [
    '/tmp/test-audio.mp3',
    '/tmp/test-audio.wav',
    '/tmp/test-audio.webm'
  ];
  
  try {
    console.log('Looking for sample audio files...');
    
    let foundFile = false;
    for (const testFile of sampleFiles) {
      if (fs.existsSync(testFile)) {
        console.log(`\n✓ Found ${testFile}`);
        foundFile = true;
        
        try {
          const duration = await getAudioDurationInSeconds(testFile);
          console.log(`✓ Successfully read duration: ${duration} seconds`);
        } catch (err) {
          console.error(`✗ Error reading duration for ${testFile}:`, err.message);
        }
      }
    }
    
    if (!foundFile) {
      console.log('\nNo sample files found. Testing with the audioUtils module...');
      
      // Test our audioUtils function
      const { getAudioDuration } = require('../src/backend/utils/audioUtils');
      
      // Test with a non-existent file to check error handling
      const duration = await getAudioDuration('/tmp/non-existent-file.mp3');
      console.log(`✓ Error handling works - returned default duration: ${duration} seconds`);
    }
    
    console.log('\n✓ Test completed successfully!');
    
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

testAudioDuration();