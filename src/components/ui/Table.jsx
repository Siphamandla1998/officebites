export default function Table({ columns, data, keyField = "id", emptyLabel = "No data yet" }) {
  if (!data?.length) {
    return (
      <div className="card p-10 text-center text-sm text-ink-muted">{emptyLabel}</div>
    );
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="border-b border-line">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left text-xs font-medium uppercase tracking-wide text-ink-muted px-4 py-3 whitespace-nowrap"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[keyField]} className="border-b border-line last:border-0 hover:bg-nude-50/60">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3.5 text-ink-soft whitespace-nowrap">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
