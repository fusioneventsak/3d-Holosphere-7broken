import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share2, Upload, Maximize2, RefreshCw, ArrowLeft, Eye } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { useRealtimeCollage } from '../hooks/useRealtimeCollage';
import { useSceneStore } from '../store/sceneStore';
import CollageScene from '../components/three/CollageScene';
import PhotoUploader from '../components/collage/PhotoUploader';
import Layout from '../components/layout/Layout';

// Error fallback component
function SceneErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="bg-red-900/30 backdrop-blur-sm rounded-lg border border-gray-500/50 p-6 flex flex-col items-center justify-center h-[calc(100vh-240px)]">
      <h3 className="text-xl font-bold text-white mb-2">3D Scene Error</h3>
      <p className="text-red-200 mb-4 text-center max-w-md">
        There was an error loading the 3D scene. Try refreshing the page.
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
  
  // Use the fixed useRealtimeCollage hook
  const { 
    currentCollage, 
    photos, 
    loading, 
    error, 
    isRealtimeConnected 
  } = useRealtimeCollage({ 
    collageCode: code 
  });

  const { settings } = useSceneStore();
  const [showUploader, setShowUploader] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const shareCollage = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentCollage?.name || 'Photo Collage',
          text: 'Check out this amazing 3D photo collage!',
          url: url,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      } catch (error) {
        console.log('Error copying to clipboard:', error);
      }
    }
  };

  if (loading && !currentCollage) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
            <p className="text-white">Loading collage...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !currentCollage) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Collage Not Found</h2>
            <p className="text-gray-400 mb-6">The collage code "{code}" doesn't exist.</p>
            <button
              onClick={() => navigate('/join')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              Try Another Code
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative h-screen overflow-hidden">
        {/* Header - Only show when not in fullscreen */}
        {!isFullscreen && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-black/50 backdrop-blur-sm border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => navigate('/join')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-white">{currentCollage.name}</h1>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-400">Code: {currentCollage.code}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-400">{photos.length} photos</span>
                      <span className="text-gray-400">•</span>
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${
                          isRealtimeConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                        }`}></div>
                        <span className="text-gray-400">
                          {isRealtimeConnected ? 'Live' : 'Polling'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowUploader(!showUploader)}
                    className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    title="Upload Photos"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                  
                  <button
                    onClick={() => navigate(`/photobooth/${currentCollage.code}`)}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    title="Open Photobooth"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  
                  <button
                    onClick={shareCollage}
                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    title="Share Collage"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    title="Toggle Fullscreen"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photo Uploader Sidebar */}
        {showUploader && !isFullscreen && (
          <div className="absolute top-16 right-0 w-80 h-[calc(100vh-64px)] bg-gray-900/95 backdrop-blur-sm border-l border-white/10 z-10 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Upload Photos</h3>
                <button
                  onClick={() => setShowUploader(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <PhotoUploader 
                collageId={currentCollage.id}
                onUploadComplete={() => {
                  // Photos will appear automatically via realtime
                  console.log('Upload completed, realtime should update the scene');
                }}
              />
            </div>
          </div>
        )}

        {/* Main 3D Scene */}
        <div className={`w-full h-full ${!isFullscreen ? 'pt-16' : ''}`}>
          <ErrorBoundary
            FallbackComponent={SceneErrorFallback}
            onReset={() => window.location.reload()}
            resetKeys={[currentCollage.id, photos.length]}
          >
            <CollageScene 
              settings={settings}
            />
          </ErrorBoundary>
        </div>

        {/* Fullscreen Exit Button */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-30 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
            title="Exit Fullscreen"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </Layout>
  );
};

export default CollageViewerPage;