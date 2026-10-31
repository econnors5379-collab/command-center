// Public config for the browser. The anon key is designed to be public; row-level security protects the data.
import {env} from './_auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: env('SUPABASE_URL'),
    supabaseAnonKey: env('SUPABASE_ANON_KEY'),
    appName: env('APP_NAME', 'Command Center'),
    aiEnabled: !!env('ANTHROPIC_API_KEY')
  });
}
