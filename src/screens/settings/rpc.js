import { supabase, friendly } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';

/** Call a database function from a Settings page: toast the result, refresh, and return its value (null on error). */
export async function settingsRpc(fn, args, okMsg, reload) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) { toast(friendly(error)); return null; }
  if (okMsg) toast(okMsg);
  reload();
  return data ?? true;
}
