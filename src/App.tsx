import React, { useState, useEffect } from 'react';
import { CollageViewer } from './components/CollageViewer';
import { PhotoUpload } from './components/PhotoUpload';
import { supabase, getCollageByCode } from './lib/supabase';

interface Photo {
  id: string;
  url: string;
  collage_id: string;
  created_at: string;
}

const App: React.FC = () => {
  const [collageCode, setCollageCode] = useState<string>('demo-collage');
  const [showUpload, setShowUpload] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [collageId, setCollageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch photos for upload component
  const fetchPhotos = async (code: string) => {
    try {
      setError(null);
      const collage = await getCollageByCode(code);
      setCollageId(collage.id);
      
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collage.id)
        .order('created_at', { ascending: true });

      if (photosError) throw photosError;
      setPhotos(photosData || []);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch photos');
      setPhotos([]);
      setCollageId(null);
    }
  };

  // Load photos when collage code changes
  useEffect(() => {
    if (collageCode) {
      fetchPhotos(collageCode);
    }
  }, [collageCode]);

  const handleUploadComplete = () => {
    console.log('Upload completed');
    // Refresh photos
    if (collageCode) {
      fetchPhotos(collageCode);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  return (
    <div className="w-full h-screen bg-black relative">
      {/* Header Controls */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-75 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <input
            type="text"
            value={collageCode}
            onChange={(e) => setCollageCode(e.target.value)}
            placeholder="Enter collage code"
            className="px-3 py-1 bg-gray-800 text-white border border-gray-600 rounded text-sm w-32"
          />
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            disabled={!collageId}
          >
            {showUpload ? 'Hide Upload' : 'Upload Photos'}
          </button>
        </div>
        
        {error && (
          <div className="text-red-400 text-xs mb-2">
            {error}
          </div>
        )}
        
        {showUpload && collageId && (
          <div className="w-64">
            <PhotoUpload
              collageId={collageId}
              photos={photos}
              onUploadComplete={handleUploadComplete}
              onDeletePhoto={handleDeletePhoto}
            />
          </div>
        )}
      </div>

      {/* Status Info */}
      <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-75 p-3 rounded-lg text-white text-sm">
        <div>Collage: {collageCode}</div>
        <div>Status: {collageId ? '✓ Connected' : '✗ Not Found'}</div>
        <div>Photos: {photos.length}</div>
      </div>

      {/* Main Collage Viewer */}
      {collageId ? (
        <CollageViewer collageCode={collageCode} />
      ) : (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Enter a Collage Code</h2>
            <p className="text-gray-400">Type a collage code above to view the 3D scene</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;