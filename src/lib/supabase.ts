import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Photo upload helper
export const uploadPhoto = async (file: File, collageId: string) => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${collageId}/${Date.now()}.${fileExt}`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);

    // Save to database
    const { data: photoData, error: dbError } = await supabase
      .from('photos')
      .insert({
        collage_id: collageId,
        url: publicUrl
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return photoData;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
};

// Photo deletion helper
export const deletePhoto = async (photoId: string, photoUrl: string) => {
  try {
    // Extract file path from URL
    const urlParts = photoUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const collageId = urlParts[urlParts.length - 2];
    const filePath = `${collageId}/${fileName}`;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('photos')
      .remove([filePath]);

    if (storageError) {
      console.warn('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) throw dbError;

    return true;
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw error;
  }
};

// Get collage by code
export const getCollageByCode = async (code: string) => {
  const { data, error } = await supabase
    .from('collages')
    .select('*')
    .eq('code', code)
    .single();

  if (error) throw error;
  return data;
};

// Create new collage
export const createCollage = async (name: string, code: string) => {
  const { data, error } = await supabase
    .from('collages')
    .insert({ name, code })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Update collage settings
export const updateCollageSettings = async (collageId: string, settings: any) => {
  const { data, error } = await supabase
    .from('collage_settings')
    .upsert({
      collage_id: collageId,
      settings,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};