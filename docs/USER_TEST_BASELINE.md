# User Test Baseline

## Project

Lego, Robotter og Programmering

## Target Users

10-16 år.

## Primary User Flow

Landing -> Niveau -> Robot -> Byggeguide -> Kodehjælp uden at forlade byggeguiden

## Technical Baseline

- 20 projekter
- 20 byggeguides
- 1.132 manualsider
- 11 biblioteksemner
- GitHub Pages: https://aftenholdet.github.io/
- Baseline commit: `28eddf5335ba07c1d4c2a8add9dc48624635bf8e`
- Tests: lint, 39/39 automatiserede tests, runtime-validering, statisk build og browser-smoke bestaaet
- Online smoke: desktop og mobil bestaaet uden console-fejl, 404-responses eller manglende runtime-assets

## Known Content Limitations

- Blokkode mangler i de nuværende kilder for dele af Afstandssensor, Farvesensor, Kraftsensor, Motor, Hvis ... Ellers og Hub SPIKE Prime.
- MINDSTORMS-tekstkode mangler for `Kør to motorer samtidig` under Motor og for Asynkrone Tråde.
- Fire fjernstyringsafsnit under Hub Mindstorms er markeret `Kommer snart` i kildematerialet.

## UX Feedback Should Not Be Implemented One User at a Time

Observationer fra brugertests samles i batches og prioriteres efter mønstre, alvor og betydning for kerneflowet. Enkeltstående præferencer implementeres ikke straks, så projektet ikke oscillerer mellem individuelle ønsker, før teamet har et samlet beslutningsgrundlag.
