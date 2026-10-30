import { route } from '../src/supabase-local-server.mjs';

export default function handler(req, res) {
  return route(req, res);
}
