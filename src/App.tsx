import React from 'react';

import AppRoutes from './routes';

import { Toaster } from '@/components/ui/toaster';

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

export default App;