import webpush from 'npm:web-push@3.6.7';
try {
  webpush.setVapidDetails('mailto:a@a.com', undefined as any, undefined as any);
  console.log('Did not throw');
} catch (e) {
  console.log('Threw error:', e.message);
}
