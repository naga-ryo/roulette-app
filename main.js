(() => {
    const STORAGE_KEY = 'royal_roulette_balance';
    const STORAGE_KEY_HISTORY = 'royal_roulette_history';

    // 状態管理
    const state = {
        items: [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],
        colors: [],
        isSpinning: false,
        balance: parseInt(localStorage.getItem(STORAGE_KEY)),
        currentBetType: null,
        currentBetValue: null,
        currentBetAmount: 100,
        history: JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || []
    };

    if (isNaN(state.balance)) state.balance = 10000;

    const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    state.items.forEach(n => {
        if(n === 0) state.colors.push('#0e4c34');
        else if(reds.includes(n)) state.colors.push('#a61c1c');
        else state.colors.push('#111111');
    });

    const physics = {
        wheelAngle: 0, wheelVelocity: 0,
        ballAngle: 0, ballVelocity: 0, ballRadius: 265,
        radialVelocity: 0,
        isActive: false
    };

    const ui = {
        btnSpin: document.getElementById('btnSpin'),
        btnOpenEdit: document.getElementById('btnOpenEdit'),
        editModalOverlay: document.getElementById('editModalOverlay'),
        btnCloseEdit: document.getElementById('btnCloseEdit'),
        bettingBoard: document.getElementById('bettingBoard'),
        currentBetDisplay: document.getElementById('currentBetDisplay'),
        uiBalance: document.getElementById('uiBalance'),
        displayBetAmount: document.getElementById('displayBetAmount'),
        rCtx: document.getElementById('rouletteCanvas').getContext('2d'),
        overlay: document.getElementById('resultOverlay'),
        resultNum: document.getElementById('resultNum'),
        resultText: document.getElementById('resultText'),
        resultBox: document.getElementById('resultBox'),
        btnClose: document.getElementById('btnClose'),
        toast: document.getElementById('toastMessage'),
        btnResetCoin: document.getElementById('btnResetCoin'),
        historyList: document.getElementById('historyList')
    };

    const init = () => {
        updateBalance(0);
        validateBetAmount();
        buildBettingBoard(); 
        resetRoulette();
        renderHistory();
        bindEvents();
        gsap.ticker.add(physicsLoop);
    };

    const updateBalance = (amt) => {
        state.balance += amt;
        if (state.balance < 0) state.balance = 0;
        localStorage.setItem(STORAGE_KEY, state.balance);
        ui.uiBalance.textContent = state.balance;
    };

    const validateBetAmount = () => {
        if (state.balance === 0) {
            state.currentBetAmount = 0;
        } else if (state.currentBetAmount > state.balance) {
            state.currentBetAmount = state.balance;
        } else if (state.currentBetAmount < 1 && state.balance > 0) {
            state.currentBetAmount = 1;
        }
        ui.displayBetAmount.textContent = state.currentBetAmount;
    };

    const updateBetDisplay = () => {
        if(state.currentBetType && state.currentBetAmount > 0) {
            let displayVal = state.currentBetValue;
            if(state.currentBetType === 'color') displayVal = displayVal.toUpperCase();
            else if(state.currentBetType === 'highlow' && displayVal === 'low') displayVal = '1-18';
            else if(state.currentBetType === 'highlow' && displayVal === 'high') displayVal = '19-36';
            else if(state.currentBetType === 'dozen') displayVal = `${displayVal}st/nd/rd 12`;
            
            ui.currentBetDisplay.innerHTML = `<span style="font-size:0.8em; color:#aaa;">BET ON:</span> ${displayVal} <br><span style="color:var(--gold-primary); font-size:1.2em;">🪙 ${state.currentBetAmount}</span>`;
        } else if (state.balance === 0) {
            ui.currentBetDisplay.innerHTML = `<span style="color:var(--danger-accent);">破産しました<br>右上の ↻ からリセットしてください</span>`;
        } else {
            ui.currentBetDisplay.textContent = 'ベット先を選択してください';
        }
    };

    const renderHistory = () => {
        if (state.history.length === 0) {
            ui.historyList.innerHTML = '<div class="history-empty">NO HISTORY</div>';
            return;
        }
        ui.historyList.innerHTML = '';
        state.history.forEach((h, idx) => {
            const el = document.createElement('div');
            el.className = 'history-item';
            if (idx === 0) el.classList.add('new-record'); 
            el.style.backgroundColor = h.color;
            el.textContent = h.num;
            ui.historyList.appendChild(el);
        });
    };

    const showToast = (msg, isError = true) => {
        ui.toast.innerHTML = msg; 
        ui.toast.style.width = 'max-content';
        ui.toast.style.maxWidth = '85%';
        ui.toast.style.whiteSpace = 'normal';
        ui.toast.style.wordBreak = 'break-word';
        ui.toast.style.lineHeight = '1.5';
        ui.toast.style.padding = '14px 24px';
        
        if(isError) {
            ui.toast.style.color = 'var(--danger-accent)';
            ui.toast.style.borderColor = 'var(--danger-accent)';
            ui.toast.style.boxShadow = '0 10px 20px rgba(0,0,0,0.8), 0 0 15px rgba(230, 46, 81, 0.4)';
        } else {
            ui.toast.style.color = 'var(--gold-primary)';
            ui.toast.style.borderColor = 'var(--gold-primary)';
            ui.toast.style.boxShadow = '0 10px 20px rgba(0,0,0,0.8), 0 0 15px rgba(212, 175, 55, 0.4)';
        }
        ui.toast.classList.add('show');
        setTimeout(() => ui.toast.classList.remove('show'), 2500);
    };

    const buildBettingBoard = () => {
        let html = `<div class="bet-zero"><button class="bet-btn board-btn green" data-type="number" data-val="0"><div>0</div><span class="multiplier">(36x)</span></button></div>`;
        html += `<div class="bet-numbers">`;
        for(let i = 1; i <= 36; i++) {
            const colorClass = reds.includes(i) ? 'red' : 'black';
            html += `<button class="bet-btn board-btn ${colorClass}" data-type="number" data-val="${i}"><div>${i}</div><span class="multiplier">(36x)</span></button>`;
        }
        html += `</div>`;

        html += `<div class="bet-dozens">
            <button class="bet-btn board-btn" data-type="dozen" data-val="1"><div>1st 12</div><span class="multiplier">(3x)</span></button>
            <button class="bet-btn board-btn" data-type="dozen" data-val="2"><div>2nd 12</div><span class="multiplier">(3x)</span></button>
            <button class="bet-btn board-btn" data-type="dozen" data-val="3"><div>3rd 12</div><span class="multiplier">(3x)</span></button>
        </div>`;

        html += `<div class="bet-outside">
            <button class="bet-btn board-btn" data-type="highlow" data-val="low"><div>1-18</div><span class="multiplier">(2x)</span></button>
            <button class="bet-btn board-btn" data-type="parity" data-val="even"><div>EVEN</div><span class="multiplier">(2x)</span></button>
            <button class="bet-btn board-btn red" data-type="color" data-val="red"><div>RED</div><span class="multiplier">(2x)</span></button>
            <button class="bet-btn board-btn black" data-type="color" data-val="black"><div>BLACK</div><span class="multiplier">(2x)</span></button>
            <button class="bet-btn board-btn" data-type="parity" data-val="odd"><div>ODD</div><span class="multiplier">(2x)</span></button>
            <button class="bet-btn board-btn" data-type="highlow" data-val="high"><div>19-36</div><span class="multiplier">(2x)</span></button>
        </div>`;

        ui.bettingBoard.innerHTML = html;
    };

    const resetRoulette = () => {
        physics.ballAngle = 0; 
        physics.ballRadius = 240; 
        physics.radialVelocity = 0;
        drawRoulette();
    };

    const trackRadius = 265;     
    const deflectorRadius = 250; 
    const numberOuterVis = 220;  
    const pocketOuterVis = 190;  
    const pocketInnerVis = 160;  
    const pocketOuter = 190; 
    const pocketInner = 160;    
    const settleRadius = 175;    

    const woodTextureOuter = [];
    for (let r = 260; r < 310; ) {
        let step = Math.random() * 2.5 + 1;
        woodTextureOuter.push({
            r: r,
            color: Math.random() > 0.5 ? 'rgba(0, 0, 0, 0.4)' : 'rgba(139, 69, 19, 0.3)',
            ox: (Math.random() - 0.5) * 6,
            oy: (Math.random() - 0.5) * 6
        });
        r += step;
    }

    const woodTextureInner = [];
    for (let r = 0; r < pocketInnerVis; ) {
        let step = Math.random() * 3 + 1;
        woodTextureInner.push({
            r: r,
            color: Math.random() > 0.5 ? 'rgba(0, 0, 0, 0.4)' : 'rgba(139, 69, 19, 0.3)',
            ox: (Math.random() - 0.5) * 6,
            oy: (Math.random() - 0.5) * 6
        });
        r += step;
    }

    // ★ オフスクリーンキャンバスの準備
    let isPreRendered = false;
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 600; bgCanvas.height = 600;
    const bgCtx = bgCanvas.getContext('2d');

    const wheelCanvas = document.createElement('canvas');
    wheelCanvas.width = 600; wheelCanvas.height = 600;
    const wheelCtx = wheelCanvas.getContext('2d');

    const preRender = () => {
        const center = 300;
        const total = state.items.length;

        // --- 1. 動かない背景部分の事前描画 ---
        bgCtx.clearRect(0, 0, 600, 600);
        bgCtx.beginPath(); bgCtx.arc(center, center, 290, 0, Math.PI * 2); 
        bgCtx.fillStyle = '#4a2610'; bgCtx.fill();

        bgCtx.save();
        bgCtx.beginPath(); bgCtx.arc(center, center, 290, 0, Math.PI * 2); bgCtx.clip();
        bgCtx.lineWidth = 1.2;
        woodTextureOuter.forEach(w => {
            bgCtx.strokeStyle = w.color;
            bgCtx.beginPath();
            bgCtx.arc(center + w.ox, center + w.oy, w.r, 0, Math.PI * 2);
            bgCtx.stroke();
        });
        bgCtx.restore();

        const rimGrad = bgCtx.createRadialGradient(center, center, 260, center, center, 300);
        rimGrad.addColorStop(0, 'rgba(46, 21, 10, 0.85)');
        rimGrad.addColorStop(0.3, 'rgba(122, 57, 21, 0.6)'); 
        rimGrad.addColorStop(0.6, 'rgba(74, 38, 16, 0.8)');
        rimGrad.addColorStop(0.9, 'rgba(30, 13, 4, 0.95)');
        rimGrad.addColorStop(1, 'rgba(5, 2, 1, 1)');
        bgCtx.beginPath(); bgCtx.arc(center, center, 290, 0, Math.PI * 2); bgCtx.fillStyle = rimGrad; bgCtx.fill();
        bgCtx.lineWidth = 4; bgCtx.strokeStyle = '#0a0502'; bgCtx.stroke();

        bgCtx.beginPath(); bgCtx.arc(center, center, 285, 0, Math.PI * 2); bgCtx.lineWidth = 1; bgCtx.strokeStyle = 'rgba(0,0,0,0.6)'; bgCtx.stroke();
        bgCtx.beginPath(); bgCtx.arc(center, center, 284, 0, Math.PI * 2); bgCtx.lineWidth = 1; bgCtx.strokeStyle = 'rgba(255,255,255,0.08)'; bgCtx.stroke();
        bgCtx.beginPath(); bgCtx.arc(center, center, 266, 0, Math.PI * 2); bgCtx.lineWidth = 1; bgCtx.strokeStyle = 'rgba(0,0,0,0.8)'; bgCtx.stroke();

        const goldRingGrad = bgCtx.createLinearGradient(0, 0, 600, 600);
        goldRingGrad.addColorStop(0, '#fff3ce');
        goldRingGrad.addColorStop(0.2, '#8a6c1c');
        goldRingGrad.addColorStop(0.5, '#ffffff'); 
        goldRingGrad.addColorStop(0.8, '#4a3200');
        goldRingGrad.addColorStop(1, '#fceea7');
        bgCtx.beginPath(); bgCtx.arc(center, center, 275, 0, Math.PI * 2); bgCtx.lineWidth = 5; bgCtx.strokeStyle = goldRingGrad; bgCtx.stroke();
        
        bgCtx.beginPath(); bgCtx.arc(center, center, 272, 0, Math.PI * 2); bgCtx.fillStyle = '#140a05'; bgCtx.fill();

        bgCtx.save();
        bgCtx.translate(center, center);
        for(let i=0; i<16; i++) {
            const angle = (Math.PI * 2 / 16) * i + (Math.PI / 16); 
            
            bgCtx.beginPath();
            bgCtx.moveTo(Math.cos(angle) * numberOuterVis, Math.sin(angle) * numberOuterVis);
            bgCtx.lineTo(Math.cos(angle) * 272, Math.sin(angle) * 272);
            
            const lineGrad = bgCtx.createLinearGradient(
                Math.cos(angle) * numberOuterVis, Math.sin(angle) * numberOuterVis,
                Math.cos(angle) * 272, Math.sin(angle) * 272
            );
            lineGrad.addColorStop(0, 'rgba(212, 175, 55, 0.9)'); 
            lineGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.3)');
            lineGrad.addColorStop(1, 'rgba(0,0,0,0)');
            
            bgCtx.lineWidth = 2.5;
            bgCtx.strokeStyle = lineGrad;
            bgCtx.stroke();

            bgCtx.beginPath();
            bgCtx.moveTo(Math.cos(angle + 0.015) * numberOuterVis, Math.sin(angle + 0.015) * numberOuterVis);
            bgCtx.lineTo(Math.cos(angle + 0.015) * 272, Math.sin(angle + 0.015) * 272);
            bgCtx.lineWidth = 1.5;
            bgCtx.strokeStyle = 'rgba(0,0,0,0.8)';
            bgCtx.stroke();
        }
        bgCtx.restore();

        const pinGrad = bgCtx.createLinearGradient(-6, -8, 6, 8);
        pinGrad.addColorStop(0, '#ffffff');
        pinGrad.addColorStop(0.4, '#d4af37');
        pinGrad.addColorStop(1, '#4a3200');

        for (let i = 0; i < 8; i++) {
            const defA = (Math.PI * 2 / 8) * i;
            const px = center + Math.cos(defA) * deflectorRadius;
            const py = center + Math.sin(defA) * deflectorRadius;
            
            bgCtx.save(); bgCtx.translate(px + 2, py + 2); bgCtx.rotate(defA + Math.PI/2);
            bgCtx.beginPath(); bgCtx.moveTo(0, -9); bgCtx.lineTo(6, 0); bgCtx.lineTo(0, 9); bgCtx.lineTo(-6, 0); bgCtx.closePath();
            bgCtx.fillStyle = 'rgba(0,0,0,0.8)'; bgCtx.fill(); bgCtx.restore();

            bgCtx.save(); bgCtx.translate(px, py); bgCtx.rotate(defA + Math.PI/2);
            bgCtx.beginPath(); bgCtx.moveTo(0, -9); bgCtx.lineTo(6, 0); bgCtx.lineTo(0, 9); bgCtx.lineTo(-6, 0); bgCtx.closePath();
            bgCtx.fillStyle = pinGrad; bgCtx.fill();
            bgCtx.lineWidth = 0.5; bgCtx.strokeStyle = '#fff'; bgCtx.stroke(); 
            bgCtx.restore();
        }

        // --- 2. 回転する盤面の事前描画 ---
        wheelCtx.clearRect(0, 0, 600, 600);
        wheelCtx.save();
        wheelCtx.translate(center, center);
        const arc = (Math.PI * 2) / total;

        for (let i = 0; i < total; i++) {
            const a = i * arc; const color = state.colors[i];
            
            wheelCtx.beginPath(); wheelCtx.arc(0, 0, numberOuterVis, a, a + arc); wheelCtx.arc(0, 0, pocketOuterVis, a + arc, a, true); wheelCtx.closePath();
            wheelCtx.fillStyle = color; wheelCtx.fill();

            wheelCtx.beginPath(); wheelCtx.arc(0, 0, pocketOuterVis, a, a + arc); wheelCtx.arc(0, 0, pocketInnerVis, a + arc, a, true); wheelCtx.closePath();
            wheelCtx.fillStyle = color; wheelCtx.fill(); wheelCtx.fillStyle = 'rgba(0,0,0,0.6)'; wheelCtx.fill();
            
            wheelCtx.save(); 
            wheelCtx.rotate(a + arc / 2); 
            wheelCtx.textAlign = 'center'; 
            wheelCtx.textBaseline = 'middle'; 
            wheelCtx.fillStyle = '#fff';
            wheelCtx.shadowColor = 'rgba(0,0,0,1)';
            wheelCtx.shadowBlur = 4;
            wheelCtx.shadowOffsetY = 1;
            const fontSize = Math.min(22, (arc * numberOuterVis) * 0.85); 
            wheelCtx.font = `900 ${fontSize}px Arial`; 
            wheelCtx.translate(205, 0); 
            wheelCtx.rotate(Math.PI / 2); 
            wheelCtx.fillText(state.items[i], 0, 0); 
            wheelCtx.restore();
        }

        const goldRingGradW = wheelCtx.createLinearGradient(-300, -300, 300, 300);
        goldRingGradW.addColorStop(0, '#fff3ce');
        goldRingGradW.addColorStop(0.2, '#8a6c1c');
        goldRingGradW.addColorStop(0.5, '#ffffff'); 
        goldRingGradW.addColorStop(0.8, '#4a3200');
        goldRingGradW.addColorStop(1, '#fceea7');

        wheelCtx.beginPath(); wheelCtx.arc(0, 0, pocketOuterVis, 0, Math.PI * 2); wheelCtx.lineWidth = 2; wheelCtx.strokeStyle = goldRingGradW; wheelCtx.stroke();
        wheelCtx.beginPath(); wheelCtx.arc(0, 0, pocketInnerVis, 0, Math.PI * 2); wheelCtx.lineWidth = 4; wheelCtx.strokeStyle = goldRingGradW; wheelCtx.stroke();

        for (let i = 0; i < total; i++) {
            const a = i * arc;
            wheelCtx.beginPath(); wheelCtx.moveTo(Math.cos(a)*pocketOuterVis, Math.sin(a)*pocketOuterVis); wheelCtx.lineTo(Math.cos(a)*numberOuterVis, Math.sin(a)*numberOuterVis);
            wheelCtx.lineWidth = 1; wheelCtx.strokeStyle = 'rgba(212,175,55,0.5)'; wheelCtx.stroke();

            const fretGrad = wheelCtx.createLinearGradient(Math.cos(a)*pocketInnerVis, Math.sin(a)*pocketInnerVis, Math.cos(a)*pocketOuterVis, Math.sin(a)*pocketOuterVis);
            fretGrad.addColorStop(0, '#554000'); 
            fretGrad.addColorStop(0.3, '#d4af37'); 
            fretGrad.addColorStop(0.6, '#ffffff'); 
            fretGrad.addColorStop(0.8, '#d4af37'); 
            fretGrad.addColorStop(1, '#554000');

            wheelCtx.beginPath(); wheelCtx.moveTo(Math.cos(a)*pocketInnerVis, Math.sin(a)*pocketInnerVis); wheelCtx.lineTo(Math.cos(a)*pocketOuterVis, Math.sin(a)*pocketOuterVis);
            wheelCtx.lineWidth = 3; wheelCtx.strokeStyle = fretGrad; wheelCtx.stroke();
        }

        wheelCtx.beginPath(); wheelCtx.arc(0, 0, pocketInnerVis, 0, Math.PI * 2);
        wheelCtx.fillStyle = '#4a2610'; wheelCtx.fill();

        wheelCtx.save();
        wheelCtx.beginPath(); wheelCtx.arc(0, 0, pocketInnerVis, 0, Math.PI * 2); wheelCtx.clip();
        wheelCtx.lineWidth = 1.0;
        woodTextureInner.forEach(w => {
            wheelCtx.strokeStyle = w.color;
            wheelCtx.beginPath();
            wheelCtx.arc(w.ox, w.oy, w.r, 0, Math.PI * 2);
            wheelCtx.stroke();
        });
        wheelCtx.restore();

        const coneGrad = wheelCtx.createRadialGradient(0, 0, 0, 0, 0, pocketInnerVis);
        coneGrad.addColorStop(0, 'rgba(139, 69, 19, 0.6)'); 
        coneGrad.addColorStop(0.5, 'rgba(74, 38, 16, 0.8)'); 
        coneGrad.addColorStop(0.9, 'rgba(30, 13, 4, 0.95)'); 
        coneGrad.addColorStop(1, 'rgba(5, 2, 1, 1)'); 
        wheelCtx.beginPath(); wheelCtx.arc(0, 0, pocketInnerVis, 0, Math.PI * 2);
        wheelCtx.fillStyle = coneGrad; wheelCtx.fill();
        
        wheelCtx.beginPath(); wheelCtx.arc(0, 0, pocketInnerVis - 10, 0, Math.PI * 2); wheelCtx.lineWidth = 1; wheelCtx.strokeStyle = 'rgba(0,0,0,0.8)'; wheelCtx.stroke();
        wheelCtx.beginPath(); wheelCtx.arc(0, 0, pocketInnerVis - 11, 0, Math.PI * 2); wheelCtx.lineWidth = 1; wheelCtx.strokeStyle = 'rgba(255,255,255,0.05)'; wheelCtx.stroke();
        
        const centerGoldGrad = wheelCtx.createRadialGradient(0, 0, 0, 0, 0, 30);
        centerGoldGrad.addColorStop(0, '#ffffff');
        centerGoldGrad.addColorStop(0.3, '#fceea7');
        centerGoldGrad.addColorStop(0.7, '#d4af37');
        centerGoldGrad.addColorStop(1, '#554000');

        for(let i=0; i<4; i++){
            wheelCtx.save(); wheelCtx.rotate((Math.PI/2) * i);
            wheelCtx.beginPath(); wheelCtx.moveTo(10, -5); wheelCtx.lineTo(80, -2); wheelCtx.lineTo(80, 2); wheelCtx.lineTo(10, 5); wheelCtx.closePath();
            const armGrad = wheelCtx.createLinearGradient(10, 0, 80, 0);
            armGrad.addColorStop(0, '#d4af37'); 
            armGrad.addColorStop(0.4, '#ffffff'); 
            armGrad.addColorStop(0.6, '#ffffff');
            armGrad.addColorStop(1, '#8a6d1c');
            wheelCtx.fillStyle = armGrad; 
            wheelCtx.shadowColor = 'rgba(255,255,255,0.7)';
            wheelCtx.shadowBlur = 8;
            wheelCtx.fill();

            wheelCtx.beginPath(); wheelCtx.moveTo(15, 0); wheelCtx.lineTo(75, 0);
            wheelCtx.lineWidth = 1.5; wheelCtx.strokeStyle = 'rgba(255,255,255,0.9)'; wheelCtx.stroke();
            
            wheelCtx.beginPath(); wheelCtx.arc(85, 0, 8, 0, Math.PI*2); wheelCtx.fillStyle = centerGoldGrad; wheelCtx.fill();
            wheelCtx.beginPath(); wheelCtx.arc(85, 0, 4, 0, Math.PI*2); 
            wheelCtx.fillStyle = '#fff'; 
            wheelCtx.shadowColor = '#fff';
            wheelCtx.shadowBlur = 15; 
            wheelCtx.fill(); 
            wheelCtx.restore();
        }
        
        wheelCtx.beginPath(); wheelCtx.arc(0, 0, 26, 0, Math.PI * 2); wheelCtx.fillStyle = centerGoldGrad; wheelCtx.fill(); 
        wheelCtx.beginPath(); wheelCtx.arc(0, 0, 15, 0, Math.PI * 2); wheelCtx.lineWidth = 1; wheelCtx.strokeStyle = '#554000'; wheelCtx.stroke();
        wheelCtx.beginPath(); wheelCtx.arc(0, 0, 8, 0, Math.PI * 2); 
        wheelCtx.fillStyle = '#ffffff'; 
        wheelCtx.shadowColor = 'rgba(255,255,255,1)';
        wheelCtx.shadowBlur = 20; 
        wheelCtx.fill();

        wheelCtx.restore();
        isPreRendered = true;
    };

    const drawRoulette = () => {
        if (!isPreRendered) preRender();

        const ctx = ui.rCtx;
        const center = 300;
        
        ctx.clearRect(0, 0, 600, 600);

        // キャッシュした背景を描画
        ctx.drawImage(bgCanvas, 0, 0);

        // キャッシュしたホイールを描画
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(physics.wheelAngle);
        ctx.translate(-center, -center);
        ctx.drawImage(wheelCanvas, 0, 0);
        ctx.restore();

        // ボール本体を描画
        const bx = center + Math.cos(physics.ballAngle) * physics.ballRadius;
        const by = center + Math.sin(physics.ballAngle) * physics.ballRadius;
        const ballSize = 7.5; 

        ctx.beginPath(); 
        ctx.arc(bx, by, ballSize, 0, Math.PI * 2); 
        const grd = ctx.createRadialGradient(bx-2.5, by-2.5, 0.5, bx, by, ballSize);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.3, '#f0f0f0');
        grd.addColorStop(0.7, '#999999');
        grd.addColorStop(1, '#333333');
        
        ctx.fillStyle = grd; 
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; 
        ctx.shadowBlur = 6; 
        ctx.shadowOffsetX = 2; 
        ctx.shadowOffsetY = 2; 
        ctx.fill(); 
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0; 
        ctx.shadowOffsetY = 0; 
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.stroke();
    };

    const physicsLoop = () => {
        physics.wheelVelocity *= 0.998;
        if (physics.wheelVelocity > -0.0005) {
            physics.wheelVelocity = -0.0005; 
        }
        physics.wheelAngle += physics.wheelVelocity;

        if (!physics.isActive) {
            if (state.items.length > 0) physics.ballAngle += physics.wheelVelocity;
            drawRoulette();
            return;
        }

        physics.ballVelocity *= 0.998;
        let relVel = physics.ballVelocity - physics.wheelVelocity;
        const kineticFriction = 0.0004; 
        
        if (relVel > kineticFriction) physics.ballVelocity -= kineticFriction;
        else if (relVel < -kineticFriction) physics.ballVelocity += kineticFriction;
        else physics.ballVelocity = physics.wheelVelocity; 
        
        physics.ballAngle += physics.ballVelocity;

        const fallThreshold = 0.22; 
        let targetRadius = trackRadius;
        
        if (Math.abs(physics.ballVelocity) < fallThreshold) {
            const speedRatio = Math.max(Math.abs(physics.ballVelocity) / fallThreshold, 0);
            targetRadius = settleRadius + (trackRadius - settleRadius) * Math.pow(speedRatio, 3.0);
        }
        
        let radialAccel = (targetRadius - physics.ballRadius) * 0.04;
        
        if (physics.ballRadius <= numberOuterVis && physics.ballRadius > pocketOuter) {
            radialAccel = (targetRadius - physics.ballRadius) * 0.20; 
        } else if (physics.ballRadius <= pocketOuter) {
            radialAccel = (targetRadius - physics.ballRadius) * 0.15; 
            if (Math.abs(physics.ballVelocity) < fallThreshold * 0.6) {
                targetRadius = settleRadius;
                radialAccel = (targetRadius - physics.ballRadius) * 0.1;
            }
        }

        physics.radialVelocity += radialAccel;
        physics.radialVelocity *= 0.82; 
        physics.ballRadius += physics.radialVelocity;

        if (physics.ballRadius > deflectorRadius - 8 && physics.ballRadius < deflectorRadius + 8) {
            for (let i=0; i<8; i++) {
                const defA = (Math.PI*2/8)*i;
                let diff = Math.abs(physics.ballAngle - defA) % (Math.PI*2);
                if (diff > Math.PI) diff = Math.PI*2 - diff;
                if (diff < 0.08 && Math.random() < 0.4) {
                    physics.ballVelocity *= 0.8; 
                    physics.radialVelocity += 3.0; 
                    physics.ballAngle += (Math.random()-0.5)*0.1;
                }
            }
        }

        if (physics.ballRadius <= numberOuterVis && physics.ballRadius >= pocketInner) {
            const total = state.items.length;
            const arc = (Math.PI * 2) / total;
            let relAngle = (physics.ballAngle - physics.wheelAngle + Math.PI * 100) % (Math.PI * 2);
            const offset = relAngle % arc;
            const collisionThreshold = 0.08; 
            
            relVel = physics.ballVelocity - physics.wheelVelocity;

            const phase = (offset / arc) * Math.PI * 2;
            let terrainGravity = Math.sin(phase) * 0.012; 
            
            if (Math.abs(relVel) < 0.04 && (offset < collisionThreshold || offset > arc - collisionThreshold)) {
                terrainGravity += (offset < arc / 2) ? 0.03 : -0.03;
            }
            physics.ballVelocity += terrainGravity;

            const passThresholdBounce = 0.020; 
            
            if (physics.ballRadius <= pocketOuterVis + 8 && physics.ballRadius >= pocketInnerVis - 10) {
                if (offset < collisionThreshold || offset > arc - collisionThreshold) {
                    
                    if (Math.abs(relVel) > passThresholdBounce) {
                        physics.ballVelocity = physics.wheelVelocity + relVel * 0.75; 
                        
                        if (Math.random() < 0.3) {
                            physics.radialVelocity -= 1.5 + Math.abs(relVel) * 15; 
                        } else {
                            physics.radialVelocity += 3.0 + Math.abs(relVel) * 45; 
                        }
                    } else if (Math.abs(relVel) > 0.005) {
                        physics.ballVelocity = physics.wheelVelocity - relVel * 0.5;
                        if (offset < collisionThreshold) {
                            physics.ballAngle = physics.wheelAngle + (Math.floor(relAngle / arc) * arc + collisionThreshold + 0.005);
                        } else {
                            physics.ballAngle = physics.wheelAngle + (Math.floor(relAngle / arc) * arc + arc - collisionThreshold - 0.005);
                        }
                        physics.radialVelocity += 1.5; 
                    }
                }
            }
        }

        if (Math.abs(physics.ballRadius - settleRadius) <= 15) {
            
            const total = state.items.length;
            const arc = (Math.PI * 2) / total;
            let relAngle = (physics.ballAngle - physics.wheelAngle + Math.PI * 100) % (Math.PI*2);
            let offset = relAngle % arc;
            
            relVel = physics.ballVelocity - physics.wheelVelocity;
            
            physics.ballVelocity = physics.wheelVelocity + relVel * 0.85; 

            let pocketCenter = Math.floor(relAngle / arc) * arc + arc / 2;
            let diff = pocketCenter - relAngle;
            
            physics.ballVelocity += diff * 0.015;

            if (Math.abs(relVel) < 0.005 && Math.abs(diff) < 0.08 && Math.abs(physics.radialVelocity) < 0.2 && Math.abs(physics.wheelVelocity) < 0.02) {
                physics.isActive = false;
                physics.ballVelocity = physics.wheelVelocity; 
                physics.ballAngle = physics.wheelAngle + pocketCenter; 
                physics.ballRadius = settleRadius; 
                physics.radialVelocity = 0;
                
                const winIdx = Math.floor(relAngle / arc);
                
                setTimeout(() => showResult(winIdx), 2500);
            }
        }
        
        drawRoulette(); 
    };

    const startRoulettePhysics = () => {
        physics.ballAngle = Math.random() * Math.PI * 2;
        physics.ballVelocity = 0.35 + Math.random() * 0.05; 
        physics.wheelVelocity = -(0.04 + Math.random() * 0.02); 
        physics.ballRadius = trackRadius; 
        physics.radialVelocity = 0; 
        physics.isActive = true;
    };

    const spin = () => {
        if (state.isSpinning) return;
        
        if (!state.currentBetType) {
            showToast("ベット先を選んでください", true);
            return;
        }
        if (state.balance < state.currentBetAmount) {
            showToast("コインが不足しています", true);
            return;
        }

        updateBalance(-state.currentBetAmount);

        state.isSpinning = true;
        ui.btnSpin.textContent = 'SPINNING...';
        ui.btnSpin.classList.add('spinning');
        ui.btnOpenEdit.disabled = true;
        ui.btnOpenEdit.style.opacity = '0.5';

        startRoulettePhysics();
    };

    const showResult = (winIdx) => {
        const num = state.items[winIdx];
        const colorHex = state.colors[winIdx];
        let colorName = 'black';
        if(colorHex === '#a61c1c') colorName = 'red';
        if(colorHex === '#0e4c34') colorName = 'green';

        state.history.unshift({ num: num, color: colorHex });
        if (state.history.length > 20) state.history.pop();
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.history));
        renderHistory();

        let isWin = false; let payout = 0;
        const type = state.currentBetType; const val = state.currentBetValue;

        if (type === 'number' && num === parseInt(val)) { isWin = true; payout = 36; }
        if (type === 'color' && colorName === val) { isWin = true; payout = 2; }
        if (type === 'parity' && num !== 0) {
            if (val === 'even' && num % 2 === 0) { isWin = true; payout = 2; }
            if (val === 'odd' && num % 2 !== 0) { isWin = true; payout = 2; }
        }
        if (type === 'highlow' && num !== 0) {
            if (val === 'low' && num >= 1 && num <= 18) { isWin = true; payout = 2; }
            if (val === 'high' && num >= 19 && num <= 36) { isWin = true; payout = 2; }
        }
        if (type === 'dozen' && num !== 0) {
            if (val == 1 && num >= 1 && num <= 12) { isWin = true; payout = 3; }
            if (val == 2 && num >= 13 && num <= 24) { isWin = true; payout = 3; }
            if (val == 3 && num >= 25 && num <= 36) { isWin = true; payout = 3; }
        }

        let winAmount = 0;
        if (isWin) {
            winAmount = state.currentBetAmount * payout;
            updateBalance(winAmount);
        }

        ui.resultNum.textContent = `${num}`;
        ui.resultNum.style.background = colorHex;
        ui.resultNum.style.color = '#fff';
        
        if (isWin) {
            ui.resultText.textContent = `WIN! +${winAmount}`;
            ui.resultText.style.color = '#d4af37';
        } else {
            ui.resultText.textContent = 'NO WIN';
            ui.resultText.style.color = '#e62e51';
        }
        
        ui.overlay.style.pointerEvents = 'auto';
        gsap.to(ui.overlay, { opacity: 1, duration: 0.4 });
        gsap.fromTo(ui.resultBox, { scale: 0.5, y: 50 }, { scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.5)' });
    };

    const hideResult = () => {
        gsap.to(ui.overlay, { opacity: 0, duration: 0.3, onComplete: () => {
            ui.overlay.style.pointerEvents = 'none';
            state.isSpinning = false;
            
            validateBetAmount();
            updateBetDisplay();
            
            ui.btnSpin.textContent = 'SPIN WHEEL';
            ui.btnSpin.classList.remove('spinning');
            ui.btnOpenEdit.disabled = false;
            ui.btnOpenEdit.style.opacity = '1';
        }});
    };

    const bindEvents = () => {
        ui.btnSpin.addEventListener('click', spin);
        ui.btnClose.addEventListener('click', hideResult);

        ui.btnOpenEdit.addEventListener('click', () => {
            if (state.isSpinning) return;
            validateBetAmount();
            ui.editModalOverlay.classList.add('show');
        });

        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.target.dataset.val;
                if (val === 'max') {
                    state.currentBetAmount = state.balance;
                } else if (val === 'clear') {
                    state.currentBetAmount = (state.balance > 0) ? 1 : 0;
                } else {
                    const num = parseInt(val);
                    if (state.currentBetAmount === 1 && num > 0) {
                        state.currentBetAmount = num; 
                    } else {
                        state.currentBetAmount += num;
                    }
                }
                
                if (state.currentBetAmount > state.balance) state.currentBetAmount = state.balance;
                if (state.currentBetAmount < 1 && state.balance > 0) state.currentBetAmount = 1;
                
                ui.displayBetAmount.textContent = state.currentBetAmount;
            });
        });

        ui.bettingBoard.addEventListener('click', (e) => {
            let target = e.target;
            while(target && !target.classList.contains('board-btn') && target !== ui.bettingBoard) {
                target = target.parentElement;
            }
            if (target && target.classList.contains('board-btn')) {
                document.querySelectorAll('.board-btn').forEach(b => b.classList.remove('selected'));
                target.classList.add('selected');
                state.currentBetType = target.dataset.type;
                state.currentBetValue = target.dataset.val;
            }
        });

        ui.btnCloseEdit.addEventListener('click', () => {
            updateBetDisplay();
            ui.editModalOverlay.classList.remove('show');
        });

        ui.btnResetCoin.addEventListener('click', () => {
            if (state.isSpinning) return;
            
            if (state.balance > 0) {
                showToast("所持コインがゼロになった時のみ<br>リセット可能です", true);
                return;
            }
            
            state.balance = 10000;
            localStorage.setItem(STORAGE_KEY, 10000);
            ui.uiBalance.textContent = state.balance;
            showToast("コインをリセットしました！", false);
            
            if (state.currentBetAmount === 0) {
                state.currentBetAmount = 100;
            } else if (state.currentBetAmount > state.balance) {
                state.currentBetAmount = state.balance;
            }
            ui.displayBetAmount.textContent = state.currentBetAmount;
            updateBetDisplay();
        });
    };

    init();
})();