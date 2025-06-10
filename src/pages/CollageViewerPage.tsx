import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CollageScene } from './CollageScene';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Photo {
  id: string;
  url: string;
  collage_id: string;
  created_at: string;
}

interface StockPhoto {
  id: string;
  url: string;
  category: string;
  created_at: string;
}

interface CollageSettings {
  gridSize: number;
  floorSize: number;
  gridColor: string;
  photoSize: number;
  floorColor: string;
  photoCount: number;
  wallHeight: number;
  gridEnabled: boolean;
  gridOpacity: number;
  cameraHeight: number;
  floorEnabled: boolean;
  floorOpacity: number;
  photoSpacing: number;
  cameraEnabled: boolean;
  gridDivisions: number;
  animationSpeed: number;
  cameraDistance: number;
  emptySlotColor: string;
  floorMetalness: number;
  floorRoughness: number;
  spotlightAngle: number;
  spotlightColor: string;
  spotlightCount: number;
  spotlightWidth: number;
  useStockPhotos: boolean;
  backgroundColor: string;
  gridAspectRatio: number;
  spotlightHeight: number;
  animationEnabled: boolean;
  animationPattern: string;
  photoRotation?: boolean;
  floorReflectivity: number;
  spotlightDistance: number;
  spotlightPenumbra: number;
  backgroundGradient: boolean;
  spotlightIntensity: number;
  cameraRotationSpeed: number;
  ambientLightIntensity: number;
  backgroundGradientEnd: string;
  cameraRotationEnabled: boolean;
  backgroundGradientAngle: number;
  backgroundGradientStart: string;
}

interface CollageViewerProps {
  collageCode: string;
}

export const CollageViewer: React.FC<CollageViewerProps> = ({ collageCode }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stockPhotos, setStockPhotos] = useState<StockPhoto[]>([]);
  const [settings, setSettings] = useState<CollageSettings | null>(null);
  const [collageId, setCollageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  // Default settings fallback
  const defaultSettings: CollageSettings = {
    gridSize: 200,
    floorSize: 200,
    gridColor: "#444444",
    photoSize: 4.0,
    floorColor: "#1A1A1A",
    photoCount: 50,
    wallHeight: 0,
    gridEnabled: true,
    gridOpacity: 1.0,
    cameraHeight: 10,
    floorEnabled: true,
    floorOpacity: 0.8,
    photoSpacing: 0,
    cameraEnabled: true,
    gridDivisions: 30,
    animationSpeed: 50,
    cameraDistance: 25,
    emptySlotColor: "#1A1A1A",
    floorMetalness: 0.7,
    floorRoughness: 0.2,
    spotlightAngle: 0.7853981633974483,
    spotlightColor: "#ffffff",
    spotlightCount: 2,
    spotlightWidth: 0.8,
    useStockPhotos: true,
    backgroundColor: "#000000",
    gridAspectRatio: 1.77778,
    spotlightHeight: 15,
    animationEnabled: false,
    animationPattern: "grid",
    photoRotation: true,
    floorReflectivity: 0.8,
    spotlightDistance: 30,
    spotlightPenumbra: 0.8,
    backgroundGradient: false,
    spotlightIntensity: 200.0,
    cameraRotationSpeed: 0.2,
    ambientLightIntensity: 0.5,
    backgroundGradientEnd: "#1a1a1a",
    cameraRotationEnabled: true,
    backgroundGradientAngle: 180,
    backgroundGradientStart: "#000000"
  };

  // Fetch collage data
  const fetchCollageData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get collage by code
      const { data: collageData, error: collageError } = await supabase
        .from('collages')
        .select('id, name')
        .eq('code', collageCode)
        .single();

      if (collageError) throw collageError;
      if (!collageData) throw new Error('Collage not found');

      setCollageId(collageData.id);

      // Get photos for this collage
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageData.id)
        .order('created_at', { ascending: true });

      if (photosError) throw photosError;
      setPhotos(photosData || []);

      // Get stock photos
      const { data: stockPhotosData, error: stockPhotosError } = await supabase
        .from('stock_photos')
        .select('*')
        .order('created_at', { ascending: true });

      if (stockPhotosError) throw stockPhotosError;
      setStockPhotos(stockPhotosData || []);

      // Get collage settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('collage_settings')
        .select('settings')
        .eq('collage_id', collageData.id)
        .single();

      if (settingsError) {
        console.warn('Settings not found, using defaults:', settingsError);
        setSettings(defaultSettings);
      } else {
        setSettings({ ...defaultSettings, ...settingsData.settings });
      }

    } catch (err) {
      console.error('Error fetching collage data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load collage');
    } finally {
      setLoading(false);
    }
  }, [collageCode, defaultSettings]);

  // Set up realtime subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!collageId) return;

    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    // Create new channel for this collage
    const channel = supabase
      .channel(`collage-${collageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${collageId}`
        },
        (payload) => {
          console.log('Realtime photo change:', payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              setPhotos(prev => {
                const newPhoto = payload.new as Photo;
                // Check if photo already exists to prevent duplicates
                if (prev.some(p => p.id === newPhoto.id)) {
                  return prev;
                }
                return [...prev, newPhoto];
              });
              break;
              
            case 'DELETE':
              setPhotos(prev => prev.filter(p => p.id !== payload.old.id));
              break;
              
            case 'UPDATE':
              setPhotos(prev => prev.map(p => 
                p.id === payload.new.id ? payload.new as Photo : p
              ));
              break;
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'collage_settings',
          filter: `collage_id=eq.${collageId}`
        },
        (payload) => {
          console.log('Realtime settings change:', payload);
          const newSettings = payload.new.settings;
          setSettings(prev => ({ ...defaultSettings, ...prev, ...newSettings }));
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    realtimeChannelRef.current = channel;
  }, [collageId, defaultSettings]);

  // Initial data fetch
  useEffect(() => {
    fetchCollageData();
  }, [fetchCollageData]);

  // Set up realtime when collageId is available
  useEffect(() => {
    if (collageId) {
      setupRealtimeSubscription();
    }

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [collageId, setupRealtimeSubscription]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading collage...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={fetchCollageData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>Initializing scene...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ backgroundColor: settings.backgroundColor }}
      />
      
      {/* Debug info - remove in production */}
      <div className="absolute top-4 left-4 text-white text-sm bg-black bg-opacity-50 p-2 rounded">
        <p>Photos: {photos.length}</p>
        <p>Stock Photos: {stockPhotos.length}</p>
        <p>Total Slots: {settings.photoCount}</p>
        <p>Empty Slots: {Math.max(0, settings.photoCount - photos.length - (settings.useStockPhotos ? stockPhotos.length : 0))}</p>
      </div>
      
      <CollageScene
        photos={photos}
        stockPhotos={stockPhotos}
        settings={settings}
        containerRef={containerRef}
      />
    </div>
  );
};