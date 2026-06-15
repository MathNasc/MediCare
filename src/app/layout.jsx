import '@/styles/globals.css';

console.log('NEXT_PUBLIC_APP_URL =', process.env.NEXT_PUBLIC_APP_URL);

export const metadata = {
  metadataBase: new URL('https://medicare-amber-five.vercel.app'),
  title: {
    default: 'MediCare – Controle de Medicamentos',
    template: '%s | MediCare',
  },
  description:
    'Gerencie seus medicamentos com lembretes inteligentes, confirmação de doses e acompanhamento por cuidadores.',
  keywords: ['medicamentos', 'saúde', 'lembretes', 'doses', 'tratamento'],
  authors: [{ name: 'MediCare' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MediCare',
  },
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
    title: 'MediCare – Controle de Medicamentos',
    description: 'Gerencie seus medicamentos com lembretes inteligentes.',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
      },
    ],
  },
};

// Separate viewport export (Next.js 14 requirement)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="theme-color" content="#0d1117" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-TileImage" content="/icon-144.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
