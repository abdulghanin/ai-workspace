import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './context/authStore.js';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EditorPage from './pages/EditorPage.jsx';
import SharedProjectPage from './pages/SharedProjectPage.jsx';

const ProtectedRoute = ({ children }) => {
  const { token, initialized } = useAuthStore();
  if (!initialized) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
  return token ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { token } = useAuthStore();
  return token ? <Navigate to="/dashboard" replace /> : children;
};

export default function App() {
  const { init } = useAuthStore();
  useEffect(() => { init(); }, []);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#161B27',
            color: '#E2E8F0',
            border: '1px solid #1E2535',
            fontFamily: 'DM Sans, sans-serif',
          },
          success: { iconTheme: { primary: '#6EE7B7', secondary: '#080B14' } },
          error: { iconTheme: { primary: '#F87171', secondary: '#080B14' } },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<PublicRoute><AuthPage mode="login" /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><AuthPage mode="register" /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/editor/:projectId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
        <Route path="/shared/:token" element={<SharedProjectPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
