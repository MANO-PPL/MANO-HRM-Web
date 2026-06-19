import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'material-icons/iconfont/material-icons.css'
import { toast } from 'react-toastify'
import App from './App.jsx'
import './index.css';

// Patch react-toastify's default container ID behaviour globally.
// This ensures that any standard toast triggered across the application defaults to 'defaultContainer'.
try {
  const methods = ['success', 'error', 'info', 'warn', 'warning', 'dark', 'loading'];
  methods.forEach(method => {
    const original = toast[method];
    if (typeof original === 'function') {
      toast[method] = (content, options) => {
        return original(content, { containerId: 'defaultContainer', ...options });
      };
    }
  });

  const originalUpdate = toast.update;
  if (typeof originalUpdate === 'function') {
    toast.update = (toastId, options) => {
      return originalUpdate(toastId, { containerId: 'defaultContainer', ...options });
    };
  }
} catch (error) {
  console.error('Failed to patch react-toastify methods:', error);
}


createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </BrowserRouter>
  // </StrictMode>,
)
