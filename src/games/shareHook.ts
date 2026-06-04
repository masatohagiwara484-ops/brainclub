// Tiny shared hook for the "Share" button every game's result modal exposes.
// Wraps lib/share's shareText with the ephemeral "Shared!/Copied!" toast text,
// so each game doesn't re-implement the same six lines.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shareText } from '../lib/share';

export function useShareMsg(): { shareMsg: string | null; doShare: (text: string) => Promise<void> } {
  const { t } = useTranslation();
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const doShare = async (text: string) => {
    const r = await shareText(text);
    setShareMsg(r === 'shared' ? t('share.shared') : r === 'copied' ? t('share.copied') : t('share.failed'));
    setTimeout(() => setShareMsg(null), 2500);
  };
  return { shareMsg, doShare };
}
