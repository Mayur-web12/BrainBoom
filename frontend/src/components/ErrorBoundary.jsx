import React from 'react';

// Without this, ANY uncaught error thrown while rendering — anywhere in the
// app, by anyone: a mentor clicking "Control" on a session in an unexpected
// state, a malformed question, a null field the code didn't expect — unmounts
// the entire React tree. Since the page background is a very dark navy/black,
// the result looks exactly like a "blank black screen" with no error message
// and no way to recover except reloading and hoping it doesn't happen again.
//
// This catches that class of crash at the root, shows a recoverable screen
// instead, and surfaces the actual error so it can be diagnosed and fixed at
// the source — rather than everyone just seeing a dead page.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught a render crash:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, background: '#0a0818', color: '#e8e6f5', textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ maxWidth: 440 }}>
          <div style={{ fontSize: '3rem', marginBottom: 14 }}>⚠️</div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: 10 }}>Something went wrong</h2>
          <p style={{ color: '#9b95b8', fontSize: '0.95rem', marginBottom: 20, lineHeight: 1.6 }}>
            This screen hit an unexpected error and couldn't display. Your game session isn't lost —
            reloading will reconnect you to it.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#7B61FF,#4F8CFF)', color: '#fff',
              fontWeight: 800, fontSize: '1rem',
            }}
          >
            🔄 Reload
          </button>
          <details style={{ marginTop: 22, textAlign: 'left', fontSize: '0.8rem', color: '#6e6a85' }}>
            <summary style={{ cursor: 'pointer' }}>Technical details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8 }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
