import React from 'react';

import { Toaster } from './components/ui/toaster';
import AppRoutes from './routes';
import './App.css';
import './i18n';

function App() {
  return (
    <>
      <AppRoutes />
      <Toaster />
    </>
  );
}

export default App
