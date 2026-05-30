(() => {
    const STORAGE_KEY = 'royal_roulette_balance';

    // 状態管理
    const state = {
        items: [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],
        colors: [],
        isSpinning: false,
        balance: parseInt(localStorage.getItem(STORAGE_KEY)),
        currentBetType: null,
        currentBetValue: null,
        currentBetAmount: 100
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
        btnResetCoin: document.getElementById('btnResetCoin')
    };

    const init = () => {
        updateBalance(0);
        ui.displayBetAmount.textContent = state.currentBetAmount;
        buildBettingBoard(); 
        resetRoulette();
        bindEvents();
        gsap.ticker.add(physicsLoop);
    };

    const updateBalance = (amt) => {
        state.balance += amt;
        if (state.balance < 0) state.balance = 0;
        localStorage.setItem(STORAGE_KEY, state.balance);
        ui.uiBalance.textContent = state.balance;
    };

    // 自作Alertの表示崩れを防ぐため、スタイルを強制的に調整
    const showToast = (msg, isError = true) => {
        ui.toast.textContent = msg;
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

    // --- 物理演算・描画パラメータ ---
    const trackRadius = 265;     
    const deflectorRadius = 250; 
    const numberOuterVis = 220;  
    const pocketOuterVis = 190;  
    const pocketInnerVis = 160;  

    const pocketOuter = 190; 
    const pocketInner = 160;    
    const settleRadius = 175;    

    // ★ 木目模様を事前に生成して固定（ウネウネ動くのを防ぐ）
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

    const drawRoulette = () => {
        const ctx = ui.rCtx;
        const total = state.items.length;
        ctx.clearRect(0, 0, 600, 600);
        const center = 300;
        
        // 外側の木目ベース
        ctx.beginPath(); ctx.arc(center, center, 290, 0, Math.PI * 2); 
        ctx.fillStyle = '#4a2610'; ctx.fill();

        // 静的な年輪（木目）を描画
        ctx.save();
        ctx.beginPath(); ctx.arc(center, center, 290, 0, Math.PI * 2); ctx.clip();
        ctx.lineWidth = 1.2;
        woodTextureOuter.forEach(w => {
            ctx.strokeStyle = w.color;
            ctx.beginPath();
            ctx.arc(center + w.ox, center + w.oy, w.r, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.restore();

        // ニスのような光沢グラデーションを重ねる
        const rimGrad = ctx.createRadialGradient(center, center, 260, center, center, 300);
        rimGrad.addColorStop(0, 'rgba(46, 21, 10, 0.85)');
        rimGrad.addColorStop(0.3, 'rgba(122, 57, 21, 0.6)'); // 光沢
        rimGrad.addColorStop(0.6, 'rgba(74, 38, 16, 0.8)');
        rimGrad.addColorStop(0.9, 'rgba(30, 13, 4, 0.95)');
        rimGrad.addColorStop(1, 'rgba(5, 2, 1, 1)');
        ctx.beginPath(); ctx.arc(center, center, 290, 0, Math.PI * 2); ctx.fillStyle = rimGrad; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#0a0502'; ctx.stroke();

        ctx.beginPath(); ctx.arc(center, center, 285, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(center, center, 284, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(center, center, 266, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.stroke();

        const goldRingGrad = ctx.createLinearGradient(0, 0, 600, 600);
        goldRingGrad.addColorStop(0, '#fff3ce');
        goldRingGrad.addColorStop(0.2, '#8a6c1c');
        goldRingGrad.addColorStop(0.5, '#ffffff'); // 強いハイライト
        goldRingGrad.addColorStop(0.8, '#4a3200');
        goldRingGrad.addColorStop(1, '#fceea7');
        ctx.beginPath(); ctx.arc(center, center, 275, 0, Math.PI * 2); ctx.lineWidth = 5; ctx.strokeStyle = goldRingGrad; ctx.stroke();
        
        ctx.beginPath(); ctx.arc(center, center, 272, 0, Math.PI * 2); ctx.fillStyle = '#140a05'; ctx.fill();

        // 扇形の区切り線（ボウル部分の装飾溝）
        ctx.save();
        ctx.translate(center, center);
        for(let i=0; i<16; i++) {
            const angle = (Math.PI * 2 / 16) * i + (Math.PI / 16); 
            
            // ゴールドの線
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * numberOuterVis, Math.sin(angle) * numberOuterVis);
            ctx.lineTo(Math.cos(angle) * 272, Math.sin(angle) * 272);
            
            const lineGrad = ctx.createLinearGradient(
                Math.cos(angle) * numberOuterVis, Math.sin(angle) * numberOuterVis,
                Math.cos(angle) * 272, Math.sin(angle) * 272
            );
            lineGrad.addColorStop(0, 'rgba(212, 175, 55, 0.9)'); 
            lineGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.3)');
            lineGrad.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = lineGrad;
            ctx.stroke();

            // 溝の立体感を出すシャドウ
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle + 0.015) * numberOuterVis, Math.sin(angle + 0.015) * numberOuterVis);
            ctx.lineTo(Math.cos(angle + 0.015) * 272, Math.sin(angle + 0.015) * 272);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.stroke();
        }
        ctx.restore();

        const pinGrad = ctx.createLinearGradient(-6, -8, 6, 8);
        pinGrad.addColorStop(0, '#ffffff');
        pinGrad.addColorStop(0.4, '#d4af37');
        pinGrad.addColorStop(1, '#4a3200');

        for (let i = 0; i < 8; i++) {
            const defA = (Math.PI * 2 / 8) * i;
            const px = center + Math.cos(defA) * deflectorRadius;
            const py = center + Math.sin(defA) * deflectorRadius;
            
            ctx.save(); ctx.translate(px + 2, py + 2); ctx.rotate(defA + Math.PI/2);
            ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 0); ctx.lineTo(0, 9); ctx.lineTo(-6, 0); ctx.closePath();
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fill(); ctx.restore();

            ctx.save(); ctx.translate(px, py); ctx.rotate(defA + Math.PI/2);
            ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 0); ctx.lineTo(0, 9); ctx.lineTo(-6, 0); ctx.closePath();
            ctx.fillStyle = pinGrad; ctx.fill();
            ctx.lineWidth = 0.5; ctx.strokeStyle = '#fff'; ctx.stroke(); 
            ctx.restore();
        }

        if (total > 0) {
            ctx.save(); ctx.translate(center, center); ctx.rotate(physics.wheelAngle);
            const arc = (Math.PI * 2) / total;

            for (let i = 0; i < total; i++) {
                const a = i * arc; const color = state.colors[i];
                
                ctx.beginPath(); ctx.arc(0, 0, numberOuterVis, a, a + arc); ctx.arc(0, 0, pocketOuterVis, a + arc, a, true); ctx.closePath();
                ctx.fillStyle = color; ctx.fill();

                ctx.beginPath(); ctx.arc(0, 0, pocketOuterVis, a, a + arc); ctx.arc(0, 0, pocketInnerVis, a + arc, a, true); ctx.closePath();
                ctx.fillStyle = color; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
                
                ctx.save(); 
                ctx.rotate(a + arc / 2); 
                ctx.textAlign = 'center'; 
                ctx.textBaseline = 'middle'; 
                ctx.fillStyle = '#fff';
                ctx.shadowColor = 'rgba(0,0,0,1)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = 1;
                const fontSize = Math.min(22, (arc * numberOuterVis) * 0.85); 
                ctx.font = `900 ${fontSize}px Arial`; 
                ctx.translate(205, 0); 
                ctx.rotate(Math.PI / 2); 
                ctx.fillText(state.items[i], 0, 0); 
                ctx.restore();
            }

            ctx.beginPath(); ctx.arc(0, 0, pocketOuterVis, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = goldRingGrad; ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, pocketInnerVis, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = goldRingGrad; ctx.stroke();

            for (let i = 0; i < total; i++) {
                const a = i * arc;
                ctx.beginPath(); ctx.moveTo(Math.cos(a)*pocketOuterVis, Math.sin(a)*pocketOuterVis); ctx.lineTo(Math.cos(a)*numberOuterVis, Math.sin(a)*numberOuterVis);
                ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(212,175,55,0.5)'; ctx.stroke();

                const fretGrad = ctx.createLinearGradient(Math.cos(a)*pocketInnerVis, Math.sin(a)*pocketInnerVis, Math.cos(a)*pocketOuterVis, Math.sin(a)*pocketOuterVis);
                fretGrad.addColorStop(0, '#554000'); 
                fretGrad.addColorStop(0.3, '#d4af37'); 
                fretGrad.addColorStop(0.6, '#ffffff'); 
                fretGrad.addColorStop(0.8, '#d4af37'); 
                fretGrad.addColorStop(1, '#554000');

                ctx.beginPath(); ctx.moveTo(Math.cos(a)*pocketInnerVis, Math.sin(a)*pocketInnerVis); ctx.lineTo(Math.cos(a)*pocketOuterVis, Math.sin(a)*pocketOuterVis);
                ctx.lineWidth = 3; ctx.strokeStyle = fretGrad; ctx.stroke();
            }

            // 中心のコーンにも固定された木目とニス光沢
            ctx.beginPath(); ctx.arc(0, 0, pocketInnerVis, 0, Math.PI * 2);
            ctx.fillStyle = '#4a2610'; ctx.fill();

            ctx.save();
            ctx.beginPath(); ctx.arc(0, 0, pocketInnerVis, 0, Math.PI * 2); ctx.clip();
            ctx.lineWidth = 1.0;
            woodTextureInner.forEach(w => {
                ctx.strokeStyle = w.color;
                ctx.beginPath();
                ctx.arc(w.ox, w.oy, w.r, 0, Math.PI * 2);
                ctx.stroke();
            });
            ctx.restore();

            const coneGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, pocketInnerVis);
            coneGrad.addColorStop(0, 'rgba(139, 69, 19, 0.6)'); // 中央ハイライト
            coneGrad.addColorStop(0.5, 'rgba(74, 38, 16, 0.8)'); 
            coneGrad.addColorStop(0.9, 'rgba(30, 13, 4, 0.95)'); 
            coneGrad.addColorStop(1, 'rgba(5, 2, 1, 1)'); 
            ctx.beginPath(); ctx.arc(0, 0, pocketInnerVis, 0, Math.PI * 2);
            ctx.fillStyle = coneGrad; ctx.fill();
            
            ctx.beginPath(); ctx.arc(0, 0, pocketInnerVis - 10, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, pocketInnerVis - 11, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.stroke();
            
            const centerGoldGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
            centerGoldGrad.addColorStop(0, '#ffffff');
            centerGoldGrad.addColorStop(0.3, '#fceea7');
            centerGoldGrad.addColorStop(0.7, '#d4af37');
            centerGoldGrad.addColorStop(1, '#554000');

            // 十字オーナメントの強烈な光沢
            for(let i=0; i<4; i++){
                ctx.save(); ctx.rotate((Math.PI/2) * i);
                ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(80, -2); ctx.lineTo(80, 2); ctx.lineTo(10, 5); ctx.closePath();
                const armGrad = ctx.createLinearGradient(10, 0, 80, 0);
                armGrad.addColorStop(0, '#d4af37'); 
                armGrad.addColorStop(0.4, '#ffffff'); // 強い白光
                armGrad.addColorStop(0.6, '#ffffff');
                armGrad.addColorStop(1, '#8a6d1c');
                ctx.fillStyle = armGrad; 
                ctx.shadowColor = 'rgba(255,255,255,0.7)';
                ctx.shadowBlur = 8;
                ctx.fill();

                // センターラインのハイライト
                ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(75, 0);
                ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
                
                ctx.beginPath(); ctx.arc(85, 0, 8, 0, Math.PI*2); ctx.fillStyle = centerGoldGrad; ctx.fill();
                ctx.beginPath(); ctx.arc(85, 0, 4, 0, Math.PI*2); 
                ctx.fillStyle = '#fff'; 
                ctx.shadowColor = '#fff';
                ctx.shadowBlur = 15; // 先端を光らせる
                ctx.fill(); 
                ctx.restore();
            }
            
            ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fillStyle = centerGoldGrad; ctx.fill(); 
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = '#554000'; ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); 
            ctx.fillStyle = '#ffffff'; 
            ctx.shadowColor = 'rgba(255,255,255,1)';
            ctx.shadowBlur = 20; 
            ctx.fill();

            ctx.restore();
        }

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
            ui.editModalOverlay.classList.add('show');
        });

        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.target.dataset.val;
                if (val === 'max') {
                    state.currentBetAmount = state.balance;
                } else if (val === 'clear') {
                    state.currentBetAmount = 1;
                } else {
                    const num = parseInt(val);
                    if (state.currentBetAmount === 1 && num > 0) {
                        state.currentBetAmount = num; 
                    } else {
                        state.currentBetAmount += num;
                    }
                }
                
                if (state.currentBetAmount > state.balance) state.currentBetAmount = state.balance;
                if (state.currentBetAmount < 1) state.currentBetAmount = 1;
                
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
            if(state.currentBetType) {
                let displayVal = state.currentBetValue;
                if(state.currentBetType === 'color') displayVal = displayVal.toUpperCase();
                else if(state.currentBetType === 'highlow' && displayVal === 'low') displayVal = '1-18';
                else if(state.currentBetType === 'highlow' && displayVal === 'high') displayVal = '19-36';
                else if(state.currentBetType === 'dozen') displayVal = `${displayVal}st/nd/rd 12`;
                
                ui.currentBetDisplay.innerHTML = `<span style="font-size:0.8em; color:#aaa;">BET ON:</span> ${displayVal} <span style="color:var(--gold-primary); font-size:1.2em;">🪙 ${state.currentBetAmount}</span>`;
            } else {
                ui.currentBetDisplay.textContent = 'ベット先を選択してください';
            }
            ui.editModalOverlay.classList.remove('show');
        });

        ui.btnResetCoin.addEventListener('click', () => {
            if (state.isSpinning) return;
            
            if (state.balance > 0) {
                showToast("所持コインがゼロになった時のみリセット可能です", true);
                return;
            }
            
            state.balance = 10000;
            localStorage.setItem(STORAGE_KEY, 10000);
            ui.uiBalance.textContent = state.balance;
            showToast("コインをリセットしました！", false);
            
            if (state.currentBetAmount > state.balance) {
                state.currentBetAmount = state.balance;
                ui.displayBetAmount.textContent = state.currentBetAmount;
            }
        });
    };

    init();
})();