import { useState } from 'react';
import { supabase, friendly } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';

// Admins only: rename, bench, or add players.
export default function PlayersForm({ data, reload }) {
  const [rows, setRows] = useState(data.players.map((p) => ({ id: p.id, name: p.name, active: p.active })));
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const changed = rows.filter((r) => {
    const p = data.players.find((x) => x.id === r.id);
    return p && (p.name !== r.name.trim() || p.active !== r.active) && r.name.trim();
  });

  async function save() {
    setBusy(true);
    for (const r of changed) {
      const { error } = await supabase.from('players').update({ name: r.name.trim().slice(0, 24), active: r.active }).eq('id', r.id);
      if (error) { toast(friendly(error)); setBusy(false); return; }
    }
    setBusy(false);
    toast('Players updated.');
    reload();
  }
  async function add(e) {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    const { data: row, error } = await supabase.from('players')
      .insert({ league_id: data.league.id, name: n.slice(0, 24), sort: data.players.length }).select().single();
    if (error) { toast(friendly(error)); return; }
    setRows([...rows, { id: row.id, name: row.name, active: true }]);
    setNewName('');
    toast(`${row.name} added.`);
    reload();
  }

  return (
    <section>
      <span className="lbl">Players</span>
      <div className="p-list">
        {rows.map((r, i) => (
          <div key={r.id} className={`p-row${r.active ? '' : ' off'}`}>
            <input aria-label="Player name" value={r.name} maxLength={24} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <button type="button" className="btn small" onClick={() => setRows(rows.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))}>{r.active ? 'Bench' : 'Bring back'}</button>
          </div>
        ))}
      </div>
      {changed.length > 0 && <button className="btn small primary" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={save}>Save {changed.length} change{changed.length > 1 ? 's' : ''}</button>}
      <form className="p-row" onSubmit={add}>
        <input aria-label="New player name" placeholder="Add a player" maxLength={24} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn small" type="submit">Add</button>
      </form>
      <p className="fine">Benched players keep their history but drop out of new weeks.</p>
    </section>
  );
}
