import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import CollageViewerPage from './pages/CollageViewerPage';
import CollageEditorPage from './pages/CollageEditorPage';
import LandingPage from './pages/LandingPage';
import JoinPage from './pages/JoinPage';
import DashboardPage from './pages/DashboardPage';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-black">
        <Routes>
          {/* Landing page */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Join collage page */}
          <Route path="/join" element={<JoinPage />} />
          
          {/* Collage viewer page */}
          <Route path="/collage/:code" element={<CollageViewerPage />} />
          
          {/* Collage editor page */}
          <Route path="/collage/:id/edit" element={<CollageEditorPage />} />
          
          {/* Dashboard page */}
          <Route path="/dashboard" element={<DashboardPage />} />
          
          {/* Redirect unknown routes to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #374151',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </Router>
  );
};

export default App;