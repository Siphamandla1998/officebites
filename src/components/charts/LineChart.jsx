export default function LineChart({ data, xKey, yKey, height = 140, stroke = "#B8925A" }) {
  const width = 320;
  const max = Math.max(...data.map((d) => d[yKey]), 1);
  const min = Math.min(...data.map((d) => d[yKey]), 0);
  const range = max - min || 1;
  const stepX = width / (data.length - 1 || 1);

  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = height - ((d[yKey] - min) / range) * (height - 16) - 8;
    return `${x},${y}`;
  });

  const areaPath = `M0,${height} L${points.join(" L")} L${width},${height} Z`;
  const linePath = `M${points.join(" L")}`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 280 }}>
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#lineFill)" />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          const [x, y] = points[i].split(",");
          return <circle key={d[xKey]} cx={x} cy={y} r="3" fill={stroke} />;
        })}
      </svg>
      <div className="flex justify-between mt-1 px-0.5">
        {data.map((d) => (
          <span key={d[xKey]} className="text-[10px] text-ink-muted">
            {d[xKey]}
          </span>
        ))}
      </div>
    </div>
  );
}
