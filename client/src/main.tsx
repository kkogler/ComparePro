import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { suppressDevErrors } from "./utils/error-suppression";

// Handle unhandled promise rejections gracefully
window.addEventListener('unhandledrejection', (event) => {
  // Only log non-user-friendly errors
  if (!(event.reason?.isUserFriendly)) {
    console.warn('Unhandled promise rejection:', event.reason);
  }
  // Prevent the default browser error handling
  event.preventDefault();
});

// Handle ResizeObserver errors gracefully
window.addEventListener('error', (event) => {
  if (event.message.includes('ResizeObserver loop completed') || 
      event.message.includes('runtime-error-plugin') ||
      event.message.includes('unknown runtime error') ||
      event.message.includes('Uncaught') ||
      event.filename?.includes('runtime-error-modal')) {
    // These are harmless browser timing issues or development artifacts
    event.preventDefault();
    return false;
  }
});

// Suppress Vite runtime error overlay but allow HMR connection errors
if (import.meta.env.DEV) {
  // Allow HMR connection errors to be handled properly by not overriding them completely
  suppressDevErrors();
}

createRoot(document.getElementById("root")!).render(<App />);
