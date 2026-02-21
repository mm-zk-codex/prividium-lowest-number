import { useEffect, useState } from 'react';
import { handleAuthCallback } from 'prividium';

export function AuthCallbackPage() {
  const [message, setMessage] = useState('Completing authentication...');

  useEffect(() => {
    handleAuthCallback((errorMessage) => {
      if (errorMessage) {
        setMessage(`Authentication failed: ${errorMessage}`);
      } else {
        setMessage('Authentication complete. You can close this window.');
      }
    });
  }, []);

  return <p>{message}</p>;
}
