import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';

import App from './App';
import './index.css';
import './i18n';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);
