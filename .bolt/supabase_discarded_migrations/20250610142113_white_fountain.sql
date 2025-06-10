/*
  # Enable Realtime for Photos Table
  
  This migration enables realtime subscriptions for the photos table
  to ensure instant updates across all clients.
  
  1. Enable realtime on photos table
  2. Set replica identity to FULL to get complete row data in events
  3. Add to realtime publication
  4. Verify permissions
*/

-- Enable replica identity FULL for photos table
-- This ensures we get complete row data (including old values) in realtime events
ALTER TABLE photos REPLICA IDENTITY FULL;

-- Enable realtime for photos table
-- This adds the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE photos;

-- Verify the table is in the publication
-- (This is just for debugging - you can remove this in production)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'photos'
  ) THEN
    RAISE NOTICE 'SUCCESS: photos table is now in realtime publication';
  ELSE
    RAISE NOTICE 'WARNING: photos table is NOT in realtime publication';
  END IF;
END $$;

-- Also enable for collages table if you want real-time collage updates
ALTER TABLE collages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE collages;

-- Enable for collage_settings if you want real-time settings updates
ALTER TABLE collage_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE collage_settings;

-- Grant necessary permissions for realtime
GRANT SELECT ON photos TO postgres, anon, authenticated;
GRANT SELECT ON collages TO postgres, anon, authenticated;  
GRANT SELECT ON collage_settings TO postgres, anon, authenticated;