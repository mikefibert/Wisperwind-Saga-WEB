document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginContainer.style.display = 'none';
            registerContainer.style.display = 'block';
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginContainer.style.display = 'block';
            registerContainer.style.display = 'none';
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            alert(result.message);

            if (response.ok && result.redirectTo) {
                window.location.href = result.redirectTo;
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;

            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            alert(result.message);

            if (response.ok) {
                // Switch to login form after successful registration
                loginContainer.style.display = 'block';
                registerContainer.style.display = 'none';
            }
        });
    }

    const characterForm = document.getElementById('character-form');
    if (characterForm) {
        characterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('char-name').value;
            const job = document.getElementById('job-select').value;

            const response = await fetch('/api/character', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, job })
            });

            const result = await response.json();
            alert(result.message);

            if (response.ok && result.redirectTo) {
                window.location.href = result.redirectTo;
            }
        });
    }

    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
        let currentPlayer = null;

        const renderMap = (mapData) => {
            mapContainer.innerHTML = '';
            mapContainer.style.gridTemplateColumns = `repeat(${mapData.width}, 30px)`;

            const tilesData = {};
            mapData.tiles.forEach(t => tilesData[`${t.x}-${t.y}`] = t);
            mapData.spawnAreas.forEach(area => {
                area.coordinates.forEach(coord => {
                    tilesData[`${coord.x}-${coord.y}`] = { ...coord, type: area.area };
                });
            });

            for (let y = 0; y < mapData.height; y++) {
                for (let x = 0; x < mapData.width; x++) {
                    const tileDiv = document.createElement('div');
                    tileDiv.classList.add('map-tile');

                    const tileData = tilesData[`${x}-${y}`];
                    const tileType = tileData ? tileData.type : 'Empty';

                    tileDiv.dataset.x = x;
                    tileDiv.dataset.y = y;
                    tileDiv.dataset.type = tileType;
                    tileDiv.classList.add(`tile-${tileType.toLowerCase()}`);

                    // Add a simple representation
                    if (tileType === 'Town') tileDiv.textContent = 'T';
                    else if (tileType === 'Forest') tileDiv.textContent = 'F';
                    else if (tileType === 'Beach') tileDiv.textContent = 'B';

                    // Mark player position
                    if (currentPlayer && currentPlayer.position.x == x && currentPlayer.position.y == y) {
                        tileDiv.classList.add('player-position');
                        tileDiv.textContent = '@';
                    }

                    tileDiv.addEventListener('click', async () => {
                        if (tileType === 'Workshop') {
                            openCraftingMenu();
                        } else {
                            await handleMove(x, y);
                        }
                    });

                    mapContainer.appendChild(tileDiv);
                }
            }
        };

        const handleMove = async (x, y) => {
            const response = await fetch('/api/player/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y })
            });
            const result = await response.json();
            if (response.ok) {
                currentPlayer.position = result.position;
                if (result.combat) {
                    startCombat(result.combat);
                } else {
                    await initializeGame(); // Re-render map
                }
            } else {
                alert(result.message);
            }
        };

        const startCombat = (combatData) => {
            const gameContainer = document.getElementById('game-container');
            const combatContainer = document.getElementById('combat-container');

            gameContainer.style.display = 'none';
            combatContainer.style.display = 'flex';

            // Populate combat UI
            updateCombatUI(combatData);

            // Add listener for attack button
            document.getElementById('attack-btn').onclick = async () => {
                const response = await fetch('/api/combat/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'attack' })
                });
                const result = await response.json();

                result.log.forEach(msg => addToCombatLog(msg));

                if (result.combat) {
                    updateCombatUI(result.combat);
                } else {
                    // Combat ended
                    currentPlayer = result.updatedPlayer;
                    updatePlayerProfile();
                    endCombat();
                }
            };
        };

        const updateCombatUI = (combatData) => {
            document.getElementById('monster-name').textContent = combatData.monster.name;
            document.getElementById('monster-hp').textContent = combatData.monster.currentHp > 0 ? combatData.monster.currentHp : 0;
            document.getElementById('player-name').textContent = combatData.player.name;
            document.getElementById('player-hp').textContent = combatData.player.stats.hp > 0 ? combatData.player.stats.hp : 0;
        };

        const addToCombatLog = (message) => {
            const logContainer = document.getElementById('combat-log');
            logContainer.innerHTML += `<p>${message}</p>`;
            logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll
        };

        const endCombat = () => {
            alert("Victory!");
            document.getElementById('combat-container').style.display = 'none';
            document.getElementById('game-container').style.display = 'block';
            document.getElementById('combat-log').innerHTML = ''; // Clear log
            initializeGame(); // Refresh map and player data
        };

        const initializeGame = async () => {
            const playerResponse = await fetch('/api/player/data');
            currentPlayer = await playerResponse.json();
            updatePlayerProfile();

            const mapResponse = await fetch('/api/map');
            const mapData = await mapResponse.json();

            renderMap(mapData);
        };

        const updatePlayerProfile = () => {
            const profileDiv = document.getElementById('character-profile');
            const backpackDiv = document.getElementById('backpack');

            if (!currentPlayer || !profileDiv || !backpackDiv) return;

            // Render Profile
            profileDiv.innerHTML = `
                <h3>${currentPlayer.name}</h3>
                <p>Level ${currentPlayer.level} ${currentPlayer.job}</p>
                <p>XP: ${currentPlayer.xp}</p>
                <p>HP: ${currentPlayer.stats.hp}</p>
                <p>MP: ${currentPlayer.stats.mp}</p>
                <p>Attack: ${currentPlayer.stats.attack}</p>
                <p>Defense: ${currentPlayer.stats.defense}</p>
            `;

            // Render Backpack/Inventory
            backpackDiv.innerHTML = '<h4>Backpack</h4>';
            if (currentPlayer.inventory.length === 0) {
                backpackDiv.innerHTML += '<p>Empty</p>';
            } else {
                const itemList = document.createElement('ul');
                currentPlayer.inventory.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item.name;
                    itemList.appendChild(li);
                });
                backpackDiv.appendChild(itemList);
            }
        };

        const openCraftingMenu = async () => {
            const craftingContainer = document.getElementById('crafting-container');
            const recipeList = document.getElementById('recipe-list');
            const closeBtn = craftingContainer.querySelector('.close-btn');

            const response = await fetch('/api/recipes');
            const recipes = await response.json();

            recipeList.innerHTML = '';
            recipes.forEach(recipe => {
                const recipeDiv = document.createElement('div');
                recipeDiv.innerHTML = `
                    <h4>${recipe.name}</h4>
                    <p>Requires: ${recipe.ingredients.map(ing => `${ing.quantity}x ItemID ${ing.itemId}`).join(', ')}</p>
                    <button data-recipe-id="${recipe.id}">Craft</button>
                `;
                recipeList.appendChild(recipeDiv);
            });

            craftingContainer.style.display = 'block';

            closeBtn.onclick = () => craftingContainer.style.display = 'none';
            window.onclick = (event) => {
                if (event.target == craftingContainer) {
                    craftingContainer.style.display = 'none';
                }
            };

            recipeList.addEventListener('click', async (e) => {
                if (e.target.tagName === 'BUTTON') {
                    const recipeId = e.target.dataset.recipeId;
                    const craftResponse = await fetch('/api/craft', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipeId: parseInt(recipeId) })
                    });
                    const result = await craftResponse.json();
                    alert(result.message);
                    if (craftResponse.ok) {
                        currentPlayer = result.player;
                        updatePlayerProfile();
                    }
                }
            });
        };

        const initializeWebSocket = () => {
            const ws = new WebSocket(`ws://${window.location.host}`);

            ws.onopen = () => {
                console.log('Connected to WebSocket server');
                ws.send('Hello Server!');
            };

            ws.onmessage = (event) => {
                console.log(`Received from server: ${event.data}`);
                // Future logic for handling game state updates will go here
            };

            ws.onclose = () => {
                console.log('Disconnected from WebSocket server');
            };
        };

        initializeGame();
        initializeWebSocket();
    }
});
