# ALMOST CHOSEN

**An interactive wish-lottery installation that transforms private wishes into probabilistic outcomes, printed tickets and an anonymous public archive.**

**Yutong Du · MA Computational Arts · 2026**

Video documentation: https://vimeo.com/1225091032?share=copy&fl=sv&fe=ci

## Overview

**Almost Chosen** is an interactive installation exploring chance, waiting and the desire to be selected.

Participants choose a category, enter a private wish and submit it to the system. The system assigns a **Wish Number** from `00–99`, generates a separate **System Draw**, and calculates the shortest circular distance between the two positions. The result becomes one of four outcomes: **CHOSEN**, **ALMOST CHOSEN**, **REGISTERED**, or **NOT THIS TIME**.

The same outcome drives the participant screen, sound cue, personalised A6 ticket and anonymous public projection. The submitted wish is not included in the public archive.

## Concept

The project developed from two experiences that felt structurally similar: buying lottery tickets with friends and waiting for university application results. In both situations, a person submits something, gives up control, waits, and hopes to be selected. Even when the probability is understood rationally, the result can still become emotionally significant.

The title **Almost Chosen** refers to this suspended state of being close to selection without fully reaching it.

A key artistic reference was **Ghost of a Dream**, particularly the use of discarded lottery tickets as material traces of hope, desire and imagined futures. This influenced the decision to make the printed ticket an important physical part of the installation. The project also relates to participatory and chance-based works including Yoko Ono's *Wish Tree* and Christian Boltanski's *Chance*.

## Interaction Flow

1. Choose one category: LOVE, FUTURE, HEALING, CONNECTION, FREEDOM, IDENTITY or OTHER.
2. Enter a private wish.
3. Submit the wish.
4. The system generates a Wish Number and a System Draw from `00–99`.
5. It calculates the shortest circular distance between them.
6. The distance determines the outcome.
7. The participant sees and hears the result and receives a personalised A6 ticket.
8. An anonymous version of the interaction is added to the public projection.

## Probability System

The number field is treated as a circular set of 100 positions.

```text
directDifference = |wishNumber - systemDraw|
wrapAround       = 100 - directDifference
circularDistance = min(directDifference, wrapAround)
```

The circular distance maps to the following result ranges:

| Circular distance | Outcome | Declared probability |
|---:|---|---:|
| `0` | CHOSEN | 1% |
| `1–27` | ALMOST CHOSEN | 54% |
| `28–41` | REGISTERED | 28% |
| `42–50` | NOT THIS TIME | 17% |

The shared probability engine is implemented in `src/lib/engine.ts`.

## Privacy and Public Archive

The participant-facing ticket can include the private wish text and draw information. The public archive uses an anonymous record containing system fields such as ticket ID, category, result, draw values, circular distance and timestamp.

The public record contains no `wishText` field.

Archive records are stored locally in the browser with `localStorage`. The participant and projection views synchronise in real time with `BroadcastChannel`, with the browser `storage` event used as a secondary synchronisation path.

## Physical Ticket

The A6 ticket creates a physical record of the interaction. The personalised front contains the wish, draw values and result. The reverse side is a fixed system guide explaining the `00–99` circular field, result ranges and public/private data rules.

To extend chance into the material object, exhibition tickets were printed on randomly selected sheets from a mix of coloured and textured paper stocks.

## Public Projection

The projection functions as a live anonymous archive. It visualises total interactions, observed result counts and percentages, declared probabilities, category distribution, recent ticket IDs and one anonymous visual mark for each archived interaction.

## Exhibition Outcome

The final exhibition recorded **118 interactions**:

| Result | Count | Observed |
|---|---:|---:|
| CHOSEN | 0 | 0% |
| ALMOST CHOSEN | 65 | 55% |
| REGISTERED | 33 | 28% |
| NOT THIS TIME | 20 | 17% |

No participant received CHOSEN during the exhibition even though the 1% outcome remained genuinely available. Several visitors repeated the interaction because they wanted to receive the rare CHOSEN result, and most participants spent time reading and keeping their printed ticket.

## Exhibition Hardware

- MacBook Air — main computer
- 15.6-inch portrait display — participant interface
- Projector — public projection / live archive
- HP Smart Tank 672 — A6 ticket output
- MacBook speakers — system audio

