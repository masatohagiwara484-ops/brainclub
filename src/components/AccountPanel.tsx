import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AVATARS,
  signIn,
  signOut,
  syncNow,
  updateProfile,
  useCloud,
} from '../lib/cloud';

// The optional cloud-account card on the Profile page. Hidden entirely when the
// build has no Supabase credentials. Passwordless: enter an email, get a magic
// link; once signed in you can edit your name/avatar and your progress syncs.
export default function AccountPanel() {
  const { t } = useTranslation();
  const cloud = useCloud();
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  if (cloud.status === 'disabled') return null;

  const card = 'rounded-2xl bg-slate-50 p-4';

  // ---- signed out: magic-link sign-in ----
  if (cloud.status === 'signed-out') {
    if (cloud.linkSentTo) {
      return (
        <div className={`${card} text-center`}>
          <div className="text-2xl">📬</div>
          <p className="mt-1 text-sm text-slate-600">
            {t('account.linkSent', { email: cloud.linkSentTo })}
          </p>
        </div>
      );
    }
    return (
      <div className={card}>
        <h2 className="font-dot text-sm font-semibold text-slate-700">{t('account.title')}</h2>
        <p className="mt-1 text-xs leading-snug text-slate-400">{t('account.cloudHint')}</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) void signIn(email.trim());
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('account.emailPlaceholder')}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={cloud.busy}
            className="shrink-0 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brandDark disabled:opacity-50"
          >
            {cloud.busy ? t('account.sending') : t('account.sendLink')}
          </button>
        </form>
        {cloud.error && <p className="mt-2 text-xs text-rose-500">{cloud.error}</p>}
      </div>
    );
  }

  // ---- signed in ----
  const acc = cloud.account!;

  const startEdit = () => {
    setName(acc.username);
    setAvatar(acc.avatar);
    setEditing(true);
  };
  const save = () => {
    void updateProfile({ username: name.trim().slice(0, 24) || acc.username, avatar });
    setEditing(false);
  };

  return (
    <div className={card}>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-2xl shadow-sm">
          {acc.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-800">{acc.username}</div>
          <div className="truncate text-xs text-slate-400">{acc.email}</div>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-blue-50"
          >
            {t('account.edit')}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <label className="text-xs font-semibold text-slate-500">{t('account.username')}</label>
          <input
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <label className="mt-3 block text-xs font-semibold text-slate-500">
            {t('account.avatar')}
          </label>
          <div className="mt-1 grid grid-cols-6 gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className={`grid aspect-square place-items-center rounded-xl text-xl transition ${
                  a === avatar ? 'bg-brand/15 ring-2 ring-brand' : 'bg-white hover:bg-slate-100'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={cloud.busy}
              className="flex-1 rounded-xl bg-brand py-2 text-sm font-semibold text-white hover:bg-brandDark disabled:opacity-50"
            >
              {t('account.save')}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              {t('account.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
        <span className="text-slate-400">
          {cloud.busy ? `⏳ ${t('account.syncing')}` : `✓ ${t('account.synced')}`}
        </span>
        <div className="flex gap-3">
          <button onClick={() => void syncNow()} disabled={cloud.busy} className="font-semibold text-brand disabled:opacity-50">
            {t('account.syncNow')}
          </button>
          <button onClick={() => void signOut()} className="font-semibold text-slate-400 hover:text-rose-500">
            {t('account.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
