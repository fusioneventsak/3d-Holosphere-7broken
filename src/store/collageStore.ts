// src/store/collageStore.ts - OPTIMIZED FOR PERFORMANCE
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { nanoid } from 'nanoid';
import { RealtimeChannel } from '@supabase/supabase-js';
import { textureCache } from '../lib/textureCache';

// Helper function to get file URL
const getFileUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

// Helper for deep merging objects
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

// Default scene settings
const defaultSettings = {
  animationPattern: 'grid',
  photoCount: 100,
  animationSpeed: 50,
  cameraDistance: 15,
  cameraHeight: 8,
  cameraRotationSpeed: 20,
  photoSize: 1.0,
  photoBrightness: 1.0,
  backgroundColor: '#000000',
  backgroundGradient: true,
  backgroundGradientStart: '#1a1a2e',
  backgroundGradientEnd: '#16213e',
  backgroundGradientAngle: 45,
  floorColor: '#111111',
  showFloor: true,
  showGrid: true,
  ambientLightIntensity: 0.4,
  spotlightIntensity: 0.8,
  patterns: {
    grid: { enabled: true },
    float: { enabled: false },
    wave: { enabled: false },
    spiral: { enabled: false }
  }
};

export interface Photo {
  id: string;
  collage_id: string;
  url: string;
  created_at: string;
}

export interface Collage {
  id: string;
  name: string;
  code: string;
  created_at: string;
  settings: any;
}

export interface SceneSettings {
  animationPattern?: string;
  patterns?: any;
  photoCount?: number;
  animationSpeed?: number;
  cameraDistance?: number;
  cameraHeight?: number;
  cameraRotationSpeed?: number;
  photoSize?: number;
  photoBrightness?: number;
  backgroundColor?: string;
  backgroundGradient?: boolean;
  backgroundGradientStart?: string;
  backgroundGradientEnd?: string;
  backgroundGradientAngle?: number;
  floorColor?: string;
  showFloor?: boolean;
  showGrid?: boolean;
  ambientLightIntensity?: number;
  spotlightIntensity?: number;
  [key: string]: any;
}

// Optimized photo state with Map for O(1) lookups
interface PhotoState {
  byId: Map<string, Photo>;
  allIds: string[];
  lastUpdated: number;
}

interface CollageStore {
  // State
  photoState: PhotoState;
  photos: Photo[]; // Derived from photoState for backward compatibility
  currentCollage: Collage | null;
  loading: boolean;
  error: string | null;
  collages: Collage[];
  realtimeChannel: RealtimeChannel | null;
  isRealtimeConnected: boolean;
  lastRefreshTime: number;
  pollingInterval: NodeJS.Timeout | null;

  // Actions
  fetchCollages: () => Promise<void>;
  fetchCollageByCode: (code: string) => Promise<Collage | null>;
  fetchCollageById: (id: string) => Promise<Collage | null>;
  createCollage: (name: string) => Promise<Collage | null>;
  updateCollageSettings: (collageId: string, settings: Partial<SceneSettings>) => Promise<any>;
  uploadPhoto: (collageId: string, file: File) => Promise<Photo | null>;
  deletePhoto: (photoId: string) => Promise<void>;
  fetchPhotosByCollageId: (collageId: string) => Promise<void>;
  refreshPhotos: (collageId: string) => Promise<void>;
  
  // Real-time subscription methods
  setupRealtimeSubscription: (collageId: string) => void;
  cleanupRealtimeSubscription: () => void;
  
  // Internal methods
  addPhotoToState: (photo: Photo) => void;
  removePhotoFromState: (photoId: string) => void;
  startPolling: (collageId: string) => void;
  stopPolling: () => void;
}

