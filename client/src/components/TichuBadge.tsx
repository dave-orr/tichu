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
        className={`tichu-badge ${isGrand ? 'tichu-badge-grand' : ''} inline-flex items-center text-lg font-extrabold rounded-md px-1.5 py-0.5 leading-none tracking-wide text-cream ${
          isGrand
            ? 'bg-[#3B6FD6] shadow-[0_2px_0_#24489A]'
            : 'bg-sap shadow-[0_2px_0_rgb(var(--c-sap-dark))]'
        }`}
      >
        {isGrand ? 'GT' : 'T'}
      </span>
      {status === 'made' && (
        <span className="text-good text-2xl font-black leading-none" title="Completed">✓</span>
      )}
      {status === 'failed' && (
        <span className="text-bad text-2xl font-black leading-none" title="Failed">✗</span>
      )}
    </span>
  );
}
