import { useEffect, useState, useRef, useCallback } from 'react';
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
  // Get store state only for data that needs to trigger re-renders
  const currentCollage = useCollageStore(state => state.currentCollage);
  const photos = useCollageStore(state => state.photos);
  const loading = useCollageStore(state => state.loading);
  const error = useCollageStore(state => state.error);
  const isRealtimeConnected = useCollageStore(state => state.isRealtimeConnected);
  
  // Track if we've already set up the connection for this specific ID/code
  const connectionKeyRef = useRef<string | null>(null);
  const [debugInfo, setDebugInfo] = useState({
    connectionAttempts: 0,
    lastUpdate: Date.now()
  });

  // Effect to handle connection setup - avoid store method dependencies
  useEffect(() => {
    if (!autoConnect) return;
    
    // Create a unique key for this connection
    const currentKey = collageId || collageCode;
    if (!currentKey) return;
    
    // Don't reconnect if we're already connected to the same collage
    if (connectionKeyRef.current === currentKey) {
      return;
    }
    
    console.log('🪝 HOOK: Setting up new connection for:', currentKey);
    connectionKeyRef.current = currentKey;
    
    // Setup the connection using the store's getState method to avoid dependency issues
    const setupConnection = async () => {
      try {
        setDebugInfo(prev => ({ 
          ...prev, 
          connectionAttempts: prev.connectionAttempts + 1 
        }));
        
        const store = useCollageStore.getState();
        
        if (collageId) {
          console.log('🪝 HOOK: Connecting to collage by ID:', collageId);
          await store.fetchCollageById(collageId);
        } else if (collageCode) {
          console.log('🪝 HOOK: Connecting to collage by code:', collageCode);
          await store.fetchCollageByCode(collageCode);
        }
      } catch (error) {
        console.error('🪝 HOOK: Connection error:', error);
        // Reset connection key on failure so we can retry
        connectionKeyRef.current = null;
      }
    };

    setupConnection();

    // Cleanup function
    return () => {
      console.log('🪝 HOOK: Cleaning up connection for:', currentKey);
      connectionKeyRef.current = null;
      useCollageStore.getState().cleanupRealtimeSubscription();
    };
  }, [collageId, collageCode, autoConnect]); // Only primitive dependencies

  // Debug effect to track photo changes
  useEffect(() => {
    if (photos.length > 0) {
      console.log('🪝 HOOK: Photos updated!', {
        count: photos.length,
        ids: photos.slice(0, 3).map(p => p.id.slice(-4)), // Show first 3
        realtime: isRealtimeConnected
      });
      
      setDebugInfo(prev => ({ 
        ...prev, 
        lastUpdate: Date.now() 
      }));
    }
  }, [photos.length, isRealtimeConnected]);

  // Manual refresh function with stable reference
  const manualRefresh = useCallback(async () => {
    if (currentCollage?.id) {
      console.log('🪝 HOOK: Manual refresh triggered');
      await useCollageStore.getState().refreshPhotos(currentCollage.id);
    }
  }, [currentCollage?.id]); // Only depend on the ID

  // Create stable action functions
  const deletePhotoAction = useCallback((photoId: string) => {
    return useCollageStore.getState().deletePhoto(photoId);
  }, []);

  const uploadPhotoAction = useCallback((collageId: string, file: File) => {
    return useCollageStore.getState().uploadPhoto(collageId, file);
  }, []);

  // Return all the data components need
  return {
    // Core data
    currentCollage,
    photos: Array.isArray(photos) ? photos : [], // Safety check
    loading,
    error,
    isRealtimeConnected,
    
    // Actions with stable references
    refreshPhotos: manualRefresh,
    deletePhoto: deletePhotoAction,
    uploadPhoto: uploadPhotoAction,
    
    // Debug info
    debugInfo
  };
};