import React from 'react';
import { Toaster } from 'sonner';

import AppRoutes from './routes';
import './App.css';
import './i18n';

function App() {
  return (
    <>
      <AppRoutes />
      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;