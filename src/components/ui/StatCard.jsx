export default function StatCard({ label, value, icon: Icon, trend, trendUp }) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-nude-100 flex items-center justify-center text-nude-700">
            <Icon size={15} />
          </div>
        )}
      </div>
      <span className="text-xl font-bold text-ink tracking-tight">{value}</span>
      {trend && (
        <span className={`text-xs font-medium ${trendUp ? "text-success" : "text-danger"}`}>
          {trend}
        </span>
      )}
    </div>
  );
}
