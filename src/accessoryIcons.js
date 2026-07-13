// Emoji fallbacks per accessory slot (used when an accessory has no iconUrl).
export const SLOT_ICONS = {
  EXHAUST: '🐉',
  WINGS: '🪽',
  BOOST: '⚡',
  BLADE: '🗡️',
  HELMET: '⛑️',
  TRAIL: '✨',
  BODY: '🏎️',
  SPECIAL: '🌟',
};

export const accessoryIcon = (a) => SLOT_ICONS[a?.slot] || '🎁';
