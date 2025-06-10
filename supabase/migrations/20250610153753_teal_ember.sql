/*
  # Enable Realtime for Collage Tables
  
  1. Changes
    - Sets REPLICA IDENTITY FULL for all tables to ensure complete data in change events
    - Adds tables to supabase_realtime publication with proper existence checks
    - Grants necessary permissions for realtime functionality
    
  2. Tables Modified
    - photos
    - collages
    - collage_settings
*/

-- Enable replica identity FULL for all tables (safe to run multiple times)
ALTER TABLE photos REPLICA IDENTITY FULL;
ALTER TABLE collages REPLICA IDENTITY FULL;
ALTER TABLE collage_settings REPLICA IDENTITY FULL;

-- Create a function to safely add tables to the publication
CREATE OR REPLACE FUNCTION add_table_to_realtime_if_not_exists(table_name text)
RETURNS void AS $$
BEGIN
  -- Check if table is already in the publication
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = table_name
  ) THEN
    -- Use dynamic SQL to add the table to the publication
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
    RAISE NOTICE 'Added % table to supabase_realtime publication', table_name;
  ELSE
    RAISE NOTICE '% table is already a member of supabase_realtime publication', table_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Safely add tables to the publication
SELECT add_table_to_realtime_if_not_exists('photos');
SELECT add_table_to_realtime_if_not_exists('collages');
SELECT add_table_to_realtime_if_not_exists('collage_settings');

-- Drop the function after use
DROP FUNCTION add_table_to_realtime_if_not_exists;

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