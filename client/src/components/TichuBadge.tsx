import type { TichuCall } from '@tichu/shared';

export default function TichuBadge({ call }: { call: TichuCall }) {
  if (call === 'none') return null;
  const isGrand = call === 'grand';
  return (
    <span
      title={isGrand ? 'Grand Tichu' : 'Tichu'}
      className={`ml-1.5 inline-flex items-center align-middle text-[10px] font-bold rounded px-1.5 py-0.5 leading-none tracking-wide shadow-sm ${
        isGrand
          ? 'bg-red-600 text-white border border-red-400'
          : 'bg-orange-500 text-white border border-orange-300'
      }`}
    >
      {isGrand ? 'GT' : 'T'}
    </span>
  );
}
