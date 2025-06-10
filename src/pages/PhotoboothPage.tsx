// src/pages/PhotoboothPage.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, SwitchCamera, Download, Send, X, RefreshCw, Type, ArrowLeft, Settings } from 'lucide-react';
import { useRealtimeCollage } from '../hooks/useRealtimeCollage';
import Layout from '../components/layout/Layout';

type VideoDevice = {
  deviceId: string;
  label: string;
};

type CameraState = 'idle' | 'starting' | 'active' | 'error';

const PhotoboothPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializingRef = useRef(false);
  
  const [devices, setDevices] = useState<VideoDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  
  // Use the fixed useRealtimeCollage hook instead of manual store setup
  const { currentCollage, uploadPhoto } = useRealtimeCollage({ 
    collageCode: code 
  });

  const cleanupCamera = useCallback(() => {
    console.log('🧹 Cleaning up camera...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    
    setCameraState('idle');
  }, []);

  const getVideoDevices = useCallback(async (): Promise<VideoDevice[]> => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId}`
        }));
      
      console.log('📹 Available video devices:', videoDevices);
      return videoDevices;
    } catch (error) {
      console.warn('⚠️ Could not enumerate devices:', error);
      return [];
    }
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    // Prevent multiple simultaneous initializations
    if (isInitializingRef.current) {
      console.log('🔄 Camera initialization already in progress, skipping...');
      return;
    }

    console.log('🎥 Starting camera initialization with device:', deviceId);
    isInitializingRef.current = true;
    setCameraState('starting');
    setError(null);

    try {
      // Clean up any existing camera first
      cleanupCamera();

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Detect platform
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isMobile = isIOS || isAndroid;
      
      console.log('📱 Platform detected:', { isIOS, isAndroid, isMobile });
      
      // Build constraints based on platform
      let constraints: MediaStreamConstraints;
      
      if (deviceId) {
        constraints = {
          video: {
            deviceId: { exact: deviceId },
            ...(isMobile ? { facingMode: "user" } : {}),
            ...(isIOS ? {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            } : {})
          },
          audio: false
        };
      } else {
        constraints = {
          video: isMobile ? {
            facingMode: "user",
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          } : {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          },
          audio: false
        };
      }

      console.log('🎥 Requesting user media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!videoRef.current) {
        console.error('❌ Video ref not available');
        throw new Error('Video element not ready');
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      await new Promise((resolve, reject) => {
        if (!videoRef.current) {
          reject(new Error('Video element not available'));
          return;
        }

        videoRef.current.onloadedmetadata = () => {
          console.log('✅ Video metadata loaded');
          resolve(undefined);
        };
        
        videoRef.current.onerror = (err) => {
          console.error('❌ Video error:', err);
          reject(new Error('Video playback failed'));
        };
        
        // Add timeout for loading
        setTimeout(() => {
          reject(new Error('Video loading timeout'));
        }, 10000);
      });

      await videoRef.current.play();
      console.log('✅ Camera started successfully');
      setCameraState('active');

      // Get and update device list after successful camera start
      const updatedDevices = await getVideoDevices();
      setDevices(updatedDevices);
      
      if (!deviceId && updatedDevices.length > 0) {
        setSelectedDevice(updatedDevices[0].deviceId);
      } else if (deviceId) {
        setSelectedDevice(deviceId);
      }

    } catch (err: any) {
      console.error('❌ Camera initialization failed:', err);
      setCameraState('error');
      
      let errorMessage = 'Camera error: ';
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Camera permission denied. Please allow camera access and refresh.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera found. Please connect a camera.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Camera is busy or hardware error.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Camera settings not supported. Trying default settings...';
        
        // Try with basic constraints
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (videoRef.current) {
            streamRef.current = basicStream;
            videoRef.current.srcObject = basicStream;
            await videoRef.current.play();
            setCameraState('active');
            setError(null);
            return;
          }
        } catch (basicErr) {
          errorMessage += ' Basic camera also failed.';
        }
      } else {
        errorMessage += err.message || 'Unknown camera error.';
      }
      
      setError(errorMessage);
    } finally {
      isInitializingRef.current = false;
    }
  }, [selectedDevice, cameraState, cleanupCamera, getVideoDevices]);

  const switchCamera = useCallback(() => {
    if (devices.length <= 1) return;
    
    const currentIndex = devices.findIndex(d => d.deviceId === selectedDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    handleDeviceChange(devices[nextIndex].deviceId);
  }, [devices, selectedDevice]);

  // Initialize camera when component mounts and when returning from photo view
  useEffect(() => {
    if (!photo && cameraState === 'idle' && !isInitializingRef.current) {
      console.log('🚀 Initializing camera...');
      const timer = setTimeout(() => {
        startCamera(selectedDevice);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [photo, cameraState, startCamera, selectedDevice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up...');
      cleanupCamera();
    };
  }, [cleanupCamera]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🙈 Page hidden, pausing camera...');
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            track.enabled = false;
          });
        }
      } else {
        console.log('👁️ Page visible, resuming camera...');
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            track.enabled = true;
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || cameraState !== 'active') {
      console.warn('⚠️ Cannot capture: video or canvas not ready');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) {
      console.error('❌ Canvas context not available');
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Add text overlay if provided
    if (text.trim()) {
      const fontSize = Math.min(canvas.width / 20, 48);
      context.font = `bold ${fontSize}px Arial, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      
      // Add shadow for better text visibility
      context.shadowColor = 'rgba(0, 0, 0, 0.8)';
      context.shadowBlur = 4;
      context.shadowOffsetX = 2;
      context.shadowOffsetY = 2;
      
      // White text with black outline
      context.strokeStyle = 'black';
      context.lineWidth = 3;
      context.fillStyle = 'white';

      // Word wrap the text
      const words = text.trim().split(' ');
      const lines: string[] = [];
      const maxWidth = canvas.width * 0.8;
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);

      // Draw each line
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = (canvas.height - totalHeight) / 2 + fontSize / 2;

      lines.forEach((line, index) => {
        const textY = startY + index * lineHeight;
        const textX = canvas.width / 2;
        
        context.strokeText(line, textX, textY);
        context.fillText(line, textX, textY);
      });
      
      // Reset shadow
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    setPhoto(dataUrl);
    
    // Stop camera after taking photo to free up resources
    cleanupCamera();
  }, [text, cameraState, cleanupCamera]);

  const uploadToCollage = useCallback(async () => {
    if (!photo || !currentCollage) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fetch(photo);
      const blob = await response.blob();
      const file = new File([blob], 'photobooth.jpg', { type: 'image/jpeg' });

      const result = await uploadPhoto(currentCollage.id, file);
      if (result) {        
        // Reset state
        setPhoto(null);
        setText('');
        
        // Show success message
        setError('Photo uploaded successfully! Your photo will appear in the collage automatically.');
        setTimeout(() => setError(null), 3000);
        
        // Restart camera after a brief delay
        setTimeout(() => {
          console.log('🔄 Restarting camera after upload...');
          startCamera(selectedDevice);
        }, 500);
        
      } else {
        throw new Error('Failed to upload photo');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }, [photo, currentCollage, uploadPhoto, startCamera, selectedDevice]);

  const downloadPhoto = useCallback(() => {
    if (!photo) return;
    const link = document.createElement('a');
    link.href = photo;
    link.download = 'photobooth.jpg';
    link.click();
  }, [photo]);

  const retakePhoto = useCallback(() => {
    setPhoto(null);
    setText('');
    
    // Restart camera immediately
    setTimeout(() => {
      console.log('🔄 Restarting camera after retake...');
      startCamera(selectedDevice);
    }, 100);
  }, [startCamera, selectedDevice]);

  const handleDeviceChange = useCallback((newDeviceId: string) => {
    if (newDeviceId === selectedDevice) return;
    
    setSelectedDevice(newDeviceId);
    
    // Only restart camera if we're currently showing the camera view
    if (!photo && cameraState !== 'starting') {
      console.log('📱 Device changed, restarting camera...');
      startCamera(newDeviceId);
    }
  }, [selectedDevice, photo, cameraState, startCamera]);

  if (!currentCollage) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
            <p className="text-white">Loading photobooth...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/collage/${currentCollage.code}`)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                <Camera className="w-6 h-6 text-purple-500" />
                <span>Photobooth</span>
              </h1>
              <p className="text-gray-400">{currentCollage.name} • Code: {currentCollage.code}</p>
            </div>
          </div>
          
          {/* Camera Controls */}
          {!photo && devices.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              title="Switch Camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg ${
            error.includes('successfully') 
              ? 'bg-green-900/30 border border-green-500/50 text-green-200'
              : 'bg-red-900/30 border border-red-500/50 text-red-200'
          }`}>
            {error}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Camera/Photo View */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 rounded-lg overflow-hidden">
              {photo ? (
                /* Photo Preview */
                <div className="relative">
                  <img 
                    src={photo} 
                    alt="Captured photo" 
                    className="w-full h-auto"
                  />
                  
                  {/* Photo Controls Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 flex justify-center space-x-3">
                    <button
                      onClick={retakePhoto}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Retake</span>
                    </button>
                    
                    <button
                      onClick={downloadPhoto}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                    
                    <button
                      onClick={uploadToCollage}
                      disabled={uploading}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg transition-colors flex items-center space-x-2"
                    >
                      {uploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Add to Collage</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Camera View */
                <div className="relative aspect-video bg-black">
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover"
                    autoPlay 
                    playsInline 
                    muted
                  />
                  
                  {cameraState === 'starting' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                        <p className="text-white">Starting camera...</p>
                      </div>
                    </div>
                  )}
                  
                  {cameraState === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
                      <div className="text-center">
                        <Camera className="w-12 h-12 text-red-400 mx-auto mb-2" />
                        <p className="text-red-200">Camera Error</p>
                        <button
                          onClick={() => startCamera(selectedDevice)}
                          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {cameraState === 'active' && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                      <button
                        onClick={capturePhoto}
                        className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-400 transition-colors flex items-center justify-center"
                      >
                        <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Hidden Canvas for Photo Processing */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-6">
            {/* Text Overlay */}
            <div className="bg-gray-900 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Type className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Add Text</h3>
              </div>
              
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add text to your photo..."
                className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-purple-500"
                maxLength={100}
              />
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-400">
                  {text.length}/100 characters
                </span>
                {text && (
                  <button
                    onClick={() => setText('')}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Camera Settings */}
            {devices.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Camera</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Camera
                    </label>
                    <select
                      value={selectedDevice}
                      onChange={(e) => handleDeviceChange(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      {devices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-300 mb-3">Instructions</h3>
              <ul className="text-sm text-blue-200 space-y-2">
                <li>• Position yourself in the camera view</li>
                <li>• Add optional text overlay</li>
                <li>• Click the capture button to take a photo</li>
                <li>• Upload your photo to add it to the collage</li>
                <li>• Photos appear in the collage automatically!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PhotoboothPage;