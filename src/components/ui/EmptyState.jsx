export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && (
        <div className="h-14 w-14 rounded-2xl bg-nude-100 flex items-center justify-center text-nude-600 mb-4">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-semibold text-ink mb-1">{title}</h4>
      {description && <p className="text-xs text-ink-muted max-w-[240px]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
