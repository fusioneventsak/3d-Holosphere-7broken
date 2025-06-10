import React, { useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Share2, Upload, Maximize2, ChevronLeft, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { useRealtimeCollage } from '../hooks/useRealtimeCollage';
import CollageScene from '../components/three/CollageScene';
import PhotoUploader from '../components/collage/PhotoUploader';

// Error fallback component
function SceneErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="bg-red-900/30 backdrop-blur-sm rounded-lg border border-red-500/50 p-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
      <h3 className="text-xl font-bold text-white mb-2">3D Scene Error</h3>
      <p className="text-red-200 mb-4 text-center max-w-md">
        There was an error loading the 3D scene. This could be due to WebGL issues.
      </p>
      <pre className="bg-black/50 p-3 rounded text-red-300 text-xs max-w-full overflow-auto mb-4 max-h-32">
        {error.message}
      </pre>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

const CollageViewerPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  // Use custom hook for realtime management
  const { 
    currentCollage, 
    photos, 
    loading, 
    error, 
    isRealtimeConnected,
    refreshPhotos
  } = useRealtimeCollage({ 
    collageCode: code 
  });
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Debug: Log photos changes
  React.useEffect(() => {
    console.log('🔥 VIEWER: Photos updated - count:', photos.length);
    console.log('🔥 VIEWER: Realtime connected:', isRealtimeConnected);
  }, [photos.length, isRealtimeConnected]);

  const handleManualRefresh = useCallback(async () => {
    if (currentCollage?.id) {
      console.log('🔄 Manual refresh triggered');
      await refreshPhotos(currentCollage.id);
    }
  }, [currentCollage?.id, refreshPhotos]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setTimeout(() => setControlsVisible(false), 2000);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        setControlsVisible(true);
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  // Loading state
  if (loading && !currentCollage) {
    return (
      <div className="min-h-screen bg-black">
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-2 text-gray-400">Loading collage...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !currentCollage) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-white mb-4">Collage Not Found</h2>
            <p className="text-gray-400 mb-6">
              The collage you're looking for doesn't exist or might have been removed.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Realtime Status Indicator */}
      <div className="fixed top-4 left-4 z-50">
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${
          isRealtimeConnected 
            ? 'bg-green-900/50 text-green-300 border border-green-500/30' 
            : 'bg-yellow-900/50 text-yellow-300 border border-yellow-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isRealtimeConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
          }`}></div>
          <span>{isRealtimeConnected ? 'Live' : 'Polling'}</span>
        </div>
      </div>

      {/* Controls Overlay */}
      {controlsVisible && (
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-2">
          <button
            onClick={handleManualRefresh}
            className="p-2 bg-gray-900/80 hover:bg-gray-800/80 text-white rounded-md transition-colors backdrop-blur-sm border border-gray-600"
            title="Refresh photos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopyLink}
            className="p-2 bg-gray-900/80 hover:bg-gray-800/80 text-white rounded-md transition-colors backdrop-blur-sm border border-gray-600"
            title={copied ? 'Copied!' : 'Share link'}
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowUploader(!showUploader)}
            className="p-2 bg-purple-600/80 hover:bg-purple-700/80 text-white rounded-md transition-colors backdrop-blur-sm"
            title="Upload photo"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-gray-900/80 hover:bg-gray-800/80 text-white rounded-md transition-colors backdrop-blur-sm border border-gray-600"
            title="Toggle fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Collage Info */}
      <div className="fixed bottom-4 left-4 z-50">
        <div className="bg-gray-900/80 text-white rounded-lg p-3 backdrop-blur-sm border border-gray-600">
          <h1 className="font-bold">{currentCollage.name}</h1>
          <p className="text-sm text-gray-400">
            Code: {currentCollage.code} • {photos.length} photos
          </p>
        </div>
      </div>

      {/* Photo Uploader Modal */}
      {showUploader && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-600 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Upload Photo</h3>
              <button
                onClick={() => setShowUploader(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            <PhotoUploader 
              collageId={currentCollage.id} 
              onUploadComplete={() => setShowUploader(false)}
            />
          </div>
        </div>
      )}

      {/* 3D Scene */}
      <div className="w-full h-screen">
        <ErrorBoundary
          FallbackComponent={SceneErrorFallback}
          onReset={() => window.location.reload()}
          resetKeys={[currentCollage.id, photos.length]}
        >
          <CollageScene 
            photos={photos} 
            settings={currentCollage.settings} 
          />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default CollageViewerPage;