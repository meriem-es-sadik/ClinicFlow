import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Pagination({ page, totalPages, total, limit, onChange }) {
  const { t, i18n } = useTranslation();

  if (!total) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const isRtl = i18n.dir() === 'rtl';
  const PreviousIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="pagination">
      <span className="pagination__summary">
        {t('common.paginationSummary', { from, to, total })}
      </span>
      <div className="pagination__controls">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => onChange(page - 1)}
          disabled={!canPrev}
          aria-label={t('common.previous')}
        >
          <PreviousIcon size={16} />
          {t('common.previous')}
        </button>
        <span className="pagination__page">
          {t('common.pageOf', { page, totalPages })}
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => onChange(page + 1)}
          disabled={!canNext}
          aria-label={t('common.next')}
        >
          {t('common.next')}
          <NextIcon size={16} />
        </button>
      </div>
    </div>
  );
}
