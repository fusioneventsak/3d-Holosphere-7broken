import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share2, Upload, Maximize2, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { useRealtimeCollage } from '../hooks/useRealtimeCollage';
import CollageScene from '../components/three/CollageScene';
import PhotoUploader from '../components/collage/PhotoUploader';

function SceneErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="bg-red-900/30 backdrop-blur-sm rounded-lg border border-red-500/50 p-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
      <h3 className="text-xl font-bold text-white mb-2">3D Scene Error</h3>
      <p className="text-red-200 mb-4 text-center max-w-md">
        WebGL error or too many photos. Try refreshing.
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
  
  // This hook will automatically handle realtime updates
  const { 
    currentCollage, 
    photos, 
    loading, 
    error, 
    isRealtimeConnected,
    refreshPhotos,
    debugInfo
  } = useRealtimeCollage({ 
    collageCode: code 
  });
  
  const [showUploader, setShowUploader] = useState(false);
  const [copied, setCopied] = useState(false);

  // Show loading state
  if (loading && !currentCollage) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-2 text-gray-400">Loading collage...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !currentCollage) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Collage Not Found</h2>
          <p className="text-gray-400 mb-6">
            The collage you're looking for doesn't exist.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Realtime Status Indicator */}
      <div className="fixed top-4 left-4 z-50">
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs border ${
          isRealtimeConnected 
            ? 'bg-green-900/50 text-green-300 border-green-500/30' 
            : 'bg-yellow-900/50 text-yellow-300 border-yellow-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isRealtimeConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
          }`}></div>
          <span>{isRealtimeConnected ? 'Live' : 'Polling'}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="fixed top-4 right-4 z-50 flex items-center space-x-2">
        <button
          onClick={refreshPhotos}
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
      </div>

      {/* Collage Info */}
      <div className="fixed bottom-4 left-4 z-50">
        <div className="bg-gray-900/80 text-white rounded-lg p-3 backdrop-blur-sm border border-gray-600">
          <h1 className="font-bold">{currentCollage.name}</h1>
          <p className="text-sm text-gray-400">
            Code: {currentCollage.code} • {photos.length} photos
          </p>
          <p className="text-xs text-gray-500">
            Last update: {new Date(debugInfo.lastUpdate).toLocaleTimeString()}
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
              onUploadComplete={() => {
                setShowUploader(false);
                console.log('📤 Upload completed, realtime should update UI');
              }}
            />
          </div>
        </div>
      )}

      {/* 3D Scene - This will automatically re-render when photos change */}
      <div className="w-full h-screen">
        <ErrorBoundary
          FallbackComponent={SceneErrorFallback}
          onReset={() => window.location.reload()}
          resetKeys={[currentCollage.id, photos.length]} // Re-mount scene when photos change
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