const webpush = require('web-push');
try {
  webpush.setVapidDetails('mailto:a@a.com', undefined, undefined);
  console.log('Did not throw');
} catch (e) {
  console.log('Threw error:', e.message);
}
