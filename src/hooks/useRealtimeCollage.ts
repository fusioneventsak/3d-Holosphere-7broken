import { useEffect, useState, useRef } from 'react';
import { useCollageStore } from '../store/collageStore';

interface UseRealtimeCollageOptions {
  collageId?: string;
  collageCode?: string;
  autoConnect?: boolean;
}

export const useRealtimeCollage = ({ 
  collageId, 
  collageCode, 
  autoConnect = true 
}: UseRealtimeCollageOptions) => {
  const store = useCollageStore();
  const hasConnected = useRef(false);
  
  // STABLE PHOTO COUNT - Only track count, not array reference
  const [stablePhotoCount, setStablePhotoCount] = useState(0);
  
  // Update stable photo count when photos change
  useEffect(() => {
    const currentCount = Array.isArray(store.photos) ? store.photos.length : 0;
    setStablePhotoCount(currentCount);
  }, [store.photos]);

  // Connection setup (unchanged)
  useEffect(() => {
    if (!autoConnect || hasConnected.current) return;
    
    const setupConnection = async () => {
      hasConnected.current = true;
      
      try {
        if (collageId) {
          console.log('🪝 HOOK: Connecting to collage by ID:', collageId);
          await store.fetchCollageById(collageId);
        } else if (collageCode) {
          console.log('🪝 HOOK: Connecting to collage by code:', collageCode);
          await store.fetchCollageByCode(collageCode);
        }
      } catch (error) {
        console.error('🪝 HOOK: Connection error:', error);
        hasConnected.current = false;
      }
    };

    setupConnection();

    return () => {
      console.log('🪝 HOOK: Cleaning up connection');
      hasConnected.current = false;
      store.cleanupRealtimeSubscription();
    };
  }, [collageId, collageCode, autoConnect, store]);

  // Debug info state
  const [debugInfo, setDebugInfo] = useState({
    connectionAttempts: 0,
    lastUpdate: Date.now()
  });

  // Update debug info when photos change
  useEffect(() => {
    if (store.photos.length > 0) {
      console.log('🪝 HOOK: Photos updated!', {
        count: store.photos.length,
        ids: store.photos.slice(0, 3).map(p => p.id.slice(-4)), // Show first 3
        realtime: store.isRealtimeConnected
      });
      
      setDebugInfo(prev => ({ 
        ...prev, 
        lastUpdate: Date.now() 
      }));
    }
  }, [store.photos, store.isRealtimeConnected]);

  // Manual refresh function
  const manualRefresh = async () => {
    if (store.currentCollage?.id) {
      console.log('🪝 HOOK: Manual refresh triggered');
      await store.refreshPhotos(store.currentCollage.id);
    }
  };

  // Return all the data components need
  return {
    // Core data
    currentCollage: store.currentCollage,
    photos: Array.isArray(store.photos) ? store.photos : [], // Safety check
    photoCount: stablePhotoCount, // Stable count for ErrorBoundary
    loading: store.loading,
    error: store.error,
    isRealtimeConnected: store.isRealtimeConnected,
    
    // Actions
    refreshPhotos: manualRefresh,
    deletePhoto: store.deletePhoto,
    uploadPhoto: store.uploadPhoto,
    
    // Debug info
    debugInfo
  };
};