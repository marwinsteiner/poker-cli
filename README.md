# poker-cli

A colorful terminal-based Heads-Up No-Limit Texas Hold'em game.

```
╔═══════════════════════════════════════════════════╗
║              DEALER (Computer)                    ║
║               Chips: $1500                        ║
║           ┌─────┐ ┌─────┐                         ║
║           │░░░░░│ │░░░░░│                          ║
║           └─────┘ └─────┘                         ║
║                                                   ║
║    ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      ║
║    │K    │ │7    │ │2    │ │     │ │     │      ║
║    │  ♥  │ │  ♠  │ │  ♦  │ │     │ │     │      ║
║    │    K│ │    7│ │    2│ │     │ │     │      ║
║    └─────┘ └─────┘ └─────┘ └─────┘ └─────┘      ║
║                 POT: $200                         ║
║                                                   ║
║           ┌─────┐ ┌─────┐                         ║
║           │A    │ │K    │                          ║
║           │  ♠  │ │  ♥  │                          ║
║           │    A│ │    K│                          ║
║           └─────┘ └─────┘                         ║
║                YOU                                ║
║             Chips: $1500                          ║
║                                                   ║
║  Your action:  [Fold]  Check  Call $40  Raise     ║
╚═══════════════════════════════════════════════════╝
```

## Install & Run

```bash
npm install
npm start
```

## Controls

| Screen     | Key        | Action                      |
|------------|------------|-----------------------------|
| Title      | ↑/↓        | Navigate config fields      |
| Title      | ←/→        | Adjust values / select      |
| Title      | Enter      | Confirm / advance           |
| Game       | ←/→        | Select action               |
| Game       | Enter      | Confirm action              |
| Bet Slider | ↑/↓        | Adjust amount (±1 BB)       |
| Bet Slider | 1/2/3/4    | Half/3-4/Full pot/All-in    |
| Bet Slider | Enter      | Confirm bet                 |
| Bet Slider | Esc        | Go back                     |
| Any        | Q          | Quit                        |

## Tech

- **TypeScript + ESM** with [Ink](https://github.com/vadimdemedes/ink) (React for terminals)
- **chalk** for colors, **figlet** for the title screen
- AI uses Chen formula pre-flop + post-flop hand strength with frequency-based strategy
- Full 7-to-best-5 hand evaluation (all 21 combinations)
- Heads-up rules: dealer = small blind, acts first preflop

## Requirements

- Node.js 18+
- Terminal with at least 60 columns
