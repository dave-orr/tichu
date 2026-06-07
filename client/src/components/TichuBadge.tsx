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
            ? 'bg-blue-600 text-white border border-blue-400'
            : 'bg-green-600 text-white border border-green-400'
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
