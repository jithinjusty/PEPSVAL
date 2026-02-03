/* Pepsval Image Editor Module */
(function (window) {
    const Editor = {
        state: {
            originalImage: null,
            canvas: null,
            ctx: null,
            history: [],
            historyIndex: -1,
            filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0, sepia: 0, grayscale: 0, invert: 0, warm: 0, cool: 0, vintage: 0 },
            transform: { x: 0, y: 0, scale: 1 },
            drawings: [],
            texts: [],
            selectedTextIndex: -1,
            activeTab: 'filters',
            drawColor: '#000000',
            drawSize: 5,
            isDrawing: false,
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            dragTarget: null,
            drawMode: 'brush',
            callback: null
        },

        open: function (file, onSave) {
            this.ensureHtml();
            this.state.callback = onSave;
            this.init(file);
        },

        ensureHtml: function () {
            if (document.getElementById('editorModal')) return;

            const modal = document.createElement('div');
            modal.id = 'editorModal';
            modal.className = 'editor-modal';
            modal.style.display = 'none';
            modal.innerHTML = `
    <div class="editor-content">
      <div class="editor-header">
        <h3 class="editor-title">Studio Editor</h3>
        <div class="editor-header-actions">
          <button id="btnUndo" class="pv-icon-btn" title="Undo">↩️</button>
          <button id="btnRedo" class="pv-icon-btn" title="Redo">↪️</button>
          <button id="closeEditorInv" class="pv-icon-btn">&times;</button>
        </div>
      </div>

      <div class="editor-workspace">
        <canvas id="editCanvas"></canvas>
      </div>

      <!-- Tools Navigation -->
      <div class="editor-tabs">
        <button class="editor-tab active" data-tab="filters">Filters</button>
        <button class="editor-tab" data-tab="adjust">Adjust</button>
        <button class="editor-tab" data-tab="crop">Crop</button>
        <button class="editor-tab" data-tab="draw">Draw</button>
        <button class="editor-tab" data-tab="text">Text</button>
      </div>

      <!-- Tools Panels -->
      <div class="editor-panels">
        <!-- Filters -->
        <div class="editor-panel active" id="panel-filters">
          <div class="filter-grid">
            <button class="filter-btn active" data-filter="normal">Normal</button>
            <button class="filter-btn" data-filter="grayscale">B&W</button>
            <button class="filter-btn" data-filter="sepia">Sepia</button>
            <button class="filter-btn" data-filter="invert">Invert</button>
            <button class="filter-btn" data-filter="warm">Warm</button>
            <button class="filter-btn" data-filter="cool">Cool</button>
            <button class="filter-btn" data-filter="vintage">Vintage</button>
          </div>
        </div>

        <!-- Adjust -->
        <div class="editor-panel" id="panel-adjust">
          <div class="editor-slider-wrap">
            <div class="editor-slider-label"><span>Brightness</span> <span id="val-brightness">100%</span></div>
            <input type="range" class="editor-range" id="rng-brightness" min="0" max="200" value="100">
          </div>
          <div class="editor-slider-wrap">
            <div class="editor-slider-label"><span>Contrast</span> <span id="val-contrast">100%</span></div>
            <input type="range" class="editor-range" id="rng-contrast" min="0" max="200" value="100">
          </div>
          <div class="editor-slider-wrap">
            <div class="editor-slider-label"><span>Saturation</span> <span id="val-saturate">100%</span></div>
            <input type="range" class="editor-range" id="rng-saturate" min="0" max="200" value="100">
          </div>
          <div class="editor-slider-wrap">
            <div class="editor-slider-label"><span>Blur</span> <span id="val-blur">0px</span></div>
            <input type="range" class="editor-range" id="rng-blur" min="0" max="10" value="0">
          </div>
        </div>

        <!-- Crop -->
        <div class="editor-panel" id="panel-crop">
          <div class="crop-grid">
            <button class="pv-btn pv-btn-ghost" data-crop="free">Free</button>
            <button class="pv-btn pv-btn-ghost" data-crop="1:1">Square (1:1)</button>
            <button class="pv-btn pv-btn-ghost" data-crop="4:3">4:3</button>
            <button class="pv-btn pv-btn-ghost" data-crop="16:9">16:9</button>
            <button class="pv-btn pv-btn-ghost" data-crop="reset">Reset</button>
          </div>
        </div>

        <!-- Draw -->
        <div class="editor-panel" id="panel-draw">
          <div class="draw-controls">
            <div class="color-picker-row" id="draw-palette">
              <!-- Auto-populated by JS -->
            </div>
            <div class="editor-slider-wrap">
              <div class="editor-slider-label"><span>Brush Size</span> <span id="val-brush">5px</span></div>
              <input type="range" class="editor-range" id="rng-brush" min="1" max="50" value="5">
            </div>
            <div style="display:flex; gap:10px; margin-top:10px;">
              <button id="btn-draw-mode" class="pv-btn pv-btn-primary" style="flex:1">Draw</button>
              <button id="btn-erase-mode" class="pv-btn pv-btn-ghost" style="flex:1">Erase</button>
              <button id="btn-clear-draw" class="pv-btn pv-btn-ghost" style="color:var(--danger)">Clear</button>
            </div>
          </div>
        </div>

        <!-- Text -->
        <div class="editor-panel" id="panel-text">
          <div style="display:flex; gap:10px; margin-bottom:12px;">
            <input id="text-input" type="text" class="pv-input" placeholder="Enter text...">
            <button id="btn-add-text" class="pv-btn pv-btn-primary">Add</button>
          </div>
          <div class="editor-slider-wrap">
            <div class="editor-slider-label"><span>Size</span></div>
            <input type="range" class="editor-range" id="text-size-input" min="10" max="200" value="40">
          </div>
          <div style="display:flex; gap:10px; margin-top:12px; align-items:center;">
             <span>Color:</span>
             <input type="color" id="text-color" value="#ffffff" style="width:40px; height:30px; border:none; padding:0; background:none;">
             <select id="text-font-input" class="pv-input" style="width:auto; padding:4px 8px;">
               <option value="sans-serif">Sans Serif</option>
               <option value="serif">Serif</option>
               <option value="monospace">Monospace</option>
               <option value="cursive">Cursive</option>
               <option value="fantasy">Fantasy</option>
             </select>
             <button id="btn-clear-text" class="pv-btn pv-btn-ghost" style="font-size:12px; margin-left:auto;">Clear All</button>
          </div>
        </div>
      </div>

      <div class="editor-actions">
        <button id="cancelEdit" class="pv-btn pv-btn-ghost">Cancel</button>
        <button id="saveEdit" class="pv-btn pv-btn-primary">Save & Apply</button>
      </div>
    </div>`;
            document.body.appendChild(modal);
            this.bindEvents();
        },

        bindEvents: function () {
            const $ = id => document.getElementById(id);

            $('closeEditorInv').onclick = () => this.close();
            $('cancelEdit').onclick = () => this.close();
            $('saveEdit').onclick = () => this.save();

            $('btnUndo').onclick = () => this.undo();
            $('btnRedo').onclick = () => this.redo();

            // Tabs
            document.querySelectorAll('.editor-tab').forEach(t => {
                t.onclick = (e) => this.switchTab(e.target.dataset.tab);
            });

            // Filters
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.onclick = () => {
                    document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
                    b.classList.add('active');
                    const type = b.dataset.filter;
                    // reset all others? usually presets reset standard filters
                    this.state.filters = { brightness: 100, contrast: 100, saturate: 100, blur: 0, sepia: 0, grayscale: 0, invert: 0, warm: 0, cool: 0, vintage: 0 };
                    if (type === 'grayscale') this.state.filters.grayscale = 100;
                    if (type === 'sepia') this.state.filters.sepia = 100;
                    if (type === 'invert') this.state.filters.invert = 100;
                    if (type === 'warm') this.state.filters.warm = 50;
                    if (type === 'cool') this.state.filters.cool = 50;
                    if (type === 'vintage') this.state.filters.vintage = 50;

                    this.pushHistory();
                    this.updateFilterUI();
                    this.render();
                };
            });

            // Sliders
            const bindSlider = (id, key, suffix = '%') => {
                const el = $(id);
                el.addEventListener('input', () => {
                    this.state.filters[key] = Number(el.value);
                    if ($(`val-${key}`)) $(`val-${key}`).textContent = el.value + suffix;
                    this.render();
                });
                el.addEventListener('change', () => this.pushHistory());
            };

            bindSlider('rng-brightness', 'brightness');
            bindSlider('rng-contrast', 'contrast');
            bindSlider('rng-saturate', 'saturate');
            bindSlider('rng-blur', 'blur', 'px');

            // Crop
            document.querySelectorAll('[data-crop]').forEach(b => {
                b.onclick = () => this.applyCrop(b.dataset.crop);
            });

            // Draw Palette
            this.generatePalette();
            $('rng-brush').oninput = (e) => {
                this.state.drawSize = Number(e.target.value);
                $('val-brush').textContent = e.target.value + 'px';
            };

            $('btn-draw-mode').onclick = () => {
                this.state.drawMode = 'brush';
                $('btn-draw-mode').classList.replace('pv-btn-ghost', 'pv-btn-primary');
                $('btn-erase-mode').classList.replace('pv-btn-primary', 'pv-btn-ghost');
            };
            $('btn-erase-mode').onclick = () => {
                this.state.drawMode = 'erase';
                $('btn-erase-mode').classList.replace('pv-btn-ghost', 'pv-btn-primary');
                $('btn-draw-mode').classList.replace('pv-btn-primary', 'pv-btn-ghost');
            };
            $('btn-clear-draw').onclick = () => {
                if (confirm("Clear all drawings?")) {
                    this.state.drawings = [];
                    this.render();
                    this.pushHistory();
                }
            };

            // Text
            $('btn-add-text').onclick = () => this.addText();
            $('text-input').onkeydown = (e) => { if (e.key === 'Enter') this.addText(); };

            $('btn-clear-text').onclick = () => {
                if (confirm("Clear all text?")) {
                    this.state.texts = [];
                    this.render();
                    this.pushHistory();
                }
            };

            // Live Props
            const bindLive = (id, prop) => {
                const el = $(id);
                el.addEventListener('input', () => {
                    if (this.state.selectedTextIndex !== -1 && this.state.texts[this.state.selectedTextIndex]) {
                        this.state.texts[this.state.selectedTextIndex][prop] = el.value;
                        this.render();
                    }
                });
                el.addEventListener('change', () => this.pushHistory());
            };
            bindLive('text-size-input', 'size');
            bindLive('text-color', 'color');
            bindLive('text-font-input', 'font');

            // Interaction
            const canvas = $('editCanvas');
            canvas.addEventListener('mousedown', (e) => this.handlePointer(e));
            canvas.addEventListener('mousemove', (e) => this.handlePointer(e));
            canvas.addEventListener('mouseup', (e) => this.handlePointer(e));
            canvas.addEventListener('mouseleave', (e) => this.handlePointer(e));
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.handleZoom(e.deltaY);
            });
        },

        // --- Logic Methods ---
        init: function (file) {
            this.state.canvas = document.getElementById('editCanvas');
            this.state.ctx = this.state.canvas.getContext('2d');

            const img = new Image();
            img.onload = () => {
                this.state.originalImage = img;
                const MAX_W = 800;
                const MAX_H = 600;
                let scale = Math.min(MAX_W / img.width, MAX_H / img.height);
                this.state.canvas.width = img.width * scale;
                this.state.canvas.height = img.height * scale;
                this.state.transform = { x: 0, y: 0, scale: scale };

                // Reset defaults
                this.state.filters = { brightness: 100, contrast: 100, saturate: 100, blur: 0, sepia: 0, grayscale: 0, invert: 0, warm: 0, cool: 0, vintage: 0 };
                this.state.drawings = [];
                this.state.texts = [];
                this.state.selectedTextIndex = -1;
                this.state.history = [];
                this.state.historyIndex = -1;

                this.pushHistory();
                this.switchTab('filters');
                document.getElementById('editorModal').style.display = 'flex';
                this.render();
            };
            img.src = URL.createObjectURL(file);
        },

        close: function () {
            document.getElementById('editorModal').style.display = 'none';
            if (this.state.originalImage) URL.revokeObjectURL(this.state.originalImage.src);
        },

        save: function () {
            this.state.canvas.toBlob((blob) => {
                if (this.state.callback) this.state.callback(blob);
                this.close();
            }, 'image/jpeg', 0.9);
        },

        // ... Copy render, handlePointer, etc logic ...

        toImageSpace: function (cx, cy) {
            const t = this.state.transform;
            return { x: (cx - t.x) / t.scale, y: (cy - t.y) / t.scale };
        },

        render: function () {
            if (!this.state.originalImage || !this.state.ctx) return;
            const ctx = this.state.ctx;
            const img = this.state.originalImage;
            const cvs = this.state.canvas;
            const t = this.state.transform;
            const f = this.state.filters;

            ctx.clearRect(0, 0, cvs.width, cvs.height);

            let fs = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) blur(${f.blur}px) sepia(${f.sepia}%) grayscale(${f.grayscale}%) invert(${f.invert}%)`;
            if (f.warm > 0) fs += ` sepia(${f.warm * 0.3}%) saturate(${100 + f.warm}%)`;
            if (f.cool > 0) fs += ` hue-rotate(-${f.cool * 0.5}deg) saturate(${100 - f.cool * 0.2}%)`;
            if (f.vintage > 0) fs += ` sepia(${f.vintage * 0.5}%) contrast(${100 + f.vintage * 0.2}%)`;

            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.scale(t.scale, t.scale);
            ctx.filter = fs;
            ctx.drawImage(img, 0, 0);
            ctx.filter = 'none';

            // Drawings
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            this.state.drawings.forEach(s => {
                ctx.beginPath();
                ctx.strokeStyle = s.color;
                ctx.lineWidth = s.size;
                ctx.globalCompositeOperation = s.isErase ? 'destination-out' : 'source-over';
                if (s.points.length > 0) {
                    ctx.moveTo(s.points[0].x, s.points[0].y);
                    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
                }
                ctx.stroke();
            });
            ctx.globalCompositeOperation = 'source-over';

            // Text
            this.state.texts.forEach((txt, idx) => {
                ctx.fillStyle = txt.color;
                ctx.font = `bold ${txt.size}px ${txt.font || 'sans-serif'}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(txt.text, txt.x, txt.y);

                if (idx === this.state.selectedTextIndex) {
                    ctx.save();
                    ctx.strokeStyle = '#00FFFF';
                    ctx.lineWidth = 2 / t.scale;
                    const m = ctx.measureText(txt.text);
                    const h = txt.size;
                    ctx.setLineDash([5 / t.scale, 5 / t.scale]);
                    ctx.strokeRect(txt.x - m.width / 2 - 10, txt.y - h / 2 - 10, m.width + 20, h + 20);
                    ctx.restore();
                }
            });
            ctx.restore();
        },

        handlePointer: function (e) {
            const rect = this.state.canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const ip = this.toImageSpace(cx, cy);

            if (e.type === 'mousedown') {
                this.state.isDragging = true;
                this.state.dragStart = { x: cx, y: cy };

                if (this.state.activeTab === 'draw') {
                    this.state.isDrawing = true;
                    this.state.currentStroke = {
                        color: this.state.drawColor,
                        size: this.state.drawSize / this.state.transform.scale,
                        isErase: this.state.drawMode === 'erase',
                        points: [{ x: ip.x, y: ip.y }]
                    };
                    this.state.drawings.push(this.state.currentStroke);
                    this.render();
                }
                else if (this.state.activeTab === 'text') {
                    // Hit test
                    this.state.selectedTextIndex = -1;
                    let hit = -1;
                    this.state.ctx.save();
                    for (let i = this.state.texts.length - 1; i >= 0; i--) {
                        const t = this.state.texts[i];
                        this.state.ctx.font = `bold ${t.size}px ${t.font || 'sans-serif'}`;
                        const m = this.state.ctx.measureText(t.text);
                        if (Math.abs(ip.x - t.x) < m.width / 2 + 10 && Math.abs(ip.y - t.y) < t.size / 2 + 10) {
                            hit = i;
                            break;
                        }
                    }
                    this.state.ctx.restore();

                    if (hit !== -1) {
                        this.state.selectedTextIndex = hit;
                        this.state.dragTarget = { type: 'text', index: hit };
                        // sync UI
                        const t = this.state.texts[hit];
                        document.getElementById('text-input').value = "";
                        document.getElementById('text-size-input').value = t.size;
                        document.getElementById('text-color').value = t.color;
                        document.getElementById('text-font-input').value = t.font;
                    } else {
                        this.state.dragTarget = { type: 'pan' };
                    }
                    this.render();
                } else {
                    this.state.dragTarget = { type: 'pan' };
                }
            }
            else if (e.type === 'mousemove') {
                if (!this.state.isDragging) return;
                const dx = cx - this.state.dragStart.x;
                const dy = cy - this.state.dragStart.y;
                this.state.dragStart = { x: cx, y: cy };

                if (this.state.activeTab === 'draw' && this.state.isDrawing) {
                    this.state.currentStroke.points.push({ x: ip.x, y: ip.y });
                    this.render();
                }
                else if (this.state.dragTarget?.type === 'text') {
                    const idx = this.state.dragTarget.index;
                    if (this.state.texts[idx]) {
                        this.state.texts[idx].x += dx / this.state.transform.scale;
                        this.state.texts[idx].y += dy / this.state.transform.scale;
                        this.render();
                    }
                }
                else if (this.state.dragTarget?.type === 'pan') {
                    this.state.transform.x += dx;
                    this.state.transform.y += dy;
                    this.render();
                }
            }
            else if (e.type === 'mouseup' || e.type === 'mouseleave') {
                if (this.state.isDragging) {
                    this.state.isDragging = false;
                    this.state.isDrawing = false;
                    this.state.dragTarget = null;
                    this.pushHistory();
                }
            }
        },

        handleZoom: function (delta) {
            const f = delta > 0 ? 0.9 : 1.1; // wheel down = zoom in usually? Wait, delta > 0 is scroll down (zoom out).
            // Standard: deltaY > 0 (scroll down) -> Zoom Out. deltaY < 0 (scroll up) -> Zoom In.
            // My code: delta > 0 ? 1.1 : 0.9.  If delta > 0 (down), 1.1 (In). 
            // Let's invert: delta > 0 (down/pull back) -> 0.9. delta < 0 (up/push in) -> 1.1
            const factor = delta > 0 ? 0.9 : 1.1;
            this.state.transform.scale *= factor;
            this.render();
        },

        addText: function () {
            const txt = document.getElementById('text-input').value.trim();
            if (!txt) return;
            const s = Number(document.getElementById('text-size-input').value || 40);
            const f = document.getElementById('text-font-input').value || 'sans-serif';
            const c = document.getElementById('text-color').value || '#ffffff';

            const cvs = this.state.canvas;
            const t = this.state.transform;
            const center = this.toImageSpace(cvs.width / 2, cvs.height / 2);

            this.state.texts.push({ text: txt, x: center.x, y: center.y, color: c, size: s, font: f });
            this.state.selectedTextIndex = this.state.texts.length - 1;
            document.getElementById('text-input').value = "";
            this.pushHistory();
            this.render();
        },

        applyCrop: function (ratio) {
            // Similar to original code
            const img = this.state.originalImage;
            if (!img) return;
            if (ratio === 'reset') {
                const MAX_W = 800;
                const MAX_H = 600;
                let scale = Math.min(MAX_W / img.width, MAX_H / img.height);
                this.state.canvas.width = img.width * scale;
                this.state.canvas.height = img.height * scale;
                this.state.transform = { x: 0, y: 0, scale: scale };
            } else if (ratio !== 'free') {
                const [rw, rh] = ratio.split(':').map(Number);
                const targetRatio = rw / rh;
                let w = this.state.canvas.width;
                let h = w / targetRatio;
                this.state.canvas.height = h;
            }
            this.render();
            this.pushHistory();
        },

        pushHistory: function () {
            // clone state
            const s = {
                filters: { ...this.state.filters },
                transform: { ...this.state.transform },
                drawings: JSON.parse(JSON.stringify(this.state.drawings)),
                texts: JSON.parse(JSON.stringify(this.state.texts))
            };
            if (this.state.historyIndex < this.state.history.length - 1) {
                this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
            }
            this.state.history.push(s);
            this.state.historyIndex = this.state.history.length - 1;
            this.updateUndoRedoUI();
        },

        undo: function () {
            if (this.state.historyIndex > 0) {
                this.state.historyIndex--;
                this.restore(this.state.history[this.state.historyIndex]);
            }
        },

        redo: function () {
            if (this.state.historyIndex < this.state.history.length - 1) {
                this.state.historyIndex++;
                this.restore(this.state.history[this.state.historyIndex]);
            }
        },

        restore: function (s) {
            this.state.filters = { ...s.filters };
            this.state.transform = { ...s.transform };
            this.state.drawings = JSON.parse(JSON.stringify(s.drawings));
            this.state.texts = JSON.parse(JSON.stringify(s.texts));
            this.state.selectedTextIndex = -1;
            this.updateFilterUI();
            this.render();
            this.updateUndoRedoUI();
        },

        updateUndoRedoUI: function () {
            const u = document.getElementById('btnUndo');
            const r = document.getElementById('btnRedo');
            if (u) u.disabled = this.state.historyIndex <= 0;
            if (r) r.disabled = this.state.historyIndex >= this.state.history.length - 1;
            if (u) u.style.opacity = u.disabled ? 0.3 : 1;
            if (r) r.style.opacity = r.disabled ? 0.3 : 1;
        },

        updateFilterUI: function () {
            const f = this.state.filters;
            const set = (k, v) => {
                const el = document.getElementById(`rng-${k}`);
                if (el) el.value = v;
            };
            set('brightness', f.brightness);
            set('contrast', f.contrast);
            set('saturate', f.saturate);
            set('blur', f.blur);
        },

        switchTab: function (tab) {
            this.state.activeTab = tab;
            document.querySelectorAll('.editor-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
            document.querySelectorAll('.editor-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
            if (tab !== 'text') {
                this.state.selectedTextIndex = -1;
                this.render();
            }
        },

        generatePalette: function () {
            const c = document.getElementById('draw-palette');
            if (!c) return;
            const p = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#FFA500', '#800080', '#A52A2A', '#808080'];
            c.innerHTML = p.map(x => `<div class="color-dot" style="background:${x}" data-color="${x}"></div>`).join('');
            c.querySelectorAll('.color-dot').forEach(d => {
                d.onclick = () => {
                    c.querySelectorAll('.color-dot').forEach(z => z.classList.remove('active'));
                    d.classList.add('active');
                    if (this.state.activeTab === 'draw') this.state.drawColor = d.dataset.color;
                }
            });
        }
    };

    window.PepsvalEditor = Editor;

})(window);
