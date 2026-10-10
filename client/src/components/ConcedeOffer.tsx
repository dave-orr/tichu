type Props = {
  concederName: string;
  cardCount: number;
  alreadyAccepted: boolean;
  onRespond: (accept: boolean) => void;
};

/** Asks an opponent whether to accept a pending concession. */
export default function ConcedeOffer({ concederName, cardCount, alreadyAccepted, onRespond }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl max-w-md w-full">
        <h3 className="text-4xl font-bold text-center mb-4 text-yellow-400">
          Concession Offered
        </h3>
        <p className="text-gray-300 text-3xl text-center mb-4">
          {concederName} wants to concede the round
          ({cardCount} card{cardCount === 1 ? '' : 's'} left). Their hand goes to your team.
        </p>
        {alreadyAccepted ? (
          <p className="text-gray-400 text-2xl text-center italic">
            Accepted — waiting for your partner…
          </p>
        ) : (
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => onRespond(true)}
              className="py-3 px-6 bg-green-600 hover:bg-green-500 rounded-lg font-bold transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => onRespond(false)}
              className="py-3 px-6 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold transition-colors"
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
