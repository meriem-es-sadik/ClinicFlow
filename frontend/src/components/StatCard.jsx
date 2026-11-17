export default function StatCard({ icon: Icon, label, value, tone = 'teal', hint }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__top">
        <span className="stat-card__icon">
          <Icon size={20} />
        </span>
        <span className="stat-card__label">{label}</span>
      </div>
      <div className="stat-card__value">{value}</div>
      {hint ? <div className="stat-card__hint">{hint}</div> : null}
    </article>
  );
}
