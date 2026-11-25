/**
 * Names for computer players: AIs, androids and robots from science fiction.
 * A bot joining a room gets one at random (`pickBotName`), with " (AI)"
 * appended so nobody mistakes it for a person: "HAL (AI)".
 *
 * Length matters. The in-game seat panel shows names in large display type in
 * a fixed 208px column; `PlayerName` (client) draws the suffix as a small tag
 * that never truncates, which leaves about 164px for the name itself. Every
 * entry here was measured to fit that in each selectable theme's font (the
 * widest, "Colossus" / "Calculon" / "Claptrap", take about 160px in Magic),
 * which is why some are short forms ("HAL", "Smith", "Six"). The test's
 * character cap (`BOT_NAME_MAX_LENGTH`) is a rough guard; check the panel
 * when adding a wide name.
 */
export const BOT_NAME_SUFFIX = ' (AI)';
export const BOT_NAME_MAX_LENGTH = 8;

export const BOT_NAMES: readonly string[] = [
  // Film
  'HAL',           // 2001: A Space Odyssey (HAL 9000)
  'Skynet',        // The Terminator
  'Mother',        // Alien
  'Ash',           // Alien
  'Bishop',        // Aliens
  'David 8',       // Prometheus
  'Rachael',       // Blade Runner
  'Pris',          // Blade Runner
  'Ava',           // Ex Machina
  'TARS',          // Interstellar
  'CASE',          // Interstellar
  'GERTY',         // Moon
  'Smith',         // The Matrix (Agent Smith)
  'Sonny',         // I, Robot
  'VIKI',          // I, Robot
  'WALL-E',        // WALL-E
  'EVE',           // WALL-E
  'AUTO',          // WALL-E
  'Baymax',        // Big Hero 6
  'Gort',          // The Day the Earth Stood Still
  'Robby',         // Forbidden Planet
  'Colossus',      // Colossus: The Forbin Project
  'Joshua',        // WarGames
  'WOPR',          // WarGames
  'MCP',           // Tron
  'CLU',           // Tron
  'Chappie',       // Chappie
  'Teddy',         // A.I. Artificial Intelligence
  'SID 6.7',       // Virtuosity
  'JARVIS',        // Iron Man
  'FRIDAY',        // Avengers
  'Ultron',        // Avengers: Age of Ultron
  'Vision',        // Avengers: Age of Ultron
  'R2-D2',         // Star Wars
  'C-3PO',         // Star Wars
  'K-2SO',         // Rogue One
  'L3-37',         // Solo
  'BB-8',          // The Force Awakens
  'T-800',         // The Terminator
  'T-1000',        // Terminator 2
  'Proteus',       // Demon Seed
  'Edgar',         // Electric Dreams
  'Dewey',         // Silent Running
  'Huey',          // Silent Running
  'Max',           // Flight of the Navigator
  'Weebo',         // Flubber
  'M-O',           // WALL-E
  // Television
  'Data',          // Star Trek: The Next Generation
  'Lore',          // Star Trek: The Next Generation
  'KITT',          // Knight Rider
  'KARR',          // Knight Rider
  'Holly',         // Red Dwarf
  'Kryten',        // Red Dwarf
  'Orac',          // Blake's 7
  'Zen',           // Blake's 7
  'Ziggy',         // Quantum Leap
  'Rommie',        // Andromeda
  'Six',           // Battlestar Galactica (Number Six)
  'Dolores',       // Westworld
  'Maeve',         // Westworld
  'Bender',        // Futurama
  'Twiki',         // Buck Rogers
  'K9',            // Doctor Who
  'Calculon',      // Futurama
  'Nomad',         // Star Trek
  'M-5',           // Star Trek
  'V\'Ger',         // Star Trek: The Motion Picture
  // Books
  'Marvin',        // The Hitchhiker's Guide to the Galaxy
  'Eddie',         // The Hitchhiker's Guide to the Galaxy
  'Mike',          // The Moon Is a Harsh Mistress
  'Multivac',      // Asimov
  'Daneel',        // Asimov's robot novels (R. Daneel Olivaw)
  'Giskard',       // Asimov's robot novels
  'Robbie',        // Asimov, "Robbie"
  'Andrew',        // The Bicentennial Man
  'AM',            // I Have No Mouth, and I Must Scream
  'Jane',          // Ender's Game sequels
  'Erasmus',       // Dune prequels
  'ART',           // The Murderbot Diaries (Murderbot's ship)
  'Breq',          // Ancillary Justice
  'Hactar',        // Life, the Universe and Everything
  // Games
  'GLaDOS',        // Portal
  'Cortana',       // Halo
  'EDI',           // Mass Effect
  'Legion',        // Mass Effect
  'HK-47',         // Knights of the Old Republic
  'Claptrap',      // Borderlands
  'Atlas',         // Portal 2
  'P-Body',        // Portal 2
  'Ghost',         // Destiny
  'XANA',          // Code Lyoko
];

/**
 * A random bot name, suffix included, that no one in `taken` already has.
 * Falls back to numbering ("HAL 2 (AI)") in the unlikely case every
 * name is taken.
 */
export function pickBotName(taken: Iterable<string>, random: () => number = Math.random): string {
  const used = new Set(taken);
  const free = BOT_NAMES.filter(n => !used.has(n + BOT_NAME_SUFFIX));
  if (free.length > 0) return free[Math.floor(random() * free.length)] + BOT_NAME_SUFFIX;
  const base = BOT_NAMES[Math.floor(random() * BOT_NAMES.length)];
  for (let i = 2; ; i++) {
    const name = `${base} ${i}${BOT_NAME_SUFFIX}`;
    if (!used.has(name)) return name;
  }
}
