const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Load levels
const levels = JSON.parse(fs.readFileSync(path.join(__dirname, 'mortal-coil-levels.json'), 'utf8'));

// Game state
let gameState = {
    levelId: 0,
    board: [],
    width: 0,
    height: 0,
    playerX: -1,
    playerY: -1,
    started: false,
    finished: false,
    won: false,
    visitedCount: 0,
    totalCells: 0
};

// Parse board string to 2D array
function parseBoard(boardStr, width, height) {
    const board = [];
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            const char = boardStr[y * width + x];
            row.push({
                blocked: char === 'X',
                visited: char === 'X' // Blocked cells count as visited
            });
        }
        board.push(row);
    }
    return board;
}

// Count total playable cells
function countPlayableCells(board) {
    let count = 0;
    for (const row of board) {
        for (const cell of row) {
            if (!cell.blocked) count++;
        }
    }
    return count;
}

// Load a specific level
function loadLevel(levelId) {
    const level = levels[levelId];
    if (!level) {
        return false;
    }
    
    gameState.levelId = levelId;
    gameState.width = level.width;
    gameState.height = level.height;
    gameState.board = parseBoard(level.boardStr, level.width, level.height);
    gameState.playerX = -1;
    gameState.playerY = -1;
    gameState.started = false;
    gameState.finished = false;
    gameState.won = false;
    gameState.visitedCount = 0;
    gameState.totalCells = countPlayableCells(gameState.board);
    
    return true;
}

// Broadcast game state to all connected clients
function broadcastState() {
    const state = JSON.stringify({
        type: 'state',
        ...gameState
    });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(state);
        }
    });
}

// Check if a move is valid
function isValidMove(direction) {
    if (!gameState.started || gameState.finished) return false;
    
    const dx = { up: 0, down: 0, left: -1, right: 1 }[direction];
    const dy = { up: -1, down: 1, left: 0, right: 0 }[direction];
    
    if (dx === undefined || dy === undefined) return false;
    
    const newX = gameState.playerX + dx;
    const newY = gameState.playerY + dy;
    
    // Check bounds
    if (newX < 0 || newX >= gameState.width || newY < 0 || newY >= gameState.height) {
        return false;
    }
    
    // Check if cell is not blocked and not visited
    const cell = gameState.board[newY][newX];
    return !cell.blocked && !cell.visited;
}

// Execute a move - slides until hitting a wall or visited cell
function executeMove(direction) {
    if (!gameState.started || gameState.finished) {
        return { success: false, message: 'Game not started or already finished' };
    }
    
    const dx = { up: 0, down: 0, left: -1, right: 1 }[direction];
    const dy = { up: -1, down: 1, left: 0, right: 0 }[direction];
    
    if (dx === undefined || dy === undefined) {
        return { success: false, message: 'Invalid direction. Use: up, down, left, right' };
    }
    
    let moved = false;
    
    // Slide until we can't move anymore
    while (true) {
        const newX = gameState.playerX + dx;
        const newY = gameState.playerY + dy;
        
        // Check bounds
        if (newX < 0 || newX >= gameState.width || newY < 0 || newY >= gameState.height) {
            break;
        }
        
        // Check if cell is not blocked and not visited
        const cell = gameState.board[newY][newX];
        if (cell.blocked || cell.visited) {
            break;
        }
        
        // Move to the new cell
        gameState.playerX = newX;
        gameState.playerY = newY;
        cell.visited = true;
        gameState.visitedCount++;
        moved = true;
    }
    
    if (!moved) {
        return { success: false, message: 'Cannot move in that direction' };
    }
    
    // Check win condition
    if (gameState.visitedCount === gameState.totalCells) {
        gameState.finished = true;
        gameState.won = true;
    }
    
    // Check if stuck (no more valid moves)
    const canMove = ['up', 'down', 'left', 'right'].some(dir => isValidMove(dir));
    if (!canMove && !gameState.won) {
        gameState.finished = true;
        gameState.won = false;
    }
    
    broadcastState();
    
    return {
        success: true,
        finished: gameState.finished,
        won: gameState.won,
        playerX: gameState.playerX,
        playerY: gameState.playerY,
        visitedCount: gameState.visitedCount,
        totalCells: gameState.totalCells
    };
}

// Start the game at a specific position
function startGame(x, y) {
    if (gameState.started) {
        return { success: false, message: 'Game already started' };
    }
    
    if (x < 0 || x >= gameState.width || y < 0 || y >= gameState.height) {
        return { success: false, message: 'Invalid start position' };
    }
    
    const cell = gameState.board[y][x];
    if (cell.blocked) {
        return { success: false, message: 'Cannot start on a blocked cell' };
    }
    
    gameState.playerX = x;
    gameState.playerY = y;
    gameState.started = true;
    cell.visited = true;
    gameState.visitedCount = 1;
    
    broadcastState();
    
    return { success: true, message: 'Game started' };
}

// API Routes

// Get current game state
app.get('/api/state', (req, res) => {
    res.json(gameState);
});

// Get list of all levels
app.get('/api/levels', (req, res) => {
    const levelList = Object.keys(levels).map(id => ({
        id: parseInt(id),
        width: levels[id].width,
        height: levels[id].height
    }));
    res.json(levelList);
});

// Load a specific level
app.post('/api/level/:id', (req, res) => {
    const levelId = parseInt(req.params.id);
    if (loadLevel(levelId)) {
        broadcastState();
        res.json({ success: true, message: `Level ${levelId} loaded` });
    } else {
        res.status(404).json({ success: false, message: 'Level not found' });
    }
});

// Start the game at a position
app.post('/api/start', (req, res) => {
    const { x, y } = req.body;
    if (x === undefined || y === undefined) {
        return res.status(400).json({ success: false, message: 'x and y coordinates required' });
    }
    res.json(startGame(parseInt(x), parseInt(y)));
});

// Make a move
app.post('/api/move', (req, res) => {
    const { direction } = req.body;
    if (!direction) {
        return res.status(400).json({ success: false, message: 'direction required (up, down, left, right)' });
    }
    res.json(executeMove(direction.toLowerCase()));
});

// Reset current level
app.post('/api/reset', (req, res) => {
    loadLevel(gameState.levelId);
    broadcastState();
    res.json({ success: true, message: 'Level reset' });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Send current state to new client
    ws.send(JSON.stringify({
        type: 'state',
        ...gameState
    }));
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Initialize with level 0
loadLevel(0);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Mortal Coil Arena Server running on http://localhost:${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}/mortal-coil-frontend.html`);
    console.log('\nAPI Endpoints:');
    console.log('  GET  /api/state        - Get current game state');
    console.log('  GET  /api/levels       - Get list of all levels');
    console.log('  POST /api/level/:id    - Load a specific level');
    console.log('  POST /api/start        - Start game at position {x, y}');
    console.log('  POST /api/move         - Make a move {direction: up|down|left|right}');
    console.log('  POST /api/reset        - Reset current level');
});
