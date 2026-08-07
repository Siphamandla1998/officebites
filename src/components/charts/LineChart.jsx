export default function LineChart({
  data = [],
  xKey,
  yKey,
  height = 140,
  stroke = "#B8925A",
}) {
  const width = 320;

  // Prevent null/undefined crashes
  const chartData = Array.isArray(data) ? data : [];

  // Empty state
  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const values = chartData.map((d) => Number(d[yKey]) || 0);

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const stepX = width / (chartData.length - 1 || 1);

  const points = chartData.map((d, i) => {
    const x = i * stepX;
    const y =
      height -
      ((Number(d[yKey]) - min) / range) * (height - 16) -
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
      {/* Area */}
      <path
        d={areaPath}
        fill={`${stroke}22`}
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
      />

      {/* Points */}
      {chartData.map((d, i) => {
        const [x, y] = points[i].split(",");

        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            fill={stroke}
          />
        );
      })}

      {/* Labels */}
      {chartData.map((d, i) => (
        <text
          key={i}
          x={i * stepX}
          y={height - 2}
          textAnchor="middle"
          fontSize="10"
        >
          {d[xKey]}
        </text>
      ))}
    </svg>
  );
}
