const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;

const DB_PATH = path.join(__dirname, '../database');
const PLAYERS_FILE = path.join(DB_PATH, 'players.json');
const MAP_FILE = path.join(DB_PATH, 'map.json');
const MONSTERS_FILE = path.join(DB_PATH, 'monsters.json');
const ITEMS_FILE = path.join(DB_PATH, 'items.json');
const RECIPES_FILE = path.join(DB_PATH, 'recipes.json');

// Helper function to read players data
const readPlayersData = () => {
    try {
        const data = fs.readFileSync(PLAYERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading players data:", error);
        return [];
    }
};

// Helper function to write players data
const writePlayersData = (data) => {
    try {
        fs.writeFileSync(PLAYERS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing players data:", error);
    }
};

// Helper function to read map data
const readMapData = () => {
    try {
        const data = fs.readFileSync(MAP_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading map data:", error);
        return null;
    }
};

// Helper function to read monsters data
const readMonstersData = () => {
    try {
        const data = fs.readFileSync(MONSTERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading monsters data:", error);
        return [];
    }
};

// Helper function to read items data
const readItemsData = () => {
    try {
        const data = fs.readFileSync(ITEMS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading items data:", error);
        return [];
    }
};

// Helper function to read recipes data
const readRecipesData = () => {
    try {
        const data = fs.readFileSync(RECIPES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading recipes data:", error);
        return [];
    }
};

let activeCombat = null; // Simple in-memory combat session

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const players = readPlayersData();

    if (players.find(p => p.username === username)) {
        return res.status(400).json({ message: "Username already exists." });
    }

    const newPlayer = {
        id: players.length + 1,
        username,
        password, // In a real app, you MUST hash passwords!
        character: null // Character will be created in the next step
    };

    players.push(newPlayer);
    writePlayersData(players);

    res.status(201).json({ message: "User registered successfully!" });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const players = readPlayersData();

    const player = players.find(p => p.username === username && p.password === password);

    if (player) {
        // We'll use a simple session placeholder. In a real app, use express-session or JWT.
        req.session = { userId: player.id };

        if (player.character) {
            res.status(200).json({ message: "Login successful!", redirectTo: '/game' });
        } else {
            res.status(200).json({ message: "Login successful! Please create a character.", redirectTo: '/character-creation' });
        }
    } else {
        res.status(401).json({ message: "Invalid username or password." });
    }
});

app.post('/api/character', (req, res) => {
    // This is a placeholder for session management.
    // const userId = req.session.userId;
    // For now, let's just find the first user without a character.
    // THIS IS NOT SAFE and for demonstration only.
    const players = readPlayersData();
    const player = players.find(p => !p.character);
    if (!player) return res.status(404).json({ message: "Player not found or character already exists." });

    const { name, job } = req.body;
    let stats = { hp: 100, mp: 50, attack: 10, defense: 5, magic: 5, spirit: 5, luck: 5, vitality: 5 };

    switch (job) {
        case "Knight": stats.attack += 2; stats.defense += 1; break;
        case "Mage": stats.magic += 3; break;
        case "Tanker": stats.defense += 3; break;
        case "Healer": stats.magic += 1; stats.spirit += 2; break;
        case "Farmer": stats.luck += 1; stats.vitality += 1; break;
    }

    player.character = {
        name,
        job,
        level: 1,
        xp: 0,
        stats,
        position: { x: 10, y: 10 }, // Starting position in the town
        inventory: [],
        equipment: { weapon: null, shield: null, helmet: null, armor: null, accessory: null }
    };

    writePlayersData(players);
    res.status(201).json({ message: "Character created successfully!", redirectTo: '/game' });
});

app.get('/api/player/data', (req, res) => {
    // Placeholder for getting the logged-in player's data
    const players = readPlayersData();
    // In a real app, you would use req.session.userId to find the correct player
    const player = players.find(p => p.character); // Find first player with a character
    if (player) {
        res.status(200).json(player.character);
    } else {
        res.status(404).json({ message: "Player data not found." });
    }
});

app.post('/api/player/move', (req, res) => {
    const { x, y } = req.body;

    // Placeholder for session management
    const players = readPlayersData();
    const player = players.find(p => p.character);
    if (!player) return res.status(404).json({ message: "Player not found." });

    const currentPos = player.character.position;
    const distance = Math.abs(currentPos.x - x) + Math.abs(currentPos.y - y);

    if (distance !== 1) {
        return res.status(400).json({ message: "Invalid move." });
    }

    player.character.position = { x, y };
    writePlayersData(players);

    // Check for monster encounter
    const mapData = readMapData();
    const spawnArea = mapData.spawnAreas.find(area => area.coordinates.some(coord => coord.x === x && coord.y === y));

    let combat = null;
    if (spawnArea && Math.random() < 0.5) { // 50% encounter chance
        const monsters = readMonstersData();
        const possibleMonsterIds = spawnArea.monsterIds;
        const monsterId = possibleMonsterIds[Math.floor(Math.random() * possibleMonsterIds.length)];
        const monsterTemplate = monsters.find(m => m.id === monsterId);

        // Create a copy for combat
        const monster = { ...monsterTemplate, currentHp: monsterTemplate.hp };

        activeCombat = {
            player: player.character,
            monster: monster
        };
        combat = activeCombat;
    }

    res.status(200).json({
        message: "Move successful.",
        position: player.character.position,
        combat
    });
});

app.post('/api/combat/action', (req, res) => {
    const { action } = req.body;

    if (!activeCombat) {
        return res.status(400).json({ message: "No active combat." });
    }

    const { player, monster } = activeCombat;
    const log = [];

    if (action === 'attack') {
        // Player's turn
        let playerDamage = Math.max(1, player.stats.attack - monster.defense);
        // Critical hit chance
        if (Math.random() < 0.1) { // 10% crit chance
            playerDamage *= 2;
            log.push(`Critical hit! You attack ${monster.name} for ${playerDamage} damage.`);
        } else {
            log.push(`You attack ${monster.name} for ${playerDamage} damage.`);
        }
        monster.currentHp -= playerDamage;

        // Monster's turn (if still alive)
        if (monster.currentHp > 0) {
            let monsterDamage = Math.max(1, monster.attack - player.stats.defense);
            player.stats.hp -= monsterDamage;
            log.push(`${monster.name} attacks you for ${monsterDamage} damage.`);
        } else {
            log.push(`\n${monster.name} is defeated!`);

            // Handle victory: XP
            const xpGained = monster.level * 10; // Simple XP formula
            player.xp += xpGained;
            log.push(`You gained ${xpGained} XP.`);

            // Handle victory: Item Drops
            const items = readItemsData();
            monster.drops.forEach(drop => {
                if (Math.random() < drop.chance) {
                    const item = items.find(i => i.id === drop.itemId);
                    if (item) {
                        player.inventory.push(item);
                        log.push(`You obtained: ${item.name}!`);
                    }
                }
            });

            // Persist player changes
            const players = readPlayersData();
            const playerIndex = players.findIndex(p => p.id === player.id);
            if (playerIndex !== -1) {
                players[playerIndex].character = player;
                writePlayersData(players);
            }

            activeCombat = null; // End combat
        }
    }

    res.status(200).json({ combat: activeCombat, log, updatedPlayer: player });
});

app.get('/api/recipes', (req, res) => {
    const recipes = readRecipesData();
    res.status(200).json(recipes);
});

app.post('/api/craft', (req, res) => {
    const { recipeId } = req.body;

    const players = readPlayersData();
    const player = players.find(p => p.character); // Placeholder for logged-in player
    if (!player) return res.status(404).json({ message: "Player not found." });

    const recipes = readRecipesData();
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return res.status(404).json({ message: "Recipe not found." });

    // TODO: Add check for player location (must be in a workshop)

    // Check if player has enough ingredients
    const hasIngredients = recipe.ingredients.every(ingredient => {
        const count = player.character.inventory.filter(item => item.id === ingredient.itemId).length;
        return count >= ingredient.quantity;
    });

    if (!hasIngredients) {
        return res.status(400).json({ message: "Not enough ingredients." });
    }

    // Remove ingredients from inventory
    recipe.ingredients.forEach(ingredient => {
        for (let i = 0; i < ingredient.quantity; i++) {
            const indexToRemove = player.character.inventory.findIndex(item => item.id === ingredient.itemId);
            player.character.inventory.splice(indexToRemove, 1);
        }
    });

    // Add result item to inventory
    const items = readItemsData();
    const resultItem = items.find(item => item.id === recipe.result.itemId);
    if (resultItem) {
        for (let i = 0; i < recipe.result.quantity; i++) {
            player.character.inventory.push(resultItem);
        }
    }

    writePlayersData(players);

    res.status(200).json({ message: `Successfully crafted ${resultItem.name}!`, player: player.character });
});


app.get('/api/map', (req, res) => {
    const mapData = readMapData();
    if (mapData) {
        res.status(200).json(mapData);
    } else {
        res.status(500).json({ message: "Could not read map data." });
    }
});


// Page Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/character-creation', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/character_creation.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/game.html'));
});

// Start the server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        // For now, just echo back
        ws.send(`Echo: ${message}`);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.send('Welcome to Wisperwind Saga!');
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
