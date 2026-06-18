/* ===================================================================
   NEXUS-CORE :: SECURE ACCESS TERMINAL
   Lógica completa: matrix rain, cursor neon, boot sequence, HUD,
   simulação de invasão, criptografia, login sequence e tela final.
=================================================================== */

(() => {
  "use strict";

  /* =========================================================
     0. SOUND ENGINE (Web Audio API — sem arquivos externos)
  ========================================================= */
  const SoundEngine = (() => {
    let ctx = null;
    function getCtx(){
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function keyBlip(){
      try{
        const c = getCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "square";
        osc.frequency.value = 520 + Math.random() * 380;
        gain.gain.value = 0.035;
        osc.connect(gain).connect(c.destination);
        const t = c.currentTime;
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        osc.start(t);
        osc.stop(t + 0.05);
      }catch(e){ /* áudio bloqueado até interação — ignora */ }
    }

    function blip(freq = 700, dur = 0.08, type = "sine", vol = 0.06){
      try{
        const c = getCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = vol;
        osc.connect(gain).connect(c.destination);
        const t = c.currentTime;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }catch(e){}
    }

    function errorBuzz(){
      try{
        const c = getCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sawtooth";
        osc.frequency.value = 140;
        gain.gain.value = 0.05;
        osc.connect(gain).connect(c.destination);
        const t = c.currentTime;
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.linearRampToValueAtTime(90, t + 0.25);
        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.32);
      }catch(e){}
    }

    function accessGranted(){
      const notes = [440, 554.37, 659.25, 880, 1108.73];
      notes.forEach((f, i) => {
        setTimeout(() => blip(f, 0.5, "triangle", 0.07), i * 110);
      });
      setTimeout(() => blip(1760, 0.9, "sine", 0.05), notes.length * 110);
    }

    return { keyBlip, blip, errorBuzz, accessGranted, unlock: getCtx };
  })();

  /* =========================================================
     1. MATRIX RAIN — chuva de caracteres no fundo
  ========================================================= */
  const MatrixRain = (() => {
    const canvas = document.getElementById("matrix-canvas");
    const ctx = canvas.getContext("2d");
    const glyphs = "アァカサタナハマヤラワ01234567890ンヴガザダバパQAZXSWEDCVFRTGBNHYUJMKIOLPΣΦΨΩЖЭ$#&%@+=-";
    let columns, drops, fontSize = 16;
    let ambientParticles = [];

    function resize(){
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      fontSize = window.innerWidth < 600 ? 13 : 16;
      columns = Math.floor(canvas.width / fontSize);
      drops = new Array(columns).fill(0).map(() => Math.random() * -50);
      ambientParticles = new Array(36).fill(0).map(makeParticle);
    }

    function makeParticle(){
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.4,
        speed: Math.random() * 0.4 + 0.1,
        alpha: Math.random() * 0.5 + 0.15
      };
    }

    function draw(){
      ctx.fillStyle = "rgba(2, 6, 4, 0.13)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = fontSize + "px monospace";
      for (let i = 0; i < drops.length; i++){
        const char = glyphs[Math.floor(Math.random() * glyphs.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // glow no caractere "líder" da coluna
        ctx.fillStyle = "#bfffe0";
        ctx.shadowColor = "#00ff84";
        ctx.shadowBlur = 6;
        ctx.fillText(char, x, y);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(0, 255, 132, 0.55)";
        ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], x, y - fontSize);

        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.4 + Math.random() * 0.5;
      }

      // partículas ambiente flutuando (extra de "neon verde")
      ambientParticles.forEach(p => {
        p.y -= p.speed;
        if (p.y < 0) { p.y = canvas.height; p.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 255, 132, ${p.alpha})`;
        ctx.shadowColor = "#00ff84";
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    draw();
    return { resize };
  })();

  /* =========================================================
     2. CURSOR NEON TRAIL
  ========================================================= */
  (() => {
    const canvas = document.getElementById("cursor-canvas");
    const ctx = canvas.getContext("2d");
    let points = [];
    let mouse = { x: -100, y: -100 };

    function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener("resize", resize);
    resize();

    window.addEventListener("pointermove", (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      points.push({ x: e.clientX, y: e.clientY, life: 1 });
      if (points.length > 26) points.shift();
    });

    function draw(){
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // anel ao redor do cursor
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,132,0.9)";
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "#00ff84";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ponto central
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#bfffe0";
      ctx.fill();

      // rastro
      for (let i = 0; i < points.length; i++){
        const p = points[i];
        const t = i / points.length;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4 * t, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 132, ${t * 0.45})`;
        ctx.shadowColor = "#00ff84";
        ctx.shadowBlur = 6;
        ctx.fill();
        p.life -= 0.04;
      }
      ctx.shadowBlur = 0;
      points = points.filter(p => p.life > 0);

      requestAnimationFrame(draw);
    }
    draw();
  })();

  /* =========================================================
     3. BOOT SEQUENCE (efeito de máquina ligando)
  ========================================================= */
  const BootSequence = (() => {
    const bootScreen = document.getElementById("boot-screen");
    const bootLog = document.getElementById("boot-log");
    const app = document.getElementById("app");

    const lines = [
      "BOOT SEQUENCE INITIATED...",
      "LOADING KERNEL MODULES ................. OK",
      "MOUNTING SECURE FILESYSTEM .............. OK",
      "INITIALIZING NEXUS-CORE OS v4.2.1",
      "CALIBRATING NEURAL FIREWALL .............. OK",
      "ESTABLISHING ENCRYPTED HANDSHAKE ..........",
      "HANDSHAKE COMPLETE. CHANNEL SECURE.",
      "WELCOME TO NEXUS-CORE TERMINAL."
    ];

    function typeLine(lineIndex, cb){
      if (lineIndex >= lines.length) return cb();
      const line = lines[lineIndex];
      let charIndex = 0;
      const interval = setInterval(() => {
        bootLog.textContent += line[charIndex];
        charIndex++;
        if (charIndex >= line.length){
          clearInterval(interval);
          bootLog.textContent += "\n";
          setTimeout(() => typeLine(lineIndex + 1, cb), 140 + Math.random() * 120);
        }
      }, 9 + Math.random() * 16);
    }

    function start(){
      typeLine(0, () => {
        setTimeout(() => {
          bootScreen.classList.add("fade-out");
          setTimeout(() => {
            bootScreen.style.display = "none";
            app.classList.remove("hidden");
            app.classList.add("reveal");
            window.dispatchEvent(new Event("app:ready"));
          }, 600);
        }, 500);
      });
    }

    return { start };
  })();

  /* =========================================================
     4. RELÓGIO DO SISTEMA
  ========================================================= */
  function startClock(){
    const clockEl = document.getElementById("clock");
    function tick(){
      const d = new Date();
      const pad = n => String(n).padStart(2, "0");
      clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* =========================================================
     5. HUD: RADAR + STATS
  ========================================================= */
  function startHUD(){
    const blipsGroup = document.getElementById("radar-blips");

    function spawnBlips(){
      blipsGroup.innerHTML = "";
      const count = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++){
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 65;
        const cx = 100 + Math.cos(angle) * radius;
        const cy = 100 + Math.sin(angle) * radius;
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", cx.toFixed(1));
        circle.setAttribute("cy", cy.toFixed(1));
        circle.setAttribute("r", 2.6);
        circle.setAttribute("class", "radar-blip");
        circle.style.animationDelay = (Math.random() * 1.4).toFixed(2) + "s";
        blipsGroup.appendChild(circle);
      }
    }
    spawnBlips();
    setInterval(spawnBlips, 1700);

    const barCpu = document.getElementById("bar-cpu");
    const barNet = document.getElementById("bar-net");
    const barEnc = document.getElementById("bar-enc");
    const barThreat = document.getElementById("bar-threat");
    const valCpu = document.getElementById("val-cpu");
    const valNet = document.getElementById("val-net");
    const valEnc = document.getElementById("val-enc");
    const valThreat = document.getElementById("val-threat");

    let encTarget = 12;
    window.NEXUS_setEncryptionLevel = (v) => { encTarget = v; };

    function rand(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }

    function update(){
      const cpu = rand(28, 92);
      const net = rand(15, 88);
      encTarget = Math.min(100, encTarget + rand(-3, 6));
      const threatVal = rand(5, 100);

      barCpu.style.width = cpu + "%";
      barNet.style.width = net + "%";
      barEnc.style.width = encTarget + "%";
      barThreat.style.width = threatVal + "%";

      valCpu.textContent = cpu + "%";
      valNet.textContent = net + "%";
      valEnc.textContent = encTarget + "%";
      valThreat.textContent = threatVal > 66 ? "HIGH" : threatVal > 33 ? "MED" : "LOW";
      valThreat.style.color = threatVal > 66 ? "var(--red-alert)" : threatVal > 33 ? "#ffd23f" : "var(--green-soft)";
    }
    update();
    setInterval(update, 1500);
  }

  /* =========================================================
     6. LOG TERMINAL
  ========================================================= */
  const LogTerminal = (() => {
    const output = document.getElementById("log-output");

    function timestamp(){
      const d = new Date();
      const pad = n => String(n).padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function add(message, type = ""){
      const line = document.createElement("div");
      line.className = "log-line" + (type ? " " + type : "");
      line.innerHTML = `<span class="ts">[${timestamp()}]</span>${message}`;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
      // limita histórico para não pesar o DOM
      while (output.children.length > 80) output.removeChild(output.firstChild);
    }
    return { add };
  })();

  /* =========================================================
     7. SIMULAÇÃO DE INVASÃO — CAMPO USERNAME
  ========================================================= */
  function setupUsernameField(){
    const input = document.getElementById("username");
    let debounceTimer = null;
    let started = false;

    input.addEventListener("keydown", () => SoundEngine.keyBlip());

    input.addEventListener("input", () => {
      const val = input.value.trim();
      clearTimeout(debounceTimer);

      if (val.length === 0){
        started = false;
        return;
      }

      if (!started){
        started = true;
        LogTerminal.add(`Scanning user "<span style="color:var(--cyan)">${escapeHtml(val)}</span>"...`);
      }

      debounceTimer = setTimeout(() => {
        LogTerminal.add("Loading profile data...");
        setTimeout(() => {
          LogTerminal.add("Verifying credentials...", "ok");
          const match = (70 + Math.random() * 29).toFixed(1);
          LogTerminal.add(`Identity match probability: ${match}%`);
        }, 550);
      }, 650);
    });
  }

  function escapeHtml(str){
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* =========================================================
     8. CRIPTOGRAFIA — CAMPO PASSWORD
  ========================================================= */
  function setupPasswordField(){
    const input = document.getElementById("password");
    const strip = document.getElementById("encryption-strip");
    const hexChars = "0123456789ABCDEF";
    let scrambleInterval = null;
    let loggedOnce = false;

    function randomHex(len){
      let s = "";
      for (let i = 0; i < len; i++) s += hexChars[Math.floor(Math.random() * hexChars.length)];
      return s;
    }

    function startScramble(){
      strip.classList.add("active");
      scrambleInterval = setInterval(() => {
        const a = randomHex(8);
        const b = randomHex(6);
        strip.textContent = `KEYSTREAM ${a}::${b}  ENTROPY ${(Math.random()*100).toFixed(1)}%`;
      }, 90);
    }

    function stopScramble(){
      clearInterval(scrambleInterval);
      strip.classList.remove("active");
    }

    input.addEventListener("focus", () => {
      startScramble();
      if (typeof window.NEXUS_setEncryptionLevel === "function") window.NEXUS_setEncryptionLevel(55);
      if (!loggedOnce){
        loggedOnce = true;
        LogTerminal.add("Encryption Enabled", "ok");
        SoundEngine.blip(900, 0.12, "sine", 0.05);
        setTimeout(() => {
          LogTerminal.add("Secure Channel Established", "ok");
        }, 500);
      }
    });

    input.addEventListener("blur", () => {
      stopScramble();
      strip.textContent = "";
      if (typeof window.NEXUS_setEncryptionLevel === "function") window.NEXUS_setEncryptionLevel(30);
    });

    input.addEventListener("keydown", () => SoundEngine.keyBlip());
  }

  /* =========================================================
     9. SEQUÊNCIA DE LOGIN (ACCESS SYSTEM)
  ========================================================= */
  function setupLoginSequence(){
    const form = document.getElementById("login-form");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const btn = document.getElementById("access-btn");
    const btnText = document.getElementById("access-btn-text");
    const progressWrap = document.getElementById("progress-wrap");
    const progressFill = document.getElementById("progress-fill");
    const progressPct = document.getElementById("progress-pct");
    const progressStage = document.getElementById("progress-stage");

    const stages = [
      { pct: 18, label: "Connecting to server...", type: "" },
      { pct: 44, label: "Bypassing firewall...", type: "warn" },
      { pct: 70, label: "Decrypting access token...", type: "ok" },
      { pct: 93, label: "Establishing secure connection...", type: "ok" },
      { pct: 100, label: "Access protocol verified.", type: "ok" }
    ];

    let running = false;

    function shakeButton(){
      btn.style.transition = "transform .08s";
      let count = 0;
      const sh = setInterval(() => {
        btn.style.transform = `translateX(${count % 2 === 0 ? -6 : 6}px)`;
        count++;
        if (count > 5){ clearInterval(sh); btn.style.transform = "translateX(0)"; }
      }, 60);
    }

    function animateTo(targetPct, duration, onDone){
      const startPct = parseFloat(progressFill.style.width) || 0;
      const startTime = performance.now();
      function frame(now){
        const t = Math.min(1, (now - startTime) / duration);
        const current = startPct + (targetPct - startPct) * t;
        progressFill.style.width = current + "%";
        progressPct.textContent = Math.round(current) + "%";
        if (t < 1) requestAnimationFrame(frame);
        else onDone && onDone();
      }
      requestAnimationFrame(frame);
    }

    function runStage(i){
      if (i >= stages.length){
        setTimeout(() => triggerAccessGranted(usernameInput.value || "ADMIN"), 500);
        return;
      }
      const stage = stages[i];
      progressStage.textContent = stage.label;
      LogTerminal.add(stage.label, stage.type);
      if (stage.label.includes("firewall")) SoundEngine.blip(220, 0.18, "sawtooth", 0.05);
      animateTo(stage.pct, 850, () => runStage(i + 1));
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      SoundEngine.unlock();
      if (running) return;

      if (!usernameInput.value.trim() || !passwordInput.value.trim()){
        LogTerminal.add("ERROR: Missing credentials. Access denied.", "alert");
        SoundEngine.errorBuzz();
        shakeButton();
        return;
      }

      running = true;
      btn.disabled = true;
      usernameInput.disabled = true;
      passwordInput.disabled = true;
      btnText.textContent = "PROCESSING...";
      progressWrap.classList.add("visible");
      progressFill.style.width = "0%";
      progressPct.textContent = "0%";
      LogTerminal.add("ACCESS SYSTEM triggered by operator.", "ok");
      runStage(0);
    });
  }

  /* =========================================================
     10. TELA FINAL — GLITCH + ACCESS GRANTED
  ========================================================= */
  function buildFlashOverlay(){
    const flash = document.createElement("div");
    flash.className = "flash-overlay";
    document.body.appendChild(flash);
    return flash;
  }

  function triggerAccessGranted(username){
    const finalScreen = document.getElementById("final-screen");
    const text1 = document.getElementById("glitch-text-1");
    const text2 = document.getElementById("glitch-text-2");
    const meta = document.querySelector(".final-meta");
    const restartBtn = document.getElementById("restart-btn");
    const tokenEl = document.getElementById("session-token");
    const flash = buildFlashOverlay();

    LogTerminal.add("Access protocol complete. Welcome, " + escapeHtml(username) + ".", "ok");

    flash.classList.add("flash");
    SoundEngine.blip(60, 0.3, "square", 0.08);

    setTimeout(() => {
      finalScreen.classList.add("show");
      tokenEl.textContent = "0x" + Array.from({length:10}, () =>
        "0123456789ABCDEF"[Math.floor(Math.random()*16)]).join("");

      [text1, text2, meta, restartBtn].forEach(el => el.classList.add("run"));
      SoundEngine.accessGranted();
      startParticleBurst();
    }, 280);
  }

  /* =========================================================
     11. PARTÍCULAS DE CELEBRAÇÃO (tela final)
  ========================================================= */
  function startParticleBurst(){
    const canvas = document.getElementById("particle-canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    for (let i = 0; i < 140; i++){
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 1.5;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: Math.random() * 2.4 + 0.6
      });
    }

    function frame(){
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        if (p.life <= 0) return;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        p.life -= 0.012;
        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 255, 132, ${Math.max(p.life, 0)})`;
        ctx.shadowColor = "#00ff84";
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      if (alive) requestAnimationFrame(frame);
    }
    frame();
  }

  /* =========================================================
     12. RESTART
  ========================================================= */
  function setupRestart(){
    document.getElementById("restart-btn").addEventListener("click", () => {
      window.location.reload();
    });
  }

  /* =========================================================
     INICIALIZAÇÃO
  ========================================================= */
  window.addEventListener("app:ready", () => {
    startClock();
    startHUD();
    LogTerminal.add("Boot complete. NEXUS-CORE terminal online.", "ok");
    LogTerminal.add("Awaiting operator input...");
  });

  document.addEventListener("DOMContentLoaded", () => {
    setupUsernameField();
    setupPasswordField();
    setupLoginSequence();
    setupRestart();
    document.body.addEventListener("pointerdown", () => SoundEngine.unlock(), { once: true });
    BootSequence.start();
  });

})();