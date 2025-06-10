import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Shield, RefreshCw, Trash2, Eye, AlertCircle } from 'lucide-react';
import { useRealtimeCollage } from '../hooks/useRealtimeCollage';
import Layout from '../components/layout/Layout';

const CollageModerationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  
  // Use custom hook for realtime management
  const { 
    currentCollage, 
    photos, 
    loading, 
    error, 
    isRealtimeConnected,
    refreshPhotos,
    deletePhoto
  } = useRealtimeCollage({ 
    collageId: id 
  });
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingPhotos, setDeletingPhotos] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);

  // Debug: Log photos changes
  React.useEffect(() => {
    console.log('🛡️ MODERATION: Photos updated - count:', photos.length);
  }, [photos.length]);

  const handleRefresh = async () => {
    if (!currentCollage?.id) return;
    
    setIsRefreshing(true);
    setFetchError(null);
    
    try {
      await refreshPhotos(currentCollage.id);
      console.log('🛡️ MODERATION: Photos refreshed successfully');
    } catch (error: any) {
      console.error('🛡️ MODERATION: Error refreshing photos:', error);
      setFetchError(error.message);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (deletingPhotos.has(photoId)) return;
    
    const confirmed = window.confirm('Delete this photo? It will be removed from all views immediately.');
    if (!confirmed) return;

    setDeletingPhotos(prev => new Set(prev).add(photoId));
    
    try {
      await deletePhoto(photoId);
      console.log('🗑️ Photo deleted successfully:', photoId);
    } catch (error: any) {
      console.error('🗑️ Error deleting photo:', error);
      alert('Failed to delete photo: ' + error.message);
    } finally {
      setDeletingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photoId);
        return newSet;
      });
    }
  };

  const openPhotoPreview = (photo: any) => {
    setSelectedPhoto(photo);
  };

  if (loading && !currentCollage) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-2 text-gray-400">Loading collage...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !currentCollage) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-white mb-4">Collage Not Found</h2>
            <p className="text-gray-400 mb-6">The collage you're looking for doesn't exist.</p>
            <Link
              to="/dashboard"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/dashboard"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-purple-400" />
                <h1 className="text-2xl font-bold text-white">Photo Moderation</h1>
              </div>
              <p className="text-gray-400 mt-1">{currentCollage.name}</p>
              <div className="flex items-center space-x-4 mt-2 text-sm">
                <span className="text-gray-400">Code: {currentCollage.code}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-400">{photos.length} photos</span>
                <span className="text-gray-400">•</span>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${
                    isRealtimeConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                  }`}></div>
                  <span className="text-gray-400">
                    {isRealtimeConnected ? 'Live Updates' : 'Polling'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            <Link
              to={`/collage/${currentCollage.code}`}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm"
            >
              View Live
            </Link>
          </div>
        </div>

        {/* Error Display */}
        {fetchError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center text-red-200">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Error: {fetchError}</span>
          </div>
        )}

        {/* Photo Grid */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6">
          {photos.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-xl font-bold text-white mb-2">No Photos Yet</h3>
              <p className="text-gray-400 mb-4">
                Photos uploaded to this collage will appear here for moderation.
              </p>
              <Link
                to={`/collage/${currentCollage.code}`}
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
              >
                Share Collage Code
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-gray-800 rounded-lg overflow-hidden border border-gray-600 hover:border-gray-500 transition-colors group"
                >
                  <div className="aspect-square relative">
                    <img
                      src={photo.url}
                      alt="Uploaded photo"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => openPhotoPreview(photo)}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/400x400?text=Error+Loading';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                      <button
                        onClick={() => openPhotoPreview(photo)}
                        className="p-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
                        title="View full size"
                      >
                        <Eye className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        disabled={deletingPhotos.has(photo.id)}
                        className="p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
                        title="Delete photo"
                      >
                        {deletingPhotos.has(photo.id) ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-400">
                      {new Date(photo.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Photo Preview Modal */}
        {selectedPhoto && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-4xl max-h-full bg-gray-900 rounded-lg border border-gray-600 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-600">
                <h3 className="text-lg font-bold text-white">Photo Preview</h3>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>
              <div className="p-4">
                <img
                  src={selectedPhoto.url}
                  alt="Full size preview"
                  className="max-w-full max-h-[70vh] object-contain mx-auto"
                />
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    Uploaded: {new Date(selectedPhoto.created_at).toLocaleString()}
                  </p>
                  <button
                    onClick={() => handleDeletePhoto(selectedPhoto.id)}
                    disabled={deletingPhotos.has(selectedPhoto.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-sm flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CollageModerationPage;