export const useCollageStore = create<CollageStore>((set, get) => ({
  // Initial state
  photoState: {
    byId: new Map<string, Photo>(),
    allIds: [],
    lastUpdated: 0
  },
  get photos() {
    // Derived property that converts Map to array for backward compatibility
    return get().photoState.allIds.map(id => get().photoState.byId.get(id)!);
  },
  currentCollage: null,
  loading: false,
  error: null,
  collages: [],
  realtimeChannel: null,
  isRealtimeConnected: false,
  lastRefreshTime: 0,
  pollingInterval: null,

  // OPTIMIZED: Add photo to state with Map for O(1) lookups
  addPhotoToState: (photo: Photo) => {
    set((state) => {
      // Check if photo already exists
      if (state.photoState.byId.has(photo.id)) {
        console.log('🔄 Photo already exists in state:', photo.id);
        return state;
      }
      
      console.log('✅ Adding photo to state:', photo.id);
      
      // Create new Map to avoid mutation
      const newById = new Map(state.photoState.byId);
      newById.set(photo.id, photo);
      
      // Add to beginning of allIds array (most recent first)
      const newAllIds = [photo.id, ...state.photoState.allIds];
      
      return {
        photoState: {
          byId: newById,
          allIds: newAllIds,
          lastUpdated: Date.now()
        },
        lastRefreshTime: Date.now()
      };
    });
  },

  // OPTIMIZED: Remove photo from state with O(1) lookup
  removePhotoFromState: (photoId: string) => {
    console.log('🗑️ Removing photo from state:', photoId);
    set((state) => {
      // Check if photo exists
      if (!state.photoState.byId.has(photoId)) {
        console.log('⚠️ Photo not found in state for removal:', photoId);
        return state;
      }
      
      // Create new Map without the photo
      const newById = new Map(state.photoState.byId);
      newById.delete(photoId);
      
      // Filter out the ID
      const newAllIds = state.photoState.allIds.filter(id => id !== photoId);
      
      return {
        photoState: {
          byId: newById,
          allIds: newAllIds,
          lastUpdated: Date.now()
        },
        lastRefreshTime: Date.now()
      };
    });
  },

  // Enhanced realtime subscription with better error handling
  setupRealtimeSubscription: (collageId: string) => {
    // Clean up existing
    get().cleanupRealtimeSubscription();

    console.log('🚀 Setting up realtime for collage:', collageId);

    const channel = supabase
      .channel(`photos_${collageId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${collageId}`
        },
        (payload) => {
          console.log('🔔 Realtime event:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            console.log('➕ REALTIME INSERT:', payload.new.id);
            get().addPhotoToState(payload.new as Photo);
          } 
          else if (payload.eventType === 'DELETE' && payload.old) {
            console.log('🗑️ REALTIME DELETE:', payload.old.id);
            get().removePhotoFromState(payload.old.id);
          }
          else if (payload.eventType === 'UPDATE' && payload.new) {
            console.log('📝 REALTIME UPDATE:', payload.new.id);
            // Handle photo updates
            get().addPhotoToState(payload.new as Photo);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime connected successfully');
          set({ isRealtimeConnected: true });
          // Stop polling since realtime is working
          get().stopPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('❌ Realtime failed, falling back to polling');
          set({ isRealtimeConnected: false });
          get().startPolling(collageId);
        } else if (status === 'CLOSED') {
          console.log('🔌 Realtime connection closed');
          set({ isRealtimeConnected: false });
        }
      });

    set({ realtimeChannel: channel });

    // Fallback to polling after 5 seconds if realtime doesn't connect
    setTimeout(() => {
      if (!get().isRealtimeConnected) {
        console.log('⏰ Realtime timeout, starting polling fallback');
        get().startPolling(collageId);
      }
    }, 5000);
  },

  // Enhanced cleanup
  cleanupRealtimeSubscription: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      console.log('🧹 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
      set({ realtimeChannel: null, isRealtimeConnected: false });
    }
    get().stopPolling();
  },

  // Enhanced polling fallback
  startPolling: (collageId: string) => {
    get().stopPolling();
    
    console.log('🔄 Starting polling for collage:', collageId);
    
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .eq('collage_id', collageId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Check if data has changed by comparing IDs
        const currentIds = get().photoState.allIds;
        const newIds = (data || []).map(p => p.id);
        
        // Simple check if arrays have different lengths
        if (currentIds.length !== newIds.length) {
          console.log('📡 Polling detected count change:', currentIds.length, '->', newIds.length);
          get().updatePhotosFromArray(data as Photo[]);
        } else {
          // More expensive check if arrays have same length but different content
          const currentSet = new Set(currentIds);
          const hasChanges = newIds.some(id => !currentSet.has(id));
          
          if (hasChanges) {
            console.log('📡 Polling detected content change');
            get().updatePhotosFromArray(data as Photo[]);
          } else {
            console.log('📡 Polling check - no changes detected');
          }
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const interval = get().pollingInterval;
    if (interval) {
      console.log('🛑 Stopping polling');
      clearInterval(interval);
      set({ pollingInterval: null });
    }
  },

  // OPTIMIZED: Update photos from array with diffing
  updatePhotosFromArray: (photos: Photo[]) => {
    set((state) => {
      const currentState = state.photoState;
      const newById = new Map(currentState.byId);
      const newAllIds: string[] = [];
      
      // Process all photos
      for (const photo of photos) {
        newById.set(photo.id, photo);
        newAllIds.push(photo.id);
      }
      
      // Find deleted photos
      const newIdSet = new Set(newAllIds);
      const deletedIds = currentState.allIds.filter(id => !newIdSet.has(id));
      
      // Remove deleted photos
      for (const id of deletedIds) {
        newById.delete(id);
      }
      
      return {
        photoState: {
          byId: newById,
          allIds: newAllIds,
          lastUpdated: Date.now()
        },
        lastRefreshTime: Date.now()
      };
    });
  },

  refreshPhotos: async (collageId: string) => {
    try {
      console.log('🔄 Refreshing photos for collage:', collageId);
      
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('📸 Refreshed photos count:', data?.length || 0);
      
      // Use optimized update method
      get().updatePhotosFromArray(data as Photo[]);
      
      set({ error: null });
    } catch (error: any) {
      console.error('❌ Refresh photos error:', error);
      set({ error: error.message });
      throw error;
    }
  },

  fetchPhotosByCollageId: async (collageId: string) => {
    try {
      console.log('📸 Fetching photos for collage:', collageId);
      
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('📸 Fetched photos:', data?.length || 0);
      
      // Use optimized update method
      get().updatePhotosFromArray(data as Photo[]);
      
      set({ lastRefreshTime: Date.now() });
    } catch (error: any) {
      console.error('❌ Fetch photos error:', error);
      set({ error: error.message });
      throw error;
    }
  },

  fetchCollages: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('collages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ collages: data as Collage[], loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchCollageByCode: async (code: string) => {
    set({ loading: true, error: null });
    try {
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .select('*')
        .eq('code', code)
        .single();

      if (collageError) throw collageError;

      const { data: settings } = await supabase
        .from('collage_settings')
        .select('settings')
        .eq('collage_id', collage.id)
        .single();

      const collageWithSettings = {
        ...collage,
        settings: settings?.settings ? deepMerge(defaultSettings, settings.settings) : defaultSettings
      } as Collage;

      set({ currentCollage: collageWithSettings, loading: false });
      
      // Fetch photos and setup subscription
      await get().fetchPhotosByCollageId(collage.id);
      get().setupRealtimeSubscription(collage.id);
      
      return collageWithSettings;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  fetchCollageById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .select('*')
        .eq('id', id)
        .single();

      if (collageError) throw collageError;

      const { data: settings } = await supabase
        .from('collage_settings')
        .select('settings')
        .eq('collage_id', id)
        .single();

      const collageWithSettings = {
        ...collage,
        settings: settings?.settings ? deepMerge(defaultSettings, settings.settings) : defaultSettings
      } as Collage;

      set({ currentCollage: collageWithSettings, loading: false });
      
      // Fetch photos and setup subscription
      await get().fetchPhotosByCollageId(id);
      get().setupRealtimeSubscription(id);
      
      return collageWithSettings;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  createCollage: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const code = nanoid(8).toUpperCase();
      
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .insert([{ name, code }])
        .select()
        .single();

      if (collageError) throw collageError;

      const { data: settings, error: settingsError } = await supabase
        .from('collage_settings')
        .insert([{ 
          collage_id: collage.id, 
          settings: defaultSettings 
        }])
        .select()
        .single();

      if (settingsError) throw settingsError;

      const collageWithSettings = {
        ...collage,
        settings: defaultSettings
      } as Collage;

      set((state) => ({
        collages: [collageWithSettings, ...state.collages],
        loading: false
      }));

      return collageWithSettings;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  updateCollageSettings: async (collageId: string, settings: Partial<SceneSettings>) => {
    try {
      const currentCollage = get().currentCollage;
      if (!currentCollage) throw new Error('No current collage');

      const mergedSettings = deepMerge(currentCollage.settings, settings);

      const { data, error } = await supabase
        .from('collage_settings')
        .update({ settings: mergedSettings })
        .eq('collage_id', collageId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        currentCollage: state.currentCollage ? {
          ...state.currentCollage,
          settings: mergedSettings
        } : null
      }));

      return data;
    } catch (error: any) {
      console.error('Failed to update collage settings:', error.message);
      throw error;
    }
  },

  // Enhanced upload with better error handling
  uploadPhoto: async (collageId: string, file: File) => {
    try {
      console.log('📤 Starting photo upload:', file.name);
      
      // Validation
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 10MB limit');
      }

      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(file.type)) {
        throw new Error('Invalid file type. Only images are supported.');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${collageId}/${nanoid()}.${fileExt}`;

      console.log('📤 Uploading to storage:', fileName);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ File uploaded to storage:', uploadData.path);

      // Get public URL
      const publicUrl = getFileUrl('photos', uploadData.path);
      console.log('🔗 Public URL:', publicUrl);

      // Insert photo record
      const { data: photo, error: dbError } = await supabase
        .from('photos')
        .insert([{
          collage_id: collageId,
          url: publicUrl
        }])
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database insert error:', dbError);
        // Clean up uploaded file if database insert fails
        await supabase.storage.from('photos').remove([uploadData.path]);
        throw dbError;
      }

      console.log('✅ Photo record created:', photo.id);
      console.log('🔔 Realtime should now broadcast this to all clients');
      
      // Preload the texture into cache for immediate use
      textureCache.getTexture(publicUrl).catch(console.error);
      
      return photo as Photo;
    } catch (error: any) {
      console.error('❌ Upload photo error:', error);
      throw error;
    }
  },

  // Enhanced delete with better error handling
  deletePhoto: async (photoId: string) => {
    try {
      console.log('🗑️ Starting photo deletion:', photoId);
      
      // Optimistically remove from state for responsive UI
      get().removePhotoFromState(photoId);
      
      // First, get the photo to find the storage path
      const { data: photo, error: fetchError } = await supabase
        .from('photos')
        .select('url')
        .eq('id', photoId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching photo for deletion:', fetchError);
        // If the error is "no rows returned", the photo might already be deleted
        if (fetchError.code === 'PGRST116') {
          console.log('🔍 Photo not found in database, might already be deleted');
          return;
        } else {
          throw fetchError;
        }
      }

      // Extract storage path from URL
      const url = new URL(photo.url);
      const pathParts = url.pathname.split('/');
      const storagePath = pathParts.slice(-2).join('/'); // Get collage_id/filename

      console.log('🗑️ Deleting from storage:', storagePath);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([storagePath]);

      if (storageError) {
        console.warn('⚠️ Storage deletion warning:', storageError);
        // Don't throw here - continue with database deletion
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (dbError) {
        console.error('❌ Database deletion error:', dbError);
        throw dbError;
      }

      console.log('✅ Photo deleted successfully:', photoId);
      console.log('🔔 Realtime should now broadcast deletion to all clients');
      
      // Remove from texture cache
      if (photo.url) {
        textureCache.dispose(photo.url);
      }
    } catch (error: any) {
      console.error('❌ Delete photo error:', error);
      throw error;
    }
  }
}));