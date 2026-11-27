export const LEVELS = [
  {
    name: 'First Steps',
    width: 5,
    height: 5,
    moveLimit: 3,
    player: { type: 'knight', x: 0, y: 4 },
    enemies: [
      { type: 'king', x: 4, y: 0 },
      { type: 'pawn', x: 3, y: 0 },
    ],
    tray: ['rook'],
  },
];
