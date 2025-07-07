/**
 * Express router for speech feedback functionality
 */
import express from 'express';

const router = express.Router();

// Simple GET endpoint for testing
router.get('/api/speech-feedback', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Speech feedback endpoint is working' 
  });
});

export default router; 