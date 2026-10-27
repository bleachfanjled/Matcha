import React, { useState } from 'react';
import { Download, Eye, EyeOff, KeyRound, LockKeyhole, Pencil, Plus, Trash2, UnlockKeyhole, Upload } from 'lucide-react';
import SnowCapped from '@/components/SnowCapped';
import { passwordVault } from '@/lib/passwordVault';

const emptyDraft = { site: '', username: '', password: '' };

function normalizeSite(value) {
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  return url.origin;
}

export default function PasswordsPage({ onVaultChange }) {
  const [initialized, setInitialized] = useState(passwordVault.isInitialized());
  const [unlocked, setUnlocked] = useState(passwordVault.isUnlocked());
  const [masterPassword, setMasterPassword] = useState('');
  const [records, setRecords] = useState(() => (passwordVault.isUnlocked() ? passwordVault.list() : []));
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [visibleIds, setVisibleIds] = useState(() => new Set());
  const [error, setError] = useState('');
  const backupInput = React.useRef(null);

  const unlock = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const next = await passwordVault.unlock(masterPassword);
      setRecords(next);
      setUnlocked(true);
      setInitialized(true);
      setMasterPassword('');
      onVaultChange?.(true);
    } catch (failure) {
      setError(failure.message || 'Could not unlock the vault.');
    }
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const next = await passwordVault.save({
        id: editingId || undefined,
        site: normalizeSite(draft.site.trim()),
        username: draft.username.trim(),
        password: draft.password,
      });
      setRecords(next);
      setDraft(emptyDraft);
      setEditingId(null);
    } catch (failure) {
      setError(failure.message || 'Could not save this password.');
    }
  };

  const editRecord = (record) => {
    setEditingId(record.id);
    setDraft({ site: record.site, username: record.username, password: record.password });
  };

  const lock = () => {
    passwordVault.lock();
    setRecords([]);
    setUnlocked(false);
    onVaultChange?.(false);
  };

  const exportBackup = () => {
    try {
      const data = passwordVault.exportEncrypted();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'matcha-air-password-vault.encrypted.json';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (failure) { setError(failure.message || 'Could not export encrypted backup.'); }
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const envelope = JSON.parse(await file.text());
      const phrase = unlocked ? window.prompt('Enter the master password used for this encrypted backup.') : masterPassword;
      if (!phrase) return;
      const next = await passwordVault.importEncrypted(envelope, phrase);
      setRecords(next);
      setUnlocked(true);
      setInitialized(true);
      setMasterPassword('');
      onVaultChange?.(true);
    } catch (failure) {
      setError(failure.message || 'Could not import this encrypted backup.');
    }
  };

  return (
    <div className="local-page">
      <div className="local-page-head">
        <div className="local-page-url"><KeyRound size={14} /> matcha://passwords</div>
        {unlocked && <button className="tool-btn px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" onClick={lock}><LockKeyhole size={14} /> Lock vault</button>}
      </div>
      <p className="local-page-sub">Your passwords are encrypted on this device. The vault master password cannot be recovered. Use an encrypted backup to move your vault to another device.</p>

      {!unlocked ? (
        <SnowCapped capHeight={6} className="rounded-2xl">
          <form className="glass-panel local-section" onSubmit={unlock}>
            <div className="local-section-head"><UnlockKeyhole size={15} /> {initialized ? 'Unlock password vault' : 'Create your password vault'}</div>
            <p className="settings-sub" style={{ marginBottom: 14 }}>
              {initialized ? 'Enter your master password to open your encrypted passwords.' : 'Choose a strong master password. Matcha Air encrypts saved passwords with AES-GCM and never stores this master password.'}
            </p>
            <input
              className="frost-input w-full px-3 py-2 text-sm"
              type="password"
              autoComplete="current-password"
              value={masterPassword}
              onChange={(event) => setMasterPassword(event.target.value)}
              placeholder="Vault master password"
              minLength={initialized ? undefined : 12}
              required
            />
            {error && <p role="alert" className="text-sm mt-2" style={{ color: 'var(--danger, #ef7777)' }}>{error}</p>}
            <button className="action-btn px-4 py-2 rounded-lg text-sm mt-3" type="submit">
              {initialized ? 'Unlock' : 'Create encrypted vault'}
            </button>
            <input ref={backupInput} type="file" accept="application/json,.json" onChange={importBackup} hidden />
            <button className="tool-btn px-4 py-2 rounded-lg text-sm mt-3 ml-2" type="button" onClick={() => {
              if (!masterPassword) { setError('Enter the backup master password above first.'); return; }
              backupInput.current?.click();
            }}><Upload size={14} style={{ display: 'inline', marginRight: 6 }} />Import encrypted backup</button>
            <p className="settings-sub mt-2">Backups contain ciphertext only. The same master password is required on every device. Keep the backup file somewhere private.</p>
          </form>
        </SnowCapped>
      ) : (
        <>
          <section className="glass-panel local-section">
            <div className="local-section-head">Move vault to another device</div>
            <p className="settings-sub">Export creates an encrypted file. Import replaces this device’s vault after the backup password is verified.</p>
            <input ref={backupInput} type="file" accept="application/json,.json" onChange={importBackup} hidden />
            <div className="flex gap-2 mt-3">
              <button type="button" className="tool-btn px-3 py-2 rounded-lg text-sm" onClick={exportBackup}><Download size={14} style={{ display: 'inline', marginRight: 6 }} />Export encrypted backup</button>
              <button type="button" className="tool-btn px-3 py-2 rounded-lg text-sm" onClick={() => backupInput.current?.click()}><Upload size={14} style={{ display: 'inline', marginRight: 6 }} />Import backup</button>
            </div>
          </section>
          <SnowCapped capHeight={6} className="rounded-2xl">
            <form className="glass-panel local-section" onSubmit={saveRecord}>
              <div className="local-section-head"><Plus size={15} /> {editingId ? 'Update password' : 'Add password'}</div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
                <label className="grid gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>Website
                  <input className="frost-input px-3 py-2 text-sm" value={draft.site} onChange={(event) => setDraft({ ...draft, site: event.target.value })} placeholder="example.com" required />
                </label>
                <label className="grid gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>Username or email
                  <input className="frost-input px-3 py-2 text-sm" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} autoComplete="username" />
                </label>
                <label className="grid gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>Password
                  <input className="frost-input px-3 py-2 text-sm" type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} autoComplete="new-password" required />
                </label>
              </div>
              {error && <p role="alert" className="text-sm mt-2" style={{ color: 'var(--danger, #ef7777)' }}>{error}</p>}
              <div className="flex gap-2 mt-3">
                <button className="action-btn px-4 py-2 rounded-lg text-sm flex items-center gap-2" type="submit"><KeyRound size={14} /> {editingId ? 'Update' : 'Save password'}</button>
                {editingId && <button className="tool-btn px-4 py-2 rounded-lg text-sm" type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>Cancel</button>}
              </div>
            </form>
          </SnowCapped>

          <section className="local-section">
            <div className="local-section-head">Saved passwords <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{records.length}</span></div>
            <div className="grid gap-2">
              {records.length === 0 && <p className="settings-sub">No passwords saved yet. You can add one above or save it from a sign-in form.</p>}
              {records.map((record) => (
                <div className="glass-panel flex items-center gap-3 p-3" key={record.id}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{record.site}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{record.username || 'No username'} · {visibleIds.has(record.id) ? record.password : '••••••••'}</div>
                  </div>
                  <button className="tool-btn p-2" type="button" title={visibleIds.has(record.id) ? 'Hide password' : 'Show password'} onClick={() => setVisibleIds((current) => { const next = new Set(current); next.has(record.id) ? next.delete(record.id) : next.add(record.id); return next; })}>{visibleIds.has(record.id) ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  <button className="tool-btn p-2" type="button" title="Edit password" onClick={() => editRecord(record)}><Pencil size={15} /></button>
                  <button className="tool-btn p-2" type="button" title="Delete password" onClick={async () => setRecords(await passwordVault.remove(record.id))}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
