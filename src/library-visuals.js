// Hardware photos and app icons are extracted from the original lesson PPTX files.
export const topicVisuals = {
  afstandssensor: { image: 'assets/library/afstandssensor.webp', hint: 'Hvor langt er der?' },
  farvesensor: { image: 'assets/library/farvesensor.webp', hint: 'Hvilken farve ser du?' },
  kraftsensor: { image: 'assets/library/kraftsensor.webp', hint: 'Tryk, og få noget til at ske.' },
  motor: { image: 'assets/library/motor.webp', hint: 'Sæt din robot i bevægelse.' },
  vent: {
    image: 'assets/generated/library/blocks/vent.webp',
    platformImages: { mindstorms: darkImage('assets/library/mindstorms/cards/vent.webp') },
    hint: 'Giv din robot en lille pause.',
  },
  gentag: {
    image: 'assets/generated/library/blocks/gentag.webp',
    platformImages: { mindstorms: darkImage('assets/library/mindstorms/cards/gentag.webp') },
    hint: 'Gør det igen. Og igen.',
  },
  'hvis-ellers': {
    image: 'assets/generated/library/blocks/hvis-ellers.webp',
    platformImages: { mindstorms: darkImage('assets/library/mindstorms/cards/hvis-ellers.webp') },
    hint: 'Lad din robot vælge, hvad den gør.',
  },
  mapping: { hint: 'Lav ét tal om til et andet.' },
  'asynkrone-traade': {
    image: 'assets/generated/library/blocks/asynkrone-traade.webp',
    platformImages: { mindstorms: darkImage('assets/library/mindstorms/cards/asynkrone-traade.webp') },
    hint: 'Få flere ting til at ske samtidig.',
  },
  'hub-spike-prime': { image: 'assets/library/spike-hub.webp', hint: 'Leg med lys, lyd og knapper.' },
  'hub-mindstorms': { image: 'assets/library/mindstorms-hub.webp', hint: 'Fjernstyr din robot.' },
};

function darkImage(src) {
  return { src, surface: 'dark' };
}

export const categorySymbols = { all: '▦', sensorer: '◉', motor: '⚙', programlogik: '↻', hub: '▦' };
