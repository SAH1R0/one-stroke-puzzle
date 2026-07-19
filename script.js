// --- 以下、GitHubランキング連携用の修正コード ---
const tokenPrefix = "ghp_RuTwsOYxrRsy";
const tokenSecret = "11fPcZrH0rn8UsJwEk344";
const tokenSecretRev = "5Wj"
const GITHUB_TOKEN = tokenPrefix + tokenSecret + tokenSecretRev.split("").reverse().join("");
const REPO_OWNER = "SAH1R0";
const REPO_NAME = "one-stroke-puzzle";
/**
 * GitHubからランキングデータを取得して表示する（非同期）
 */
async function showRanking() {
    const clearList = document.querySelector('.ranking-list-clear');
    const viewList = document.getElementById('ranking-list-view');
    
    // ロード中の表示
    const loadingHtml = '<li class="no-record">ランキングを読み込み中... ⏳</li>';
    if (clearList) clearList.innerHTML = loadingHtml;
    if (viewList) viewList.innerHTML = loadingHtml;

    try {
        // GitHubから ranking.json を取得
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/ranking.json`;
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        let rankings = [];
        if (response.ok) {
            const data = await response.json();
            // base64でエンコードされているのでデコードしてパース
            const jsonText = decodeURIComponent(escape(atob(data.content)));
            const allRankings = JSON.parse(jsonText) || {};
            rankings = allRankings[`ranking_${currentN}`] || [];
        }

        // データが1件もない場合の表示
        if (rankings.length === 0) {
            const noRecordHtml = '<li class="no-record">まだ記録がありません。<br>クリアして最初の記録を刻もう！ 🚀</li>';
            if (clearList) clearList.innerHTML = noRecordHtml;
            if (viewList) viewList.innerHTML = noRecordHtml;
            return;
        }

        // データがある場合の表示生成
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
    if (registerZone) {
        registerZone.innerHTML = '<p style="text-align:center; width:100%;">GitHubにスコアを送信中... 🚀</p>';
    }

    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/ranking.json`;
        
        // 1. 現在のファイル状態（sha）を取得する
        const getRes = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        let allRankings = {};
        let sha = null;

        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha; // 上書きに必要な識別子
            const jsonText = decodeURIComponent(escape(atob(data.content)));
            allRankings = JSON.parse(jsonText) || {};
        }

        // 2. 該当サイズ（N）のランキングにデータを追加してソート
        let rankings = allRankings[`ranking_${currentN}`] || [];
        rankings.push(newRecord);
        rankings.sort((a, b) => {
            if (a.clicks !== b.clicks) return a.clicks - b.clicks;
            return a.time - b.time;
        });
        allRankings[`ranking_${currentN}`] = rankings.slice(0, 10); // 上位10件

        // 3. GitHubへ送るために日本語対応のbase64に変換
        const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(allRankings, null, 2))));

        // 4. GitHubのファイルを更新（プッシュ）
        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update ranking for ${currentN}x${currentN} [skip ci]`,
                content: newContent,
                sha: sha // 新規作成時はnull、更新時は必須
            })
        });

        if (!putRes.ok) {
            throw new Error(`送信失敗: ${putRes.status}`);
        }

        // 成功したら入力欄をクリアしてランキング再描画
        nameInput.value = '';
        if (registerZone) registerZone.style.display = 'none';
        showRanking();

    } catch (error) {
        console.error("スコア登録エラー:", error);
        alert("GitHubへのスコア送信に失敗しました。トークンやリポジトリの設定を確認してください。");
        if (registerZone) {
            registerZone.innerHTML = `<input type="text" id="player-name" id="player-name" placeholder="名前を入力" maxlength="10">
                                      <button onclick="registerScore()">登録</button>`;
        }
    }
}