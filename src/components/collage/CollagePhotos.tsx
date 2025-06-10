import React, { useEffect } from 'react';
import { useCollageStore } from '../../store/collageStore';

type CollagePhotosProps = {
  collageId: string;
};

const CollagePhotos: React.FC<CollagePhotosProps> = ({ collageId }) => {
  // Get only the data we need to avoid dependency issues
  const photos = useCollageStore(state => state.photos);
  const loading = useCollageStore(state => state.loading);

  useEffect(() => {
    if (!collageId) return;
    
    // Use getState() to avoid dependency issues
    const store = useCollageStore.getState();
    
    // Fetch photos for this collage
    store.fetchPhotosByCollageId(collageId);
    
    // Setup realtime subscription for this collage
    store.setupRealtimeSubscription(collageId);
    
    // Cleanup on unmount or collageId change
    return () => {
      store.cleanupRealtimeSubscription();
    };
  }, [collageId]); // Only depend on collageId

  if (loading && photos.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <p className="mt-2 text-gray-400">Loading photos...</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-gray-700 rounded-lg bg-gray-900/50">
        <p className="text-gray-400">No photos in this collage yet.</p>
        <p className="mt-1 text-sm text-gray-500">Upload photos to see them here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <div 
          key={photo.id}
          className="aspect-square rounded-lg overflow-hidden border border-white/10 group"
        >
          <img 
            src={photo.url} 
            alt="Collage photo" 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        </div>
      ))}
    </div>
  );
};

export default CollagePhotos;