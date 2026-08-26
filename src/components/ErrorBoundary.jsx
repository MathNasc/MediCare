'use client';
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { T, scale } = this.props;
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: 20
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: T?.txt || '#111', fontSize: 20 * (scale || 1), fontWeight: 800, marginBottom: 12 }}>
            Ops, algo deu errado!
          </h2>
          <p style={{ color: T?.sub || '#666', fontSize: 15 * (scale || 1), lineHeight: 1.5, marginBottom: 24 }}>
            Erro: {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
            style={{
              background: '#007AFF',
              color: '#fff',
              border: 'none',
              padding: '14px 24px',
              borderRadius: 12,
              fontSize: 16 * (scale || 1),
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,122,255,0.3)'
            }}
          >
            Voltar para o Início
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
