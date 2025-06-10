/*
  # Enable Realtime for Photos Table
  
  This migration enables realtime subscriptions for the photos table
  to ensure instant updates across all clients.
  
  1. Enable replica identity FULL for all tables
  2. Safely add tables to realtime publication
  3. Grant necessary permissions
*/

-- Enable replica identity FULL for all tables (safe to run multiple times)
ALTER TABLE photos REPLICA IDENTITY FULL;
ALTER TABLE collages REPLICA IDENTITY FULL;
ALTER TABLE collage_settings REPLICA IDENTITY FULL;

-- Safely add photos table to publication if not already a member
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

-- Safely add collages table to publication if not already a member
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

-- Safely add collage_settings table to publication if not already a member
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

-- Verify final status of all tables in the publication
DO $$
DECLARE
  tables_status TEXT := '';
BEGIN
  -- Check photos table
  IF EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'photos'
  ) THEN
    tables_status := tables_status || 'photos: ✓ (in publication)' || E'\n';
  ELSE
    tables_status := tables_status || 'photos: ✗ (not in publication)' || E'\n';
  END IF;
  
  -- Check collages table
  IF EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'collages'
  ) THEN
    tables_status := tables_status || 'collages: ✓ (in publication)' || E'\n';
  ELSE
    tables_status := tables_status || 'collages: ✗ (not in publication)' || E'\n';
  END IF;
  
  -- Check collage_settings table
  IF EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'collage_settings'
  ) THEN
    tables_status := tables_status || 'collage_settings: ✓ (in publication)';
  ELSE
    tables_status := tables_status || 'collage_settings: ✗ (not in publication)';
  END IF;
  
  RAISE NOTICE 'Realtime Publication Status: %', tables_status;
END $$;