// Web app manifest, so the installed app's name follows APP_NAME.
import {env} from './_auth.js';

export default function handler(req, res) {
  const name = env('APP_NAME', 'Command Center');
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(JSON.stringify({
    name,
    short_name: name.length > 12 ? name.split(/\s+/)[0] : name,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#07080A',
    theme_color: '#07080A',
    icons: [
      {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}
    ]
  }));
}
