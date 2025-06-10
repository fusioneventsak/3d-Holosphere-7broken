import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CollageViewerPage from './pages/CollageViewerPage';
import CollageEditorPage from './pages/CollageEditorPage';
import LandingPage from './pages/LandingPage';
import JoinCollage from './pages/JoinCollage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import CollageModerationPage from './pages/CollageModerationPage';
import PhotoboothPage from './pages/PhotoboothPage';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-black">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/join" element={<JoinCollage />} />
          <Route path="/collage/:code" element={<CollageViewerPage />} />
          <Route path="/photobooth/:code" element={<PhotoboothPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/collage/:id" element={<CollageEditorPage />} />
          
          {/* Moderation routes */}
          <Route path="/collage/:id/moderation" element={<CollageModerationPage />} />
          <Route path="/moderation/:id" element={<CollageModerationPage />} />
          
          {/* Redirect unknown routes to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;