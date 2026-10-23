import { useTranslation } from 'react-i18next';

/** Pastille indiquant si une entité est partagée au foyer ou personnelle. */
export function ScopeBadge({ ownerId }: { ownerId: string | null }) {
  const { t } = useTranslation();
  return ownerId === null ? (
    <span className="chip border-teal-400/25 bg-teal-400/10 text-teal-300">
      {t('scope.household')}
    </span>
  ) : (
    <span className="chip text-slate-400">{t('scope.personal')}</span>
  );
}
