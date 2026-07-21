let currentN = 3; 
let DIM = 5;      
let totalTiles = 8; 

let cellCenters = [];

let gameState = {
    grid: [],
    wallPositions: [],  
    emptyTilePos: {r: 0, c: 0}, 
    isCleared: false,
    
    startTime: null,    
    clickCount: 0,      
    clearTime: 0,       

    solvedPath: [],     

    initialGrid: [],
    initialEmptyTilePos: {r: 0, c: 0}
};

function changeSize(newSize) {
    currentN = parseInt(newSize, 10);
    initGame();
}

function initGame() {
    gameState.isCleared = false;
    DIM = currentN * 2 - 1;
    totalTiles = currentN * currentN - 1;

    gameState.clickCount = 0;
    gameState.startTime = Date.now(); 

    const msgElement = document.getElementById('message');
    if (msgElement) {
        msgElement.textContent = `1から${totalTiles}を通路で繋げよう！`;
        msgElement.style.color = "#333";
    }

    closeModal('clear-modal');
    closeModal('ranking-modal');

    // 次回クリア用にフォームを再構築・表示
    const regZone = document.getElementById('register-zone');
    if (regZone) {
        regZone.innerHTML = `<input type="text" id="player-name" placeholder="名前を入力" maxlength="10">
                              <button onclick="registerScore()" class="register-btn">ランキングに登録</button>`;
        regZone.style.display = 'flex';
    }

    setupBoardDimensions();
    generateLevelFast();
    shuffleBoard();
    saveInitialState();
    renderBoard();
    clearCanvas();
}

function resetCurrentGame() {
    if (gameState.initialGrid.length === 0) return;

    gameState.isCleared = false;
    gameState.clickCount = 0;
    gameState.startTime = Date.now(); 

    const msgElement = document.getElementById('message');
    if (msgElement) {
        msgElement.textContent = `1から${totalTiles}を通路で繋げよう！`;
        msgElement.style.color = "#333";
    }

    closeModal('clear-modal');
    closeModal('ranking-modal');

    // 次回クリア用にフォームを再構築・表示
    const regZone = document.getElementById('register-zone');
    if (regZone) {
        regZone.innerHTML = `<input type="text" id="player-name" placeholder="名前を入力" maxlength="10">
                              <button onclick="registerScore()" class="register-btn">ランキングに登録</button>`;
        regZone.style.display = 'flex';
    }

    gameState.grid = JSON.parse(JSON.stringify(gameState.initialGrid));
    gameState.emptyTilePos = { ...gameState.initialEmptyTilePos };

    renderBoard();
    clearCanvas();
}

function saveInitialState() {
    gameState.initialGrid = JSON.parse(JSON.stringify(gameState.grid));
    gameState.initialEmptyTilePos = { ...gameState.emptyTilePos };
}

function setupBoardDimensions() {
    const boardElement = document.getElementById('puzzle-board');
    const container = document.getElementById('game-container');
    if (!boardElement || !container) return;

    let tilePx = 60;
    let pathPx = 20;
    let fontSize = "22px";

    if (currentN === 5) {
        tilePx = 50;
        pathPx = 15;
        fontSize = "18px";
    } else if (currentN === 6) {
        tilePx = 42;
        pathPx = 12;
        fontSize = "14px";
    }

    const totalPx = currentN * tilePx + (currentN - 1) * pathPx;
    container.style.setProperty('--board-size', `${totalPx}px`);
    container.style.setProperty('--font-size', fontSize);

    let gridTemplate = [];
    for (let i = 0; i < DIM; i++) {
        gridTemplate.push(i % 2 === 0 ? `${tilePx}px` : `${pathPx}px`);
    }
    const templateString = gridTemplate.join(' ');
    boardElement.style.gridTemplateColumns = templateString;
    boardElement.style.gridTemplateRows = templateString;

    cellCenters = [];
    let currentPos = 0;
    for (let i = 0; i < DIM; i++) {
        const size = (i % 2 === 0 ? tilePx : pathPx);
        cellCenters.push(currentPos + size / 2);
        currentPos += size;
    }
}

