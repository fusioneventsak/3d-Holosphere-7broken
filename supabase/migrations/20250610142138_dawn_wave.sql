/*
  # Enable Realtime for Photos Table
  
  This migration enables realtime subscriptions for the photos table
  to ensure instant updates across all clients.
  
  1. Enable replica identity FULL for tables
  2. Add tables to realtime publication if not already members
  3. Grant necessary permissions
*/

-- Enable replica identity FULL for photos table
-- This ensures we get complete row data (including old values) in realtime events
ALTER TABLE photos REPLICA IDENTITY FULL;

-- Enable realtime for photos table - only if not already a member
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'photos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE photos;
    RAISE NOTICE 'Added photos table to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'photos table is already a member of supabase_realtime publication';
  END IF;
END $$;

-- Also enable for collages table
ALTER TABLE collages REPLICA IDENTITY FULL;

-- Add collages to publication if not already a member
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'collages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE collages;
    RAISE NOTICE 'Added collages table to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'collages table is already a member of supabase_realtime publication';
  END IF;
END $$;

-- Enable for collage_settings
ALTER TABLE collage_settings REPLICA IDENTITY FULL;

-- Add collage_settings to publication if not already a member
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'collage_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE collage_settings;
    RAISE NOTICE 'Added collage_settings table to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'collage_settings table is already a member of supabase_realtime publication';
  END IF;
END $$;

-- Grant necessary permissions for realtime
GRANT SELECT ON photos TO postgres, anon, authenticated;
GRANT SELECT ON collages TO postgres, anon, authenticated;  
GRANT SELECT ON collage_settings TO postgres, anon, authenticated;

-- Verify all tables are in the publication
DO $$
BEGIN
  RAISE NOTICE 'Realtime publication status:';
  
  IF EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'photos'
  ) THEN
    RAISE NOTICE 'photos: ✓ (in publication)';
  ELSE
    RAISE NOTICE 'photos: ✗ (not in publication)';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'collages'
  ) THEN
    RAISE NOTICE 'collages: ✓ (in publication)';
  ELSE
    RAISE NOTICE 'collages: ✗ (not in publication)';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'collage_settings'
  ) THEN
    RAISE NOTICE 'collage_settings: ✓ (in publication)';
  ELSE
    RAISE NOTICE 'collage_settings: ✗ (not in publication)';
  END IF;
END $$;