export default function manifest() {
  return {
    name: 'MediCare Cuidador — Portal de Acompanhamento',
    short_name: 'Cuidador',
    description: 'Acompanhamento profissional e familiar de medicamentos, histórico de doses e saúde dos seus pacientes.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1120',
    theme_color: '#8b5cf6',
    lang: 'pt-BR',
    dir: 'ltr',
    scope: '/',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}
