import React, { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle, RefreshCw, Image, FileImage } from 'lucide-react';
import { useCollageStore } from '../../store/collageStore';

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileUpload {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  preview?: string;
}

interface PhotoUploaderProps {
  collageId: string;
  onUploadComplete?: () => void;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({ collageId, onUploadComplete }) => {
  const { uploadPhoto } = useCollageStore();
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create file upload entries with preview generation
  const handleFileSelect = (files: File[]) => {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    const validFiles = files.filter(file => {
      if (!validImageTypes.includes(file.type)) {
        alert(`"${file.name}" is not a valid image file. Only JPEG, PNG, GIF, and WebP are supported.`);
        return false;
      }
      if (file.size > maxFileSize) {
        alert(`"${file.name}" is too large. Maximum file size is 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newUploads: FileUpload[] = validFiles.map(file => {
      const upload = {
        id: `${Date.now()}-${Math.random()}`,
        file,
        status: 'pending' as UploadStatus,
        progress: 0,
        preview: undefined
      };

      // Generate preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileUploads(prev => prev.map(u => 
          u.id === upload.id ? { ...u, preview: e.target?.result as string } : u
        ));
      };
      reader.readAsDataURL(file);

      return upload;
    });

    setFileUploads(prev => [...prev, ...newUploads]);
    
    // Start processing uploads immediately
    processUploads(newUploads);
  };

  // Update file status
  const updateFileStatus = (id: string, updates: Partial<FileUpload>) => {
    setFileUploads(prev => prev.map(upload => 
      upload.id === id ? { ...upload, ...updates } : upload
    ));
  };

  // Process uploads with proper error handling
  const processUploads = async (uploads: FileUpload[]) => {
    setIsUploading(true);
    
    const batchSize = 3; // Upload 3 files at a time
    const batches = [];
    
    for (let i = 0; i < uploads.length; i += batchSize) {
      batches.push(uploads.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const uploadPromises = batch.map(async (upload) => {
        updateFileStatus(upload.id, { status: 'uploading', progress: 0 });
        
        try {
          // Simulate progress (since Supabase doesn't provide real progress)
          const progressInterval = setInterval(() => {
            updateFileStatus(upload.id, { 
              progress: Math.min(Math.random() * 40 + 50, 90) 
            });
          }, 200);

          // Use the store's upload method
          await uploadPhoto(collageId, upload.file);
          
          clearInterval(progressInterval);
          updateFileStatus(upload.id, { 
            status: 'success', 
            progress: 100 
          });
          
        } catch (error: any) {
          console.error('Upload failed:', error);
          updateFileStatus(upload.id, { 
            status: 'error', 
            progress: 0,
            error: error.message || 'Upload failed'
          });
        }
      });

      // Wait for current batch to complete before starting next
      await Promise.all(uploadPromises);
    }

    setIsUploading(false);
    
    // Clear completed uploads after delay
    setTimeout(() => {
      setFileUploads(prev => prev.filter(u => u.status === 'error'));
    }, 2000);
    
    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files);
    }
    // Reset input value so same file can be selected again
    e.target.value = '';
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const getStatusIcon = (upload: FileUpload) => {
    switch (upload.status) {
      case 'pending':
        return <FileImage className="w-4 h-4 text-gray-400" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: UploadStatus) => {
    switch (status) {
      case 'pending': return 'bg-gray-600';
      case 'uploading': return 'bg-blue-600';
      case 'success': return 'bg-green-600';
      case 'error': return 'bg-red-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-purple-400 bg-purple-900/20' 
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isUploading}
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
            {isUploading ? (
              <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-gray-400" />
            )}
          </div>
          
          <div>
            <p className="text-lg font-medium text-white mb-2">
              {isUploading ? 'Uploading photos...' : 'Drop photos here or click to browse'}
            </p>
            <p className="text-sm text-gray-400">
              Supports JPEG, PNG, GIF, WebP • Max 10MB per file
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {fileUploads.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-white">Upload Progress</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {fileUploads.map((upload) => (
              <div key={upload.id} className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg">
                {/* Preview */}
                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                  {upload.preview ? (
                    <img 
                      src={upload.preview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <Image className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
                
                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {upload.file.name}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusIcon(upload)}
                    <span className="text-xs text-gray-400">
                      {upload.status === 'uploading' && `${Math.round(upload.progress)}%`}
                      {upload.status === 'success' && 'Uploaded'}
                      {upload.status === 'error' && (upload.error || 'Failed')}
                      {upload.status === 'pending' && 'Waiting...'}
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                {upload.status === 'uploading' && (
                  <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${getStatusColor(upload.status)}`}
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}
                
                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileUploads(prev => prev.filter(u => u.id !== upload.id));
                  }}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUploader;