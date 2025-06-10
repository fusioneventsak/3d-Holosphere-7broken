import React, { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings, Image, Shield } from 'lucide-react';
import { useRealtimeCollage } from '../hooks/useRealtimeCollage';
import { useCollageStore } from '../store/collageStore';
import { useSceneStore } from '../store/sceneStore';
import { ErrorBoundary } from 'react-error-boundary';
import Layout from '../components/layout/Layout';
import SceneSettings from '../components/collage/SceneSettings';
import CollageScene from '../components/three/CollageScene';
import PhotoUploader from '../components/collage/PhotoUploader';
import CollagePhotos from '../components/collage/CollagePhotos';

type Tab = 'settings' | 'photos';

// Error fallback component
function SceneErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="bg-red-900/30 backdrop-blur-sm rounded-lg border border-gray-500/50 p-6 flex flex-col items-center justify-center h-[calc(100vh-240px)]">
      <h3 className="text-xl font-bold text-white mb-2">3D Scene Error</h3>
      <p className="text-red-200 mb-4 text-center max-w-md">
        There was an error loading the 3D scene. Try reducing the photo count in settings.
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

const CollageEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Use custom hook for realtime management
  const { 
    currentCollage, 
    photos, 
    loading, 
    error, 
    isRealtimeConnected 
  } = useRealtimeCollage({ 
    collageId: id 
  });

  // Get additional functions from store
  const { updateCollageSettings } = useCollageStore();
  const { settings, updateSettings } = useSceneStore();
  
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Debug: Log photos changes
  React.useEffect(() => {
    console.log('🎨 EDITOR: Photos updated - count:', photos.length);
  }, [photos.length]);

  // Update scene store when collage settings change
  React.useEffect(() => {
    if (currentCollage?.settings) {
      console.log('🎨 EDITOR: Updating scene store with collage settings');
      updateSettings(currentCollage.settings, false);
    }
  }, [currentCollage?.settings, updateSettings]);

  // Auto-save settings changes with debouncing
  const handleSettingsChange = async (newSettings: any) => {
    if (!currentCollage) return;

    // Update local scene store immediately for responsive UI
    updateSettings(newSettings, false);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaving(true);

    // Debounce the save operation
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateCollageSettings(currentCollage.id, newSettings);
        console.log('✅ Settings auto-saved successfully');
      } catch (error) {
        console.error('❌ Failed to save settings:', error);
      } finally {
        setSaving(false);
      }
    }, 1000);
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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
              <h1 className="text-2xl font-bold text-white">{currentCollage.name}</h1>
              <div className="flex items-center space-x-4 mt-1 text-sm">
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
                {saving && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-yellow-400">Saving...</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Link
              to={`/collage/${currentCollage.code}`}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm"
            >
              View Live
            </Link>
            <Link
              to={`/collage/${currentCollage.id}/moderation`}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
            >
              <Shield className="w-4 h-4" />
              <span>Moderate</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Controls */}
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => setActiveTab('photos')}
                  className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'photos'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Image className="w-4 h-4" />
                  <span>Photos</span>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'settings' && (
              <SceneSettings
                settings={settings}
                onChange={handleSettingsChange}
                saving={saving}
              />
            )}

            {activeTab === 'photos' && (
              <div className="space-y-6">
                <PhotoUploader collageId={currentCollage.id} />
                <CollagePhotos collageId={currentCollage.id} />
              </div>
            )}
          </div>

          {/* Main Content - 3D Scene */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
              <div className="h-[calc(100vh-200px)]">
                <ErrorBoundary
                  FallbackComponent={SceneErrorFallback}
                  onReset={() => window.location.reload()}
                  resetKeys={[currentCollage.id, photos.length]}
                >
                  <CollageScene 
                    photos={photos} 
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CollageEditorPage;