## Application Views

| Route | Purpose |
|---|---|
| `/participant` | Participant interaction, processing and result |
| `/projection` | Anonymous live public archive |
| `/admin` | Testing and calibration controls |
| `/print` | Personalised A6 ticket front |
| `/back-preprint` | Fixed A6 reverse-side system guide |
| `/` | Participant view |

## Tech Stack

- React 18
- TypeScript
- Vite
- p5.js
- Tailwind CSS
- Web Audio API
- BroadcastChannel API
- Web Storage / `localStorage`
- Browser print APIs

Core modules:

```text
src/lib/engine.ts        probability + circular-distance engine
src/lib/archive.ts       anonymous archive + live synchronisation
src/lib/ticket.ts        personalised ticket rendering
src/lib/ticketBack.ts    reverse-side system guide
src/lib/ticketRecord.ts  private/public record separation + print bridge
src/lib/sound.ts         procedural audio cues
```

## Setup and Run

Requirements: Node.js with Corepack and pnpm.

First-time installation:

```bash
corepack enable
pnpm install --no-frozen-lockfile
```

Run locally:

```bash
pnpm dev
```

Then open:

```text
http://localhost:3000/participant
http://localhost:3000/projection
```

On macOS, the included helper scripts can also be used:

```text
INSTALL_ONCE.command
RUN_LOCAL.command
RUN_EXHIBITION.command
```

For a production preview:

```bash
pnpm build
pnpm preview
```

## Printing Note

The physical exhibition used an HP Smart Tank 672 and automatic ticket printing. This repository is a standalone browser archival version of the project. It preserves the A6 print views and print-integration logic; in a normal browser, physical printing may still invoke the operating system print dialog.

The fixed ticket reverse can be opened at `/back-preprint` for batch pre-printing before an exhibition.

## Project Structure

```text
ALMOST-CHOSEN/
├── public/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── pages/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── INSTALL_ONCE.command
├── RUN_LOCAL.command
├── RUN_EXHIBITION.command
├── package.json
├── vite.config.ts
└── README.md
```

## Development

Early prototypes borrowed more directly from colourful lottery and game interfaces. As the system logic became more important, the design shifted toward a darker computational visual language using grids, numerical fields and data-like layouts.

Earlier terminology such as **WAITLISTED** and **ARCHIVED** was replaced by **REGISTERED**, which more accurately describes an interaction being recorded by the system without implying that the private wish itself becomes part of the public archive.

## Future Development

A future online version could allow the archive to continue beyond a single exhibition. One possible direction is a pseudonymous personal archive showing previous draws and repeated attempts without requiring real-world identity or publishing private wish content.

## Selected References

### Artistic / Conceptual

- Ghost of a Dream (Lauren Was and Adam Eckstrom), *Dream Home* (2009)  
  https://www.young-masters.co.uk/first-edition-2009-winners
- Yoko Ono, *Wish Tree*  
  https://www.guggenheim-bilbao.eus/en/the-collection/works/wish-tree-for-bilbao
- Christian Boltanski, *Chance* (2011)  
  https://fondschristianboltanski.com/en/oeuvres/chance/
- Rivane Neuenschwander, *I Wish Your Wish* (2003)  
  https://archive.newmuseum.org/exhibitions/1056
- Rafael Lozano-Hemmer, *Pulse Room* (2006)  
  https://www.lozano-hemmer.com/pulse_room.php

### Technical

- MDN, `Math.random()`  
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
- p5.js, `createGraphics()`  
  https://p5js.org/reference/p5/createGraphics/
- p5.js, `createCanvas()`  
  https://p5js.org/reference/p5/createCanvas/
- MDN, `localStorage`  
  https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- MDN, `BroadcastChannel`  
  https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- MDN, Web Audio API  
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

The full artistic, theoretical and technical bibliography is included in the submitted final documentation PDF.

## AI-Assisted Development

Atoms was used as an AI-assisted development environment during the prototyping and implementation of the web interface. ChatGPT was used for technical troubleshooting, debugging, workflow support and language editing. AI-generated outputs were reviewed, adapted and tested throughout development.

- Atoms: https://atoms.dev/
- OpenAI ChatGPT: https://chatgpt.com/

## Author

**Yutong Du**  
MA Computational Arts · 2026
