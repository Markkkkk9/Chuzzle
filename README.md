# Chuzzle

A chess-based puzzle game. You control one piece with a limited number of moves. Drag friendly helper pieces onto the board, plan your route, press Run, and capture the enemy king in time.

Landing on a helper piece transforms you into it.

Built with plain HTML, JavaScript and Canvas. Pixel art style.

Play: https://markkkkk9.github.io/Chuzzle/

## How to play

- Drag a helper from the tray onto the board, then click cells to plan your route (within the move limit). Press **Run** to play it.
- Landing on a helper turns you into that piece. Landing on an enemy captures it. Capture the enemy king to win.
- If you land on a cell an enemy attacks, that enemy captures you and the run fails (capturing the king wins first). Red dots and red squares show danger.
- **R**: stop the run, then press again to clear the route, then again to reset the board.
- **Q** / **E**: undo / redo your last edit while planning.

## Development

- Run locally: `npm run serve`, then open http://localhost:8000
- Run the rules tests and level solver: `npm test` (needs Node)
