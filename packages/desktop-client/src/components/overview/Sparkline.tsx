import { theme } from '@actual-app/components/theme';

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 200;
      const y = 17 - ((value - min) / range) * 14;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 200 20"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ width: '100%', height: 18 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={theme.buttonPrimaryBackground}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
