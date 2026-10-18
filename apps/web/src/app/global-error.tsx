'use client';

import { useEffect } from 'react';

const styles = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '1rem',
    textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  },
  brand: { color: '#7ea832', fontSize: '2.5rem', fontWeight: 800, margin: 0 },
  title: { fontSize: '1.5rem', fontWeight: 800, margin: 0 },
  body: { maxWidth: '24rem', fontSize: '0.875rem', color: '#6b7280', margin: 0 },
  row: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' },
  button: {
    border: 0,
    borderRadius: '0.375rem',
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    background: '#7ea832',
    color: '#ffffff'
  },
  link: {
    borderRadius: '0.375rem',
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    border: '1px solid #d1d5db',
    color: '#111827',
    textDecoration: 'none'
  }
} as const;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Fatal application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <main style={styles.main}>
          <p style={styles.brand}>Oops</p>
          <h1 style={styles.title}>The application failed to load</h1>
          <p style={styles.body}>Something went wrong before the page could render. Please reload the page.</p>
          <div style={styles.row}>
            <button type="button" style={styles.button} onClick={reset}>
              Reload
            </button>
            <a href="/" style={styles.link}>
              Back home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
