import './globals.css';

export const metadata = {
  metadataBase: new URL('https://medicare-amber-five.vercel.app'),
  title: {
    default: 'MediCare — Sua saúde, acompanhada de perto',
    template: '%s | MediCare',
  },
  description:
    'O MediCare conecta pacientes e cuidadores para facilitar a organização de medicamentos, o acompanhamento dos tratamentos e a rotina de cuidados.',
  keywords: ['medicare', 'saude', 'medicamentos', 'cuidador', 'paciente', 'android'],
  authors: [{ name: 'MediCare' }],
  manifest: '/manifest.json?v=4',
  icons: {
    icon: [
      { url: '/favicon-16x16.png?v=4', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png?v=4', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png?v=4',
    shortcut: '/favicon.ico?v=4',
  },
  openGraph: {
    type: 'website',
    siteName: 'MediCare',
    title: 'MediCare — Sua saúde, acompanhada de perto',
    description: 'Organização de medicamentos e rotina de cuidados para pacientes e cuidadores.',
    images: [
      {
        url: '/icon-512.png?v=4',
        width: 512,
        height: 512,
      },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b1120',
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
      </head>
      <body className="bg-[#0b1120] text-slate-100 min-h-screen antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
