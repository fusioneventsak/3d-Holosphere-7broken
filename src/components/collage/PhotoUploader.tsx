import React, { useCallback, useState, useRef } from 'react';
import { uploadPhoto, deletePhoto } from '../lib/supabase';
import { supabase } from '../lib/supabase';

interface Photo {
  id: string;
  url: string;
  collage_id: string;
  created_at: string;
}

interface PhotoUploadProps {
  collageId: string;
  photos: Photo[];
  onUploadComplete?: () => void;
  onDeletePhoto?: (photoId: string) => void;
  className?: string;
  maxPhotos?: number;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ 
  collageId, 
  photos = [],
  onUploadComplete,
  onDeletePhoto,
  className = '',
  maxPhotos = 50
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [showPhotos, setShowPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return `${file.name} is not an image file`;
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return `${file.name} is too large (max 10MB)`;
    }

    // Check if we're at max photos
    if (photos.length >= maxPhotos) {
      return `Cannot upload more than ${maxPhotos} photos`;
    }
    
    return null;
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!files.length) return;

    setUploading(true);
    setErrors([]);
    const newProgress: {[key: string]: number} = {};
    
    try {
      const validFiles: File[] = [];
      const fileErrors: string[] = [];

      // Validate all files first
      Array.from(files).forEach(file => {
        const error = validateFile(file);
        if (error) {
          fileErrors.push(error);
        } else {
          validFiles.push(file);
          newProgress[file.name] = 0;
        }
      });

      if (fileErrors.length > 0) {
        setErrors(fileErrors);
      }

      if (validFiles.length === 0) {
        setUploading(false);
        return;
      }

      setUploadProgress(newProgress);

      // Upload files with progress tracking
      const uploadPromises = validFiles.map(async (file) => {
        try {
          // Simulate progress updates (Supabase doesn't provide upload progress)
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: Math.min(prev[file.name] + Math.random() * 30, 90)
            }));
          }, 200);

          const result = await uploadPhoto(file, collageId);
          
          clearInterval(progressInterval);
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 100
          }));

          return result;
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          throw new Error(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      await Promise.all(uploadPromises);
      
      // Clear progress after a short delay
      setTimeout(() => {
        setUploadProgress({});
      }, 1000);

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrors(prev => [...prev, error instanceof Error ? error.message : 'Upload failed']);
    } finally {
      setUploading(false);
    }
  }, [collageId, onUploadComplete, photos.length, maxPhotos]);

  const handleDeletePhoto = useCallback(async (photo: Photo) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await deletePhoto(photo.id, photo.url);
      if (onDeletePhoto) {
        onDeletePhoto(photo.id);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Failed to delete photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [onDeletePhoto]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  }, [handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileUpload(files);
    }
    // Reset input so same file can be uploaded again
    e.target.value = '';
  }, [handleFileUpload]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200
          ${dragOver 
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-105' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={uploading}
        />
        
        <div className="space-y-3">
          <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            {uploading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            ) : (
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {uploading ? 'Uploading photos...' : 'Drop photos here or click to browse'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              JPG, PNG, GIF, WebP • Max 10MB • {photos.length}/{maxPhotos} photos
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Uploading...</h4>
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span className="truncate">{filename}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <div 
                  className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Upload Errors:</h4>
          <ul className="text-xs text-red-600 dark:text-red-300 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
          <button 
            onClick={() => setErrors([])}
            className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Photo Management */}
      {photos.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowPhotos(!showPhotos)}
            className="flex items-center justify-between w-full p-2 text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span>Manage Photos ({photos.length})</span>
            <svg 
              className={`w-4 h-4 transition-transform ${showPhotos ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPhotos && (
            <div className="mt-3 max-h-64 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.url}
                      alt="Uploaded photo"
                      className="w-full h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo);
                      }}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      title="Delete photo"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                      {new Date(photo.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Actions */}
      {photos.length > 0 && (
        <div className="mt-4 flex space-x-2">
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete all ${photos.length} photos?`)) {
                photos.forEach(photo => handleDeletePhoto(photo));
              }
            }}
            className="flex-1 px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Delete All Photos
          </button>
          <button
            onClick={() => {
              const urls = photos.map(p => p.url).join('\n');
              navigator.clipboard.writeText(urls);
              alert('Photo URLs copied to clipboard!');
            }}
            className="flex-1 px-3 py-2 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
          >
            Copy URLs
          </button>
        </div>
      )}
    </div>
  );
};