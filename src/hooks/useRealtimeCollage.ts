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
  // Get store state - this will cause re-renders when state changes
  const {
    currentCollage,
    photos,
    loading,
    error,
    isRealtimeConnected,
    fetchCollageById,
    fetchCollageByCode,
    cleanupRealtimeSubscription,
    refreshPhotos,
    deletePhoto,
    uploadPhoto
  } = useCollageStore();

  // Track if we've already set up the connection
  const hasConnected = useRef(false);
  const [debugInfo, setDebugInfo] = useState({
    connectionAttempts: 0,
    lastUpdate: Date.now()
  });

  // Single effect to handle connection setup
  useEffect(() => {
    if (!autoConnect) return;
    
    // Prevent multiple connections
    if (hasConnected.current) return;
    
    const setupConnection = async () => {
      hasConnected.current = true;
      
      setDebugInfo(prev => ({ 
        ...prev, 
        connectionAttempts: prev.connectionAttempts + 1 
      }));
      
      try {
        if (collageId) {
          console.log('🪝 HOOK: Connecting to collage by ID:', collageId);
          await fetchCollageById(collageId);
        } else if (collageCode) {
          console.log('🪝 HOOK: Connecting to collage by code:', collageCode);
          await fetchCollageByCode(collageCode);
        }
      } catch (error) {
        console.error('🪝 HOOK: Connection error:', error);
        hasConnected.current = false; // Allow retry
      }
    };

    setupConnection();

    // Cleanup on unmount or when dependencies change
    return () => {
      console.log('🪝 HOOK: Cleaning up connection');
      hasConnected.current = false;
      cleanupRealtimeSubscription();
    };
  }, [collageId, collageCode, autoConnect]); // Only depend on primitive values

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
  }, [photos.length, photos, isRealtimeConnected]);

  // Manual refresh function
  const manualRefresh = async () => {
    if (currentCollage?.id) {
      console.log('🪝 HOOK: Manual refresh triggered');
      await refreshPhotos(currentCollage.id);
    }
  };

  // Return all the data components need
  return {
    // Core data
    currentCollage,
    photos: Array.isArray(photos) ? photos : [], // Safety check
    loading,
    error,
    isRealtimeConnected,
    
    // Actions
    refreshPhotos: manualRefresh,
    deletePhoto,
    uploadPhoto,
    
    // Debug info
    debugInfo
  };
};