import React, { useState } from 'react';
import { CollageViewer } from './components/CollageViewer';
import { PhotoUpload } from './components/PhotoUpload';

const App: React.FC = () => {
  const [collageCode, setCollageCode] = useState<string>('demo-collage');
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="w-full h-screen bg-black relative">
      {/* Collage Code Input */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-75 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <input
            type="text"
            value={collageCode}
            onChange={(e) => setCollageCode(e.target.value)}
            placeholder="Enter collage code"
            className="px-3 py-1 bg-gray-800 text-white border border-gray-600 rounded text-sm"
          />
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
          >
            {showUpload ? 'Hide Upload' : 'Upload Photos'}
          </button>
        </div>
        
        {showUpload && (
          <div className="w-64">
            <PhotoUpload
              collageId={collageCode} // Note: In production, you'd want to get the actual collage ID
              onUploadComplete={() => {
                console.log('Upload completed');
                // Optionally close upload panel
                // setShowUpload(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Main Collage Viewer */}
      <CollageViewer collageCode={collageCode} />
    </div>
  );
};

export default App;