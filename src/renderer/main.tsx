import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/base.css';
import './styles/editor.css';
import './styles/slash.css';
import './styles/themes/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('No #root');
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
