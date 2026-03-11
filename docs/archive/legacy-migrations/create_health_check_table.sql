-- Create a health_check table for connection testing
CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL PRIMARY KEY,
  status TEXT DEFAULT 'ok',
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT now(),
  message TEXT
);

-- Insert an initial record
INSERT INTO health_check (status, message)
VALUES ('ok', 'System is healthy')
ON CONFLICT DO NOTHING; 