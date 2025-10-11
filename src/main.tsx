import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from "@vercel/analytics/next"
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
);
