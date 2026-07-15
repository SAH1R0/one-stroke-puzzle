let currentN = 3; // 選択中の盤面サイズ N
let DIM = 5;      // グリッド次元 (N * 2 - 1)
let totalTiles = 8; // タイル数 (N * N - 1)

// Canvas上の描画用中心座標を管理する配列
let cellCenters = [];

let gameState = {
    grid: [],
    wallPositions: [],  // 固定壁たちの座標リスト [{r, c}, ...]
    emptyTilePos: {r: 0, c: 0}, 
    isCleared: false,
    
    // スコア計測用の状態
    startTime: null,    // 開始時間
    clickCount: 0       // タイルをクリックした回数
};

/**
 * サイズ変更時のトリガー
 */
function changeSize(newSize) {
    currentN = parseInt(newSize, 10);
    initGame();
}

/**
 * ゲームの初期化
 */
function initGame() {
    gameState.isCleared = false;
    DIM = currentN * 2 - 1;
    totalTiles = currentN * currentN - 1;

    // クリック回数と時間の初期化
    gameState.clickCount = 0;
    gameState.startTime = Date.now(); // ゲーム開始時のタイムスタンプを保存

    // メッセージの更新
    const msgElement = document.getElementById('message');
    if (msgElement) {
        msgElement.textContent = `1から${totalTiles}を通路で繋げよう！`;
        msgElement.style.color = "#333";
    }

    const modal = document.getElementById('clear-modal');
    if (modal) modal.style.display = 'none';

    // 盤面サイズに応じてCSS変数やCSSグリッド定義を動的にセット
    setupBoardDimensions();

    // 盤面生成＆シャッフル
    generateLevel();
    shuffleBoard();
    renderBoard();
    clearCanvas();
}

/**
 * 盤面のピクセルサイズやグリッド定義を計算
 */
function setupBoardDimensions() {
    const boardElement = document.getElementById('puzzle-board');
    const container = document.getElementById('game-container');
    if (!boardElement || !container) return;

    const tilePx = 60;
    const pathPx = 20;

    const totalPx = currentN * tilePx + (currentN - 1) * pathPx;
    container.style.setProperty('--board-size', `${totalPx}px`);

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

/**
 * 理論上クリア可能な「壁の位置（N - 2 個）」をランダムに選んで盤面を作成
 */
function generateLevel() {
    const wallCount = currentN - 2; 
    let success = false;

    while (!success) {
        gameState.grid = Array.from({ length: DIM }, () => 
            Array.from({ length: DIM }, () => ({ type: 'empty' }))
        );

        let num = 1;
        for (let r = 0; r < DIM; r += 2) {
            for (let c = 0; c < DIM; c += 2) {
                if (r === (DIM - 1) && c === (DIM - 1)) {
                    gameState.grid[r][c] = { type: 'empty_space' };
                    gameState.emptyTilePos = { r, c };
                } else {
                    gameState.grid[r][c] = { type: 'tile', number: num++ };
                }
            }
        }

        let allWallCandidates = [];
        for (let r = 0; r < DIM; r++) {
            for (let c = 0; c < DIM; c++) {
                if ((r % 2 === 0 && c % 2 !== 0) || (r % 2 !== 0 && c % 2 === 0)) {
                    allWallCandidates.push({ r, c });
                }
            }
        }

        allWallCandidates.sort(() => Math.random() - 0.5);
        gameState.wallPositions = allWallCandidates.slice(0, wallCount);

        for (let wall of gameState.wallPositions) {
            gameState.grid[wall.r][wall.c] = { type: 'wall' };
        }

        if (hasAtLeastOneValidPathWithTheseWalls()) {
            success = true;
        }
    }
}

/**
 * 壁を検証するDFS
 */
function hasAtLeastOneValidPathWithTheseWalls() {
    let pathFound = false;

    function search(r, c, visitedCount) {
        if (pathFound) return;
        if (visitedCount === (currentN * currentN - 1)) {
            pathFound = true;
            return;
        }

        const directions = [[0, 2], [0, -2], [2, 0], [-2, 0]];
        for (let [dr, dc] of directions) {
            let nr = r + dr;
            let nc = c + dc;
            let midR = r + dr / 2;
            let midC = c + dc / 2;

            if (nr >= 0 && nr < DIM && nc >= 0 && nc < DIM) {
                let key = `${nr},${nc}`;
                if (!visited.has(key) && gameState.grid[midR][midC].type !== 'wall') {
                    visited.add(key);
                    search(nr, nc, visitedCount + 1);
                    visited.delete(key);
                }
            }
        }
    }

    let visited = new Set();
    for (let startR = 0; startR < DIM; startR += 2) {
        for (let startC = 0; startC < DIM; startC += 2) {
            let key = `${startR},${startC}`;
            visited.add(key);
            search(startR, startC, 1);
            visited.delete(key);
            if (pathFound) return true;
        }
    }

    return false;
}

/**
 * 完成された状態からスライドを繰り返してシャッフル
 */
function shuffleBoard() {
    const shuffleSteps = currentN * 35; 
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

        // 移動に成功したらクリックカウントを加算
        gameState.clickCount++;

        const temp = gameState.grid[r][c];
        gameState.grid[r][c] = gameState.grid[er][ec];
        gameState.grid[er][ec] = temp;

        gameState.emptyTilePos = { r, c };

        renderBoard();
        checkWinCondition();
    }
}

/**
 * 一筆書き判定
 */
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
        
        // 1. 赤い一筆書きの線を描画
        drawPath(perfectPath);

        const msgElement = document.getElementById('message');
        if (msgElement) {
            msgElement.textContent = "🎉 クリア！一筆書き開通です！";
            msgElement.style.color = "#2ecc71";
        }
        
        renderBoard();

        // 2. クリア時間（秒数）を計算
        const endTime = Date.now();
        const clearTimeSeconds = Math.floor((endTime - gameState.startTime) / 1000);

        // スコアをモーダルに代入
        document.getElementById('clear-time').textContent = clearTimeSeconds;
        document.getElementById('click-count').textContent = gameState.clickCount;

        // 3. モーダルを表示
        setTimeout(() => {
            const clearMsg = document.getElementById('clear-message');
            if (clearMsg) {
                clearMsg.textContent = `${currentN} × ${currentN} 盤面の一筆書きが開通しました！`;
            }
            const modal = document.getElementById('clear-modal');
            if (modal) {
                modal.style.display = 'flex';
            }
        }, 500);
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

/**
 * モーダルを閉じるだけ（クリア盤面をじっくり見る用）
 */
function closeModal() {
    const modal = document.getElementById('clear-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * モーダルを閉じて最初からリセット・再生成
 */
function closeModalAndReset() {
    closeModal();
    initGame();
}

window.onload = initGame;