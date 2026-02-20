import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/Layout/AppShell';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import Rules from './pages/Rules';
import Settings from './pages/Settings';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="rules" element={<Rules />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