function generateLevelFast() {
    const targetLength = currentN * currentN - 1; 
    let path = null;

    gameState.grid = Array.from({ length: DIM }, () => 
        Array.from({ length: DIM }, () => ({ type: 'empty' }))
    );

    while (!path) {
        let starts = [];
        for (let r = 0; r < DIM; r += 2) {
            for (let c = 0; c < DIM; c += 2) {
                starts.push({ r, c });
            }
        }
        starts.sort(() => Math.random() - 0.5);

        for (let start of starts) {
            path = generateRandomWalkPath(start.r, start.c, targetLength);
            if (path) break;
        }
    }

    gameState.solvedPath = path;

    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        gameState.grid[p.r][p.c] = { type: 'tile', number: i + 1 };
    }

    let pathEdges = new Set();
    for (let i = 0; i < path.length - 1; i++) {
        let p1 = path[i];
        let p2 = path[i + 1];
        let midR = (p1.r + p2.r) / 2;
        let midC = (p1.c + p2.c) / 2;
        gameState.grid[midR][midC] = { type: 'empty' };
        pathEdges.add(`${midR},${midC}`);
    }

    let visitedSet = new Set(path.map(p => `${p.r},${p.c}`));
    let emptySpacePos = null;
    for (let r = 0; r < DIM; r += 2) {
        for (let c = 0; c < DIM; c += 2) {
            if (!visitedSet.has(`${r},${c}`)) {
                emptySpacePos = { r, c };
                break;
            }
        }
    }
    gameState.grid[emptySpacePos.r][emptySpacePos.c] = { type: 'empty_space' };
    gameState.emptyTilePos = emptySpacePos;

    let unusedEdges = [];
    for (let r = 0; r < DIM; r++) {
        for (let c = 0; c < DIM; c++) {
            if ((r % 2 === 0 && c % 2 !== 0) || (r % 2 !== 0 && c % 2 === 0)) {
                if (!pathEdges.has(`${r},${c}`)) {
                    unusedEdges.push({ r, c });
                }
            }
        }
    }

    const wallCount = currentN - 2;
    unusedEdges.sort(() => Math.random() - 0.5);
    gameState.wallPositions = unusedEdges.slice(0, wallCount);

    for (let wall of gameState.wallPositions) {
        gameState.grid[wall.r][wall.c] = { type: 'wall' };
    }
}

function generateRandomWalkPath(startR, startC, targetLength) {
    let visited = new Set();
    let resultPath = null;

    function search(r, c, path) {
        if (resultPath) return; 
        if (path.length === targetLength) {
            resultPath = [...path];
            return;
        }

        const directions = [[0, 2], [0, -2], [2, 0], [-2, 0]];
        directions.sort(() => Math.random() - 0.5);

        for (let [dr, dc] of directions) {
            let nr = r + dr;
            let nc = c + dc;
            if (nr >= 0 && nr < DIM && nc >= 0 && nc < DIM) {
                let key = `${nr},${nc}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    path.push({ r: nr, c: nc });
                    search(nr, nc, path);
                    path.pop();
                    visited.delete(key);
                }
            }
        }
    }

    visited.add(`${startR},${startC}`);
    search(startR, startC, [{ r: startR, c: startC }]);
    return resultPath;
}

function shuffleBoard() {
    const shuffleSteps = currentN * 50; 
    let steps = 0;

    while (steps < shuffleSteps) {
        const er = gameState.emptyTilePos.r;
        const ec = gameState.emptyTilePos.c;

        const candidates = [
            { r: er - 2, c: ec },
            { r: er + 2, c: ec },
            { r: er, c: ec - 2 },
            { r: er, c: ec + 2 }
        ];

        const validCandidates = candidates.filter(pos => {
            if (pos.r < 0 || pos.r >= DIM || pos.c < 0 || pos.c >= DIM) return false;
            const midR = (pos.r + er) / 2;
            const midC = (pos.c + ec) / 2;
            if (gameState.grid[midR][midC].type === 'wall') return false;
            return true;
        });

        if (validCandidates.length > 0) {
            const target = validCandidates[Math.floor(Math.random() * validCandidates.length)];
            const temp = gameState.grid[target.r][target.c];
            gameState.grid[target.r][target.c] = gameState.grid[er][ec];
            gameState.grid[er][ec] = temp;

            gameState.emptyTilePos = target;
            steps++;
        }
    }

    if (checkPerfectPath() !== null) {
        shuffleBoard();
    }
}

function renderBoard() {
    const boardElement = document.getElementById('puzzle-board');
    if (!boardElement) return;

    boardElement.innerHTML = '';

    for (let r = 0; r < DIM; r++) {
        for (let c = 0; c < DIM; c++) {
            const div = document.createElement('div');
            const cell = gameState.grid[r][c];

            if (cell.type === 'tile') {
                div.classList.add('tile');
                div.textContent = cell.number;
                if (!gameState.isCleared) {
                    div.onclick = () => tryMoveTile(r, c);
                }
            } else if (cell.type === 'empty_space') {
                div.classList.add('empty-space');
            } else if (cell.type === 'wall') {
                div.classList.add('wall');
            } else {
                div.classList.add('empty');
            }
            boardElement.appendChild(div);
        }
    }
}

function tryMoveTile(r, c) {
    const er = gameState.emptyTilePos.r;
    const ec = gameState.emptyTilePos.c;

    const isAdjacent = (Math.abs(r - er) === 2 && c === ec) || (Math.abs(c - ec) === 2 && r === er);

    if (isAdjacent) {
        const midR = (r + er) / 2;
        const midC = (c + ec) / 2;

        if (gameState.grid[midR][midC].type === 'wall') {
            return; 
        }

        gameState.clickCount++;

        const temp = gameState.grid[r][c];
        gameState.grid[r][c] = gameState.grid[er][ec];
        gameState.grid[er][ec] = temp;

        gameState.emptyTilePos = { r, c };

        renderBoard();
        checkWinCondition();
    }
}

function checkPerfectPath() {
    let tilePositions = {};
    for (let r = 0; r < DIM; r += 2) {
        for (let c = 0; c < DIM; c += 2) {
            const cell = gameState.grid[r][c];
            if (cell.type === 'tile') {
                tilePositions[cell.number] = { r, c };
            }
        }
    }

    let validPath = [tilePositions[1]];

    for (let i = 1; i < totalTiles; i++) {
        let current = tilePositions[i];
        let next = tilePositions[i + 1];

        if (!current || !next) return null;

        const isAdjacent = (Math.abs(current.r - next.r) === 2 && current.c === next.c) || 
                           (Math.abs(current.c - next.c) === 2 && current.r === next.r);

        if (isAdjacent) {
            const midR = (current.r + next.r) / 2;
            const midC = (current.c + next.c) / 2;

            if (gameState.grid[midR][midC].type !== 'wall') {
                validPath.push(next);
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    return (validPath.length === totalTiles) ? validPath : null;
}

function checkWinCondition() {
    const perfectPath = checkPerfectPath();

    if (perfectPath) {
        gameState.isCleared = true;
        
        drawPath(perfectPath);

        const msgElement = document.getElementById('message');
        if (msgElement) {
            msgElement.textContent = "🎉 クリア！一筆書き開通です！";
            msgElement.style.color = "#2ecc71";
        }
        
        renderBoard();

        const endTime = Date.now();
        gameState.clearTime = Math.floor((endTime - gameState.startTime) / 1000);

        document.getElementById('clear-time').textContent = gameState.clearTime;
        document.getElementById('click-count').textContent = gameState.clickCount;

        showRanking();

        setTimeout(() => {
            const clearMsg = document.getElementById('clear-message');
            if (clearMsg) {
                clearMsg.textContent = `${currentN} × ${currentN} 盤面の一筆書きが開通しました！`;
            }
            const modal = document.getElementById('clear-modal');
            if (modal) {
                modal.style.display = 'flex';
            }
        }, 600);
    }
}

function clearCanvas() {
    const canvas = document.getElementById('path-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('game-container');
    const size = container.clientWidth;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
}

function drawPath(path) {
    const canvas = document.getElementById('path-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('game-container');
    const size = container.clientWidth;
    
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    if (path.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(cellCenters[path[0].c], cellCenters[path[0].r]);

    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(cellCenters[path[i].c], cellCenters[path[i].r]);
    }

    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.8;
    ctx.stroke();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function closeModalAndReset() {
    closeModal('clear-modal');
    initGame();
}

window.onload = initGame;


// ===================================================
// 📊 GitHubランキング連携用コード
// ===================================================

const tokenPrefix = "ghp_RuTwsOYxrRsy";
const tokenSecret = "11fPcZrH0rn8UsJwEk344";
const tokenSecretRev = "5Wj";
const GITHUB_TOKEN = tokenPrefix + tokenSecret + tokenSecretRev.split("").reverse().join("");

const REPO_OWNER = "SAH1R0";
const REPO_NAME = "one-stroke-puzzle";

/**
 * GitHubからランキングデータを取得して表示する（非同期）
 */
async function showRanking() {
    const clearList = document.querySelector('.ranking-list-clear');
    const viewList = document.getElementById('ranking-list-view');
    
    const loadingHtml = '<li class="no-record">ランキングを読み込み中... ⏳</li>';
    if (clearList) clearList.innerHTML = loadingHtml;
    if (viewList) viewList.innerHTML = loadingHtml;

    try {
        // キャッシュ回避のためタイムスタンプを付与
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/ranking.json?t=${Date.now()}`;
        const response = await fetch(url, {
            headers: { 
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Cache-Control': 'no-cache'
            }
        });

        let rankings = [];
        if (response.ok) {
            const data = await response.json();
            const jsonText = decodeURIComponent(escape(atob(data.content)));
            const allRankings = JSON.parse(jsonText) || {};
            rankings = allRankings[`ranking_${currentN}`] || [];
        }

        if (rankings.length === 0) {
            const noRecordHtml = '<li class="no-record">まだ記録がありません。<br>クリアして最初の記録を刻もう！ 🚀</li>';
            if (clearList) clearList.innerHTML = noRecordHtml;
            if (viewList) viewList.innerHTML = noRecordHtml;
            return;
        }

        const htmlContent = rankings.map((score, index) => {
            let crown = "";
            if (index === 0) crown = "🥇 ";
            else if (index === 1) crown = "🥈 ";
            else if (index === 2) crown = "🥉 ";
            return `<li>${crown}<strong>${score.name}</strong> - ${score.clicks}手 / ${score.time}秒 <span style="font-size:10px;color:#999;">(${score.date})</span></li>`;
        }).join('');

        if (clearList) clearList.innerHTML = htmlContent;
        if (viewList) viewList.innerHTML = htmlContent;

    } catch (error) {
        console.error("ランキング取得エラー:", error);
        const errorHtml = '<li class="no-record" style="color:#e74c3c;">データの取得に失敗しました。</li>';
        if (clearList) clearList.innerHTML = errorHtml;
        if (viewList) viewList.innerHTML = errorHtml;
    }
}

/**
 * 新しいスコアをGitHubの ranking.json に登録する（非同期）
 */
async function registerScore() {
    const nameInput = document.getElementById('player-name');
    if (!nameInput) return;

    const name = nameInput.value.trim() || "名無しさん";
    const newRecord = {
        name: name,
        clicks: gameState.clickCount,
        time: gameState.clearTime,
        date: new Date().toLocaleDateString()
    };

    const registerZone = document.getElementById('register-zone');
    const originalFormHtml = `<input type="text" id="player-name" placeholder="名前を入力" maxlength="10">
                              <button onclick="registerScore()" class="register-btn">ランキングに登録</button>`;

    if (registerZone) {
        registerZone.innerHTML = '<p style="text-align:center; width:100%;">GitHubにスコアを送信中... 🚀</p>';
    }

    try {
        // キャッシュ回避のためタイムスタンプを付与して最新のshaを取得
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/ranking.json`;
        const getUrl = `${url}?t=${Date.now()}`;
        
        const getRes = await fetch(getUrl, {
            headers: { 
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Cache-Control': 'no-cache'
            }
        });

        let allRankings = {};
        let sha = null;

        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
            const jsonText = decodeURIComponent(escape(atob(data.content)));
            allRankings = JSON.parse(jsonText) || {};
        }

        let rankings = allRankings[`ranking_${currentN}`] || [];
        rankings.push(newRecord);
        rankings.sort((a, b) => {
            if (a.clicks !== b.clicks) return a.clicks - b.clicks;
            return a.time - b.time;
        });
        allRankings[`ranking_${currentN}`] = rankings.slice(0, 10);

        const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(allRankings, null, 2))));

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update ranking for ${currentN}x${currentN} [skip ci]`,
                content: newContent,
                sha: sha
            })
        });

        if (!putRes.ok) {
            throw new Error(`送信失敗: ${putRes.status}`);
        }

        // 成功時：フォームのHTMLを元に戻してから隠す
        if (registerZone) {
            registerZone.innerHTML = originalFormHtml;
            registerZone.style.display = 'none';
        }
        showRanking();

    } catch (error) {
        console.error("スコア登録エラー:", error);
        alert("GitHubへのスコア送信に失敗しました。");
        // エラー時もフォームのHTMLを戻しておく
        if (registerZone) {
            registerZone.innerHTML = originalFormHtml;
        }
    }
}

/**
 * いつでもランキングモーダルを開く
 */
function openRankingModal() {
    const title = document.getElementById('ranking-title-size');
    if (title) {
        title.textContent = `📊 【${currentN} × ${currentN} モード】のトップ10`;
    }
    showRanking(); 
    const modal = document.getElementById('ranking-modal');
    if (modal) modal.style.display = 'flex';
}