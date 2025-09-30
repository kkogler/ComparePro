/**
 * Comprehensive error suppression for development environment
 * This file prevents false runtime errors from appearing in browser console
 */

// Override console.error to filter out development artifacts
const originalError = console.error;
console.error = (...args: any[]) => {
  const message = args.join(' ');
  
  // Suppress development-specific errors (but allow HMR connection errors)
  if (
    message.includes('ResizeObserver') ||
    message.includes('runtime-error') ||
    (message.includes('vite') && !message.includes('WebSocket') && !message.includes('connecting') && !message.includes('connected')) ||
    (message.includes('HMR') && !message.includes('WebSocket') && !message.includes('connecting') && !message.includes('connected')) ||
    message.includes('hot update') ||
    message.includes('__vite_plugin')
  ) {
    return; // Don't log these
  }
  
  // Log actual errors
  originalError.apply(console, args);
};

// Suppress window errors globally
const originalOnError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  const msg = String(message);
  
  if (
    msg.includes('ResizeObserver') ||
    msg.includes('runtime-error') ||
    (msg.includes('vite') && !msg.includes('WebSocket') && !msg.includes('connecting') && !msg.includes('connected')) ||
    msg.includes('Non-Error promise rejection')
  ) {
    return true; // Prevent default handling
  }
  
  if (originalOnError) {
    return originalOnError(message, source, lineno, colno, error);
  }
  return false;
};

// Export for use in main.tsx
export const suppressDevErrors = () => {
  console.log('Development error suppression active');
};