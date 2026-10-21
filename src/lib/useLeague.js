import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, friendly } from './supabase.js';

const TABLES = ['players', 'members', 'weeks', 'legs', 'spins', 'reactions'];

/**
 * Loads everything for one league and keeps it live. Any change by anyone
 * (a new pick, a grade, a spin) triggers a quick reload. A league's data is
 * small (a few hundred rows a season), so reloading it whole keeps this simple.
 * onSpin(spinRow) fires when someone spins, so open phones can animate it.
 */
export function useLeague(leagueId, onSpin) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef(null);
  const onSpinRef = useRef(onSpin);
  useEffect(() => { onSpinRef.current = onSpin; }, [onSpin]);

  const load = useCallback(async () => {
    if (!leagueId) return;
    const [lg, pl, mb, wk, lgs, sp, rx] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', leagueId).maybeSingle(),
      supabase.from('players').select('*').eq('league_id', leagueId).order('sort').order('created_at'),
      supabase.from('members').select('*').eq('league_id', leagueId).order('joined_at'),
      supabase.from('weeks').select('*').eq('league_id', leagueId).order('n'),
      supabase.from('legs').select('*').eq('league_id', leagueId).order('created_at'),
      supabase.from('spins').select('*').eq('league_id', leagueId).order('created_at'),
      supabase.from('reactions').select('*').eq('league_id', leagueId).order('created_at'),
    ]);
    const err = [lg, pl, mb, wk, lgs, sp, rx].find((r) => r.error);
    if (err) { setError(friendly(err.error)); return; }
    if (!lg.data) { setError('That league doesn’t exist or you’re not in it.'); return; }
    setError('');
    setData({ league: lg.data, players: pl.data, members: mb.data, weeks: wk.data, legs: lgs.data, spins: sp.data, reactions: rx.data });
  }, [leagueId]);

  const reload = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 120);
  }, [load]);

  useEffect(() => {
    if (!leagueId) return undefined;
    load();
    const ch = supabase.channel('league-' + leagueId);
    TABLES.forEach((t) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `league_id=eq.${leagueId}` }, (payload) => {
        if (t === 'spins' && payload.eventType === 'INSERT' && onSpinRef.current) onSpinRef.current(payload.new);
        reload();
      });
    });
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'leagues', filter: `id=eq.${leagueId}` }, reload);
    // Supabase can't filter delete events by league, so listen for all of them
    // (a removed pick or reaction) and reload. With one group, that's cheap.
    ['legs', 'reactions', 'weeks', 'players'].forEach((t) => {
      ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, reload);
    });
    ch.subscribe();

    // Phones drop live connections in the background; catch up when the app comes back.
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearTimeout(timer.current);
      supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [leagueId, load, reload]);

  return { data, error, reload: load };
}
