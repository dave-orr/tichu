import type { TichuCall } from '@tichu/shared';

// 'made' = caller went out first (call completed), 'failed' = call can no longer
// be completed (someone else went out first), 'pending' = still undecided.
export type TichuStatus = 'pending' | 'made' | 'failed';

export default function TichuBadge({ call, status = 'pending' }: { call: TichuCall; status?: TichuStatus }) {
  if (call === 'none') return null;
  const isGrand = call === 'grand';
  return (
    <span className="ml-1.5 inline-flex items-center align-middle gap-0.5">
      <span
        title={isGrand ? 'Grand Tichu' : 'Tichu'}
        className={`inline-flex items-center text-lg font-bold rounded px-1.5 py-0.5 leading-none tracking-wide shadow-sm ${
          isGrand
            ? 'bg-red-600 text-white border border-red-400'
            : 'bg-orange-500 text-white border border-orange-300'
        }`}
      >
        {isGrand ? 'GT' : 'T'}
      </span>
      {status === 'made' && (
        <span className="text-green-400 text-2xl font-black leading-none" title="Completed">✓</span>
      )}
      {status === 'failed' && (
        <span className="text-red-500 text-2xl font-black leading-none" title="Failed">✗</span>
      )}
    </span>
  );
}
