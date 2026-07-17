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
    clickCount: 0,      // タイルをクリックした回数

    solvedPath: [],     // 正解ルートの座標リスト

    // 【新機能】同じ盤面でリセットするための初期配置保存用
    initialGrid: [],
    initialEmptyTilePos: {r: 0, c: 0}
};

/**
 * サイズ変更時のトリガー
 */
function changeSize(newSize) {
    currentN = parseInt(newSize, 10);
    initGame();
}

/**
 * 新規ゲームの初期化（新しい壁・新しいルートを生成）
 */
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

    const modal = document.getElementById('clear-modal');
    if (modal) modal.style.display = 'none';

    setupBoardDimensions();

    // 盤面生成
    generateLevelFast();
    shuffleBoard();

    // 【新機能】シャッフル完了直後の初期状態をディープコピーして記憶
    saveInitialState();

    renderBoard();
    clearCanvas();
}

/**
 * 【新機能】同じ盤面で最初からリセット
 */
function resetCurrentGame() {
    if (gameState.initialGrid.length === 0) return;

    gameState.isCleared = false;
    gameState.clickCount = 0;
    gameState.startTime = Date.now(); // タイマーも再スタート

    const msgElement = document.getElementById('message');
    if (msgElement) {
        msgElement.textContent = `1から${totalTiles}を通路で繋げよう！`;
        msgElement.style.color = "#333";
    }

    const modal = document.getElementById('clear-modal');
    if (modal) modal.style.display = 'none';

    // 記憶しておいた初期状態を復元
    gameState.grid = JSON.parse(JSON.stringify(gameState.initialGrid));
    gameState.emptyTilePos = { ...gameState.initialEmptyTilePos };

    renderBoard();
    clearCanvas();
}

/**
 * 現在のシャッフル直後の状態を「初期状態」として保存
 */
function saveInitialState() {
    gameState.initialGrid = JSON.parse(JSON.stringify(gameState.grid));
    gameState.initialEmptyTilePos = { ...gameState.emptyTilePos };
}

/**
 * 盤面のピクセルサイズやグリッド定義を計算
 */
function setupBoardDimensions() {
    const boardElement = document.getElementById('puzzle-board');
    const container = document.getElementById('game-container');
    if (!boardElement || !container) return;

    // 6x6でも画面に収まりやすいよう、サイズに合わせて1マスの大きさを調整
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

/**
 * 絶対固まらない超軽量生成アルゴリズム
 */
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

/**
 * 指定された長さのランダム一筆書きパスを生成する高速DFS
 */
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

/**
 * ゴール状態からスライドを繰り返してシャッフル
 */
function shuffleBoard() {
    const shuffleSteps = currentN * 50; // 6x6用にも少し多めに設定
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

/**
 * 1から順に最後まで正しく一筆書きができているかチェック
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
        
        drawPath(perfectPath);

        const msgElement = document.getElementById('message');
        if (msgElement) {
            msgElement.textContent = "🎉 クリア！一筆書き開通です！";
            msgElement.style.color = "#2ecc71";
        }
        
        renderBoard();

        const endTime = Date.now();
        const clearTimeSeconds = Math.floor((endTime - gameState.startTime) / 1000);

        document.getElementById('clear-time').textContent = clearTimeSeconds;
        document.getElementById('click-count').textContent = gameState.clickCount;

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

function closeModal() {
    const modal = document.getElementById('clear-modal');
    if (modal) modal.style.display = 'none';
}

function closeModalAndReset() {
    closeModal();
    initGame();
}

window.onload = initGame;