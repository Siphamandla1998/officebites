export default function LineChart({
  data = [],
  xKey,
  yKey,
  height = 140,
  stroke = "#B8925A",
}) {
  const safeData = Array.isArray(data) ? data : [];

  if (safeData.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-sm text-ink-muted">
        No data available yet
      </div>
    );
  }

  const width = 320;

  const values = safeData.map((d) => Number(d[yKey]) || 0);

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);

  const range = max - min || 1;

  const stepX = width / (safeData.length - 1 || 1);

  const points = safeData.map((d, i) => {
    const x = i * stepX;
    const y =
      height -
      ((Number(d[yKey]) - min) / range) *
        (height - 16) -
      8;

    return `${x},${y}`;
  });


  const areaPath = `M0,${height} L${points.join(
    " L"
  )} L${width},${height} Z`;

  const linePath = `M${points.join(" L")}`;


  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ minWidth: 280 }}
    >
      <path
        d={areaPath}
        fill="rgba(184,146,90,0.12)"
      />

      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />

      {safeData.map((d, i) => {
        const [x, y] = points[i].split(",");

        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill={stroke}
          />
        );
      })}

      {safeData.map((d, i) => (
        <text
          key={i}
          x={i * stepX}
          y={height - 2}
          fontSize="9"
          textAnchor="middle"
        >
          {d[xKey]}
        </text>
      ))}
    </svg>
  );
}
