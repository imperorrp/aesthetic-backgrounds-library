/**
 * ASCII Art Definitions Module
 *
 * @description Defines ASCII art strings for all structure types used in background rendering.
 * @module
 */

export type StructureType = 
  | 'station' | 'shipyard' | 'jumpgate' | 'comm_buoy' | 'defense_grid' | 'mining_outpost'
  | 'dyson_sphere' | 'ringworld' | 'stellar_lifter' | 'matrioshka_brain' | 'penrose_sphere'
  | 'black_hole' | 'neutron_star' | 'quasar' | 'magnetar' | 'rogue_planet'
  | 'void_rift' | 'precursor_relic' | 'ancient_gate' | 'psionic_beacon' | 'derelict_hulk' | 'monolith';

// ASCII art definitions for all structure types, upgraded with larger and more detailed multi-line representations
export const ASCII_ART: Record<StructureType, string[]> = {
  // --- INFRASTRUCTURE ---
  station: [
    "   /===\\",
    "  |[###]|",
    " -|[=]=|-",
    "  |[###]|",
    "   \\===/"
  ],
  shipyard: [
        "  _|_|_  ",
      " /  |  /",
    "| [===] |",
    "|  | |  |",
    " \\__|__/"
  ],
  mining_outpost: [
    "   ___   ",
    "  /###\\  ",
    " [|X X|] ",
    "  |XXX|  ",
    "  '---'  "
  ],
  comm_buoy: [
    "    ^    ",
    "   /|\\   ",
    "  /_O_\\  ",
    "   / \\   ",
    "   ' '   "
  ],
  defense_grid: [
    "  _===_  ",
    " /| X |\\ ",
    "|=| X |=|",
    " \\| X |/ ",
    "  '---'  "
  ],
  jumpgate: [
    "  .---.  ",
    " /==O==\\ ",
    "|==/ \\==|",
    " \\==O==/ ",
    "  '---'  "
  ],

  // --- MEGASTRUCTURES ---
  dyson_sphere: [
    "   .----.   ",
    "  /######\\  ",
    " /########\\ ",
    "|##########|",
    " \\########/ ",
    "  \\______/  "
  ],
  ringworld: [
    "    .----.    ",
    "  /  /\\  \\  ",
    " /  /  \\  \\ ",
    "|  |    |  |",
    " \\  \\  /  / ",
    "  \\__/\\__/  "
  ],
  stellar_lifter: [
    "   _|_|_   ",
    "  /_| |_\\  ",
    "   ( O )   ",
    "    / \\    ",
    "    ' '    "
  ],
  matrioshka_brain: [
    "   .----.   ",
    "  (######)  ",
    " (########) ",
    "(##########)",
    " (########) ",
    "  (######)  ",
    "   '----'   "
  ],
  penrose_sphere: [
    "    /\\    ",
    "   /  \\   ",
    "  /++++\\  ",
    " /++++++\\ ",
    " \\++++++/ ",
    "  \\++++/  ",
    "   \\  /   ",
    "    \\/    "
  ],

  // --- CELESTIAL HAZARDS ---
  black_hole: [
    "   .--.   ",
    "  / :::::\\",
    "  |  @ @ | ",
    "  |  o   |",
    "  \\ :::::/",
    "   '----' "
  ],
  neutron_star: [
    "   \\ | /   ",
    "  --  *  --  ",
    "   / | \\   ",
    "    '-'    "
  ],
  quasar: [
    "   \\\\|////  ",
    "  --==*==-- ",
    "   ////|\\\\  ",
    "    '  '   "
  ],
  magnetar: [
    "  _+-_  ",
    " /+ -\\ ",
    " | +- | ",
    " \\_ -/ ",
    "  ' '  "
  ],
  rogue_planet: [
    "   .---.   ",
    "  /  o  \\  ",
    " |  o o  | ",
    "  \\  o  /  ",
    "   '---'   "
  ],

  // --- MYSTERIES / ANCIENT ---
  monolith: [
    "    ____   ",
    "   |    |  ",
    "   | || |  ",
    "   | || |  ",
    "   |____|  "
  ],
  ancient_gate: [
    "   \\/\\/   ",
    "  /----\\  ",
    " | [ O ] | ",
    "  \\----/  ",
    "   /\\/\\   "
  ],
  void_rift: [
    "   %   %   ",
    "  % % % %  ",
    " %  % %  % ",
    "  % % % %  ",
    "   %   %   "
  ],
  precursor_relic: [
    "   /!!\\  ",
    "  | !  | ",
    "  | !  | ",
    "   \\__/  "
  ],
  psionic_beacon: [
    "    _*__   ",
    "  /_/ \\_\\  ",
    "  \\_\\_/ /  ",
    "    ' '    "
  ],
  derelict_hulk: [
    "  ___  ",
    " /###\\ ",
    "| X X |",
    "|_###_|"
  ]
};