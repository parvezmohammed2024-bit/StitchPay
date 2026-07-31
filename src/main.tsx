// Safely define fetch property on window to prevent polyfill assignment errors
if (typeof window !== 'undefined') {
  try {
    const origFetch = window.fetch;
    if (origFetch) {
      Object.defineProperty(window, 'fetch', {
        value: function (...args: [RequestInfo | URL, RequestInit?]) {
          return origFetch.apply(window, args);
        },
        writable: true,
        configurable: true,
      });
    }
  } catch (_e) {
    // Ignore if already configured or unmodifiable
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

