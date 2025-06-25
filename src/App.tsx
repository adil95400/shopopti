import React from 'react';

import ToasterProvider from './components/ui/toaster';
import AppRoutes from './routes';
import './App.css';
import './i18n';

function App() {
  return (
    <>
      <AppRoutes />
      <ToasterProvider />
    </>
  );
}

export default App;