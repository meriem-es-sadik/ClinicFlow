export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon ? (
        <span className="empty-state__icon">
          <Icon size={26} />
        </span>
      ) : null}
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
