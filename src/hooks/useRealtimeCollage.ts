import { useEffect, useRef } from 'react';
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
  
  // Store function refs to prevent dependency issues
  const fetchCollageByIdRef = useRef(store.fetchCollageById);
  const fetchCollageByCodeRef = useRef(store.fetchCollageByCode);
  const cleanupRef = useRef(store.cleanupRealtimeSubscription);
  const setupRef = useRef(store.setupRealtimeSubscription);

  // Update refs when functions change
  fetchCollageByIdRef.current = store.fetchCollageById;
  fetchCollageByCodeRef.current = store.fetchCollageByCode;
  cleanupRef.current = store.cleanupRealtimeSubscription;
  setupRef.current = store.setupRealtimeSubscription;

  // Main effect to fetch collage (realtime setup is handled in store)
  useEffect(() => {
    if (!autoConnect) return;

    const fetchCollage = async () => {
      try {
        if (collageId) {
          console.log('🪝 Hook: Fetching collage by ID:', collageId);
          await fetchCollageByIdRef.current(collageId);
        } else if (collageCode) {
          console.log('🪝 Hook: Fetching collage by code:', collageCode);
          await fetchCollageByCodeRef.current(collageCode);
        }
      } catch (error) {
        console.error('🪝 Hook: Error fetching collage:', error);
      }
    };

    fetchCollage();

    return () => {
      console.log('🪝 Hook: Cleaning up realtime subscription');
      cleanupRef.current();
    };
  }, [collageId, collageCode, autoConnect]);

  // Return store values
  return {
    currentCollage: store.currentCollage,
    photos: Array.isArray(store.photos) ? store.photos : [],
    loading: store.loading,
    error: store.error,
    isRealtimeConnected: store.isRealtimeConnected,
    refreshPhotos: store.refreshPhotos,
    deletePhoto: store.deletePhoto,
    uploadPhoto: store.uploadPhoto,
  };
};