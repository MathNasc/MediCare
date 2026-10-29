export const metadata = {
  metadataBase: new URL('https://medicare-amber-five.vercel.app'),
  title: {
    default: 'MediCare — Servidor & Paciente Android',
    template: '%s | MediCare',
  },
  description:
    'MediCare Paciente Android — Servidor de API, sincronização em tempo real e distribuição do APK oficial.',
  keywords: ['medicare', 'android', 'apk', 'saude', 'medicamentos', 'api'],
  authors: [{ name: 'MediCare Team' }],
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    siteName: 'MediCare',
    title: 'MediCare — Servidor & Paciente Android',
    description: 'Serviços de backend e distribuição do APK oficial do MediCare Paciente.',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
      },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0e1a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            background-color: #0b1120;
            color: #f1f5f9;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
          }
          a {
            color: inherit;
            text-decoration: none;
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
