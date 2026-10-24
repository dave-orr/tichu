import HouseRules, { RULES, SectionLabel, type RuleToggle } from './HouseRules.js';
import ThemeGallery from './ThemeGallery.js';
import { useState } from 'react';
import { DEFAULT_SETTINGS, type GameSettings, type Theme } from '@tichu/shared';

type Props = {
  playerName: string;
  initialSettings?: Partial<GameSettings>;
  initialRandomPartners?: boolean;
  onCreateRoom: (randomPartners: boolean, settings: GameSettings) => void;
  onBack: () => void;
};

export default function CreateRoomForm({ playerName, initialSettings, initialRandomPartners, onCreateRoom, onBack }: Props) {
  const [randomPartners, setRandomPartners] = useState(initialRandomPartners ?? false);
  const [toggles, setToggles] = useState<Record<RuleToggle, boolean>>({
    countPoints: initialSettings?.countPoints ?? DEFAULT_SETTINGS.countPoints,
    cardsSeen: initialSettings?.cardsSeen ?? DEFAULT_SETTINGS.cardsSeen,
    showPassedCards: initialSettings?.showPassedCards ?? DEFAULT_SETTINGS.showPassedCards,
    clockwise: initialSettings?.clockwise ?? DEFAULT_SETTINGS.clockwise,
  });
  const [targetScore, setTargetScore] = useState(initialSettings?.targetScore ?? DEFAULT_SETTINGS.targetScore);
  const [theme, setTheme] = useState<Theme>(initialSettings?.theme ?? DEFAULT_SETTINGS.theme ?? 'papercraft');

  const isDefault = !randomPartners
    && RULES.every(r => toggles[r.key] === DEFAULT_SETTINGS[r.key])
    && targetScore === DEFAULT_SETTINGS.targetScore
    && theme === (DEFAULT_SETTINGS.theme ?? 'papercraft');

  const resetToDefaults = () => {
    setRandomPartners(false);
    setToggles({
      countPoints: DEFAULT_SETTINGS.countPoints,
      cardsSeen: DEFAULT_SETTINGS.cardsSeen,
      showPassedCards: DEFAULT_SETTINGS.showPassedCards,
      clockwise: DEFAULT_SETTINGS.clockwise,
    });
    setTargetScore(DEFAULT_SETTINGS.targetScore);
    setTheme(DEFAULT_SETTINGS.theme ?? 'papercraft');
  };

  return (
    <div className="w-full max-w-6xl">
      {/* Header: back, title, reset */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="btn btn-quiet flex items-center gap-2 pl-3 pr-4 py-2 text-base">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-3xl sm:text-4xl text-cream leading-tight">Set the Table</h1>
          <p className="text-cream/60 mt-1">
            New room, hosted by <span className="text-ochre-light font-semibold">{playerName}</span>
          </p>
        </div>
        <button
          onClick={resetToDefaults}
          disabled={isDefault}
          aria-label="Reset to defaults"
          className="btn btn-quiet flex items-center gap-2 px-4 py-2 text-base"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 3 3 9 9 9" />
          </svg>
          <span className="hidden sm:inline">Reset to defaults</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_25rem] gap-8">
        {/* Theme, then the call to action under it */}
        <section className="flex flex-col">
          <SectionLabel>Theme</SectionLabel>
          <div className="flex-1">
            <ThemeGallery value={theme} onChange={setTheme} />
          </div>
          <button
            onClick={() => onCreateRoom(randomPartners, { ...toggles, targetScore, theme })}
            className="btn btn-primary w-full mt-6 py-4 text-2xl"
          >
            Create Room
          </button>
        </section>

        {/* Rules */}
        <section>
          <SectionLabel>House Rules</SectionLabel>
          <HouseRules
            randomPartners={randomPartners}
            onRandomPartnersChange={setRandomPartners}
            toggles={toggles}
            onToggle={(key, value) => setToggles(prev => ({ ...prev, [key]: value }))}
            targetScore={targetScore}
            onTargetScoreChange={setTargetScore}
          />
        </section>
      </div>
    </div>
  );
}
