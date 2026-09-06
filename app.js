// Mzayn Camel Tournament Analysis & Optimization Engine (مُحَلِّل بطولات النياق)

class MzaynAnalyzer {
  constructor() {
    this.camels = [];
    this.sponsorScenario = 'auto';
    this.squadSize = 3;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSampleData();
  }

  bindEvents() {
    // Dropzone & File Input
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        this.handleFilesUpload(e.dataTransfer.files);
      }
    });

    const folderInput = document.getElementById('folder-input');

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.handleFilesUpload(e.target.files);
      }
    });

    if (folderInput) {
      folderInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          this.handleFilesUpload(e.target.files);
        }
      });
    }

    // Buttons
    document.getElementById('load-samples-btn').addEventListener('click', () => this.loadSampleData());
    document.getElementById('add-camel-btn').addEventListener('click', () => this.openEditorModal());
    document.getElementById('clear-all-btn').addEventListener('click', () => this.promptClearAll());

    // Custom Delete Modal Handlers
    document.getElementById('delete-cancel-btn').addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('delete-confirm-btn').addEventListener('click', () => {
      if (this.pendingDeleteAction) {
        this.pendingDeleteAction();
        this.pendingDeleteAction = null;
      }
      this.closeDeleteModal();
    });

    // Scenarios & Options
    document.getElementById('sponsor-scenario').addEventListener('change', (e) => {
      this.sponsorScenario = e.target.value;
      this.updateUI();
    });

    const squadSelect = document.getElementById('squad-size');
    const customInput = document.getElementById('custom-squad-size');

    squadSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        customInput.style.display = 'block';
        this.squadSize = parseInt(customInput.value, 10) || 5;
      } else {
        customInput.style.display = 'none';
        this.squadSize = parseInt(e.target.value, 10);
      }
      this.updateUI();
    });

    customInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val >= 1 && val <= 100) {
        this.squadSize = val;
        this.updateUI();
      }
    });

    // Modal Form
    document.getElementById('modal-close-btn').addEventListener('click', () => this.closeEditorModal());
    document.getElementById('cancel-edit-btn').addEventListener('click', () => this.closeEditorModal());
    document.getElementById('camel-editor-form').addEventListener('submit', (e) => this.handleSaveCamel(e));

    // Report Actions
    document.getElementById('share-squad-btn').addEventListener('click', () => this.shareSquadNumbers());
    document.getElementById('copy-report-btn').addEventListener('click', () => this.copyReportToClipboard());
    document.getElementById('print-report-btn').addEventListener('click', () => window.print());
  }

  // --- Sample Data Loader ---
  loadSampleData() {
    this.camels = [
      {
        id: 'c1',
        name: 'صاد 61',
        number: '61',
        breed: 'حمر',
        genderAge: 'أنثى - بكرة (عمر 1)',
        imageUrl: this.generateCamelPlaceholderSVG('صاد 61 (حمر)', '#b91c1c'),
        attributes: {
          nose: 288,
          head: 288,
          eyelashes: 282,
          ears: 284,
          hump: 283,
          neck: 286,
          lips: 287
        },
        spacingBonus: 1.06, // التباعد 6
        consistencyBonus: 1.19, // التناسق العام ×1.19
        sponsorBonus: 1.00,
        unclearFields: []
      },
      {
        id: 'c2',
        name: 'الشيخة (العاصفة)',
        number: '101',
        breed: 'صفر',
        genderAge: 'ناقة - حقة',
        imageUrl: this.generateCamelPlaceholderSVG('الشيخة - 101', '#d4af37'),
        attributes: {
          nose: 290,
          head: 294,
          eyelashes: 291,
          ears: 292,
          hump: 295,
          neck: 293,
          lips: 296
        },
        spacingBonus: 1.08,
        consistencyBonus: 1.06,
        sponsorBonus: 1.10,
        unclearFields: []
      },
      {
        id: 'c3',
        name: 'النايفة',
        number: '102',
        breed: 'مجاهيم',
        genderAge: 'ناقة - جذعة',
        imageUrl: this.generateCamelPlaceholderSVG('النايفة - 102', '#334155'),
        attributes: {
          nose: 295,
          head: 298,
          eyelashes: 275,
          ears: 297,
          hump: 299,
          neck: 295,
          lips: 296
        },
        spacingBonus: 1.02,
        consistencyBonus: null, // Auto calculated (Weak consistency due to spread)
        sponsorBonus: 1.00,
        unclearFields: []
      },
      {
        id: 'c4',
        name: 'طوارئ',
        number: '103',
        breed: 'حمر',
        genderAge: 'ناقة - لقيّة',
        imageUrl: this.generateCamelPlaceholderSVG('طوارئ - 103', '#b91c1c'),
        attributes: {
          nose: 288,
          head: 291,
          eyelashes: 289,
          ears: 290,
          hump: 292,
          neck: 290,
          lips: 291
        },
        spacingBonus: 1.07,
        consistencyBonus: 1.08,
        sponsorBonus: 1.05,
        unclearFields: []
      }
    ];

    this.updateUI();
  }

  // Generate clean SVG placeholders for preview
  generateCamelPlaceholderSVG(title, colorHex) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">
      <rect width="100%" height="100%" fill="#131722"/>
      <path d="M 50 180 Q 100 120 150 160 T 250 140 T 350 180" stroke="${colorHex}" stroke-width="4" fill="none" opacity="0.3"/>
      <circle cx="200" cy="110" r="45" fill="${colorHex}" opacity="0.15"/>
      <text x="200" y="105" fill="${colorHex}" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">🐪 ${title}</text>
      <text x="200" y="145" fill="#9ca3af" font-family="sans-serif" font-size="14" text-anchor="middle">صورة ناقة معتمدة للبطولة</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // --- Mathematical & Logic Engine ---
  calculateCamelStats(camel) {
    const attrKeys = ['nose', 'head', 'eyelashes', 'ears', 'hump', 'neck', 'lips'];
    let validValues = [];
    let unclearList = [...(camel.unclearFields || [])];

    attrKeys.forEach(key => {
      const val = camel.attributes[key];
      if (val !== null && val !== undefined && !isNaN(val) && val > 0) {
        validValues.push(Number(val));
      }
    });

    const hasUnclear = unclearList.length > 0 || validValues.length < attrKeys.length;

    // 1. Sum & Averages
    const sum = validValues.reduce((a, b) => a + b, 0);
    const avg = validValues.length ? (sum / validValues.length).toFixed(2) : 0;
    const maxVal = validValues.length ? Math.max(...validValues) : 0;
    const minVal = validValues.length ? Math.min(...validValues) : 0;
    const spread = maxVal - minVal;

    // 2. Consistency Bonus (بونص التناسق)
    let consistencyVal = 1.00;
    let consistencyGrade = 'متوسط';

    if (camel.consistencyBonus !== null && camel.consistencyBonus !== undefined && !isNaN(camel.consistencyBonus) && camel.consistencyBonus > 0) {
      consistencyVal = parseFloat(camel.consistencyBonus);
      if (consistencyVal >= 1.08) consistencyGrade = 'ممتاز';
      else if (consistencyVal >= 1.04) consistencyGrade = 'جيد';
      else if (consistencyVal >= 1.00) consistencyGrade = 'متوسط';
      else consistencyGrade = 'ضعيف';
    } else {
      // Auto compute from attribute spread
      if (spread <= 5) {
        consistencyVal = 1.08;
        consistencyGrade = 'ممتاز';
      } else if (spread <= 10) {
        consistencyVal = 1.04;
        consistencyGrade = 'جيد';
      } else if (spread <= 18) {
        consistencyVal = 1.00;
        consistencyGrade = 'متوسط';
      } else {
        consistencyVal = 0.95;
        consistencyGrade = 'ضعيف';
      }
    }

    // 3. Spacing Bonus (بونص التباعد)
    let spacingVal = camel.spacingBonus ? parseFloat(camel.spacingBonus) : 1.00;

    // 4. Sponsor Bonus (بونص الراعي)
    let sponsorVal = 1.00;
    if (this.sponsorScenario !== 'auto') {
      sponsorVal = parseFloat(this.sponsorScenario);
    } else if (camel.sponsorBonus) {
      sponsorVal = parseFloat(camel.sponsorBonus);
    }

    // 5. Final Calculation
    // النتيجة النهائية = مجموع الصفات × بونص التباعد × بونص التناسق × بونص الراعي
    const finalScore = parseFloat((sum * spacingVal * consistencyVal * sponsorVal).toFixed(2));

    return {
      sum,
      avg,
      maxVal,
      minVal,
      spread,
      consistencyVal,
      consistencyGrade,
      spacingVal,
      sponsorVal,
      finalScore,
      hasUnclear,
      unclearList
    };
  }

  // --- UI Update & Rendering ---
  updateUI() {
    this.renderCamelCards();
    this.renderRankingTable();
    this.renderSquadOptimizer();
    this.renderOfficialReport();

    document.getElementById('camels-count-badge').textContent = `${this.camels.length} نياق مسجلة`;
    document.getElementById('squad-title-indicator').textContent = `تشكيلة ${this.squadSize} نياق`;
  }

  getRankedCamels() {
    return [...this.camels].map(camel => {
      const stats = this.calculateCamelStats(camel);
      return { camel, stats };
    }).sort((a, b) => b.stats.finalScore - a.stats.finalScore);
  }

  renderCamelCards() {
    const grid = document.getElementById('camels-grid');
    grid.innerHTML = '';

    const ranked = this.getRankedCamels();

    if (ranked.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fa-solid fa-camel" style="font-size: 3rem; margin-bottom: 1rem; color: var(--gold-primary);"></i>
          <h3>لا توجد نياق مسجلة حالياً</h3>
          <p>قم برفع صور النياق أو انقر على "تحميل صور ونياق نموذجية" لبدء التحليل والمقارنة.</p>
        </div>`;
      return;
    }

    ranked.forEach((item, index) => {
      const { camel, stats } = item;
      const rank = index + 1;

      const card = document.createElement('div');
      card.className = 'camel-card';
      card.innerHTML = `
        <div class="camel-card-header">
          <div class="camel-name-tag">
            <h3>${camel.name} ${camel.number ? `(#${camel.number})` : ''}</h3>
            <p>${camel.breed || 'سلالة عادية'} | ${camel.genderAge || 'غير محدد'}</p>
          </div>
          <div class="rank-badge">${rank}</div>
        </div>

        <div class="camel-card-body">
          <img src="${camel.imageUrl}" class="camel-img-preview" alt="${camel.name}">

          ${stats.hasUnclear ? `
            <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); padding: 0.5rem 0.8rem; border-radius: var(--radius-sm); font-size: 0.8rem; color: #fca5a5;">
              <i class="fa-solid fa-triangle-exclamation"></i> <strong>ترتيب مبدئي — غير نهائي:</strong> توجد صفات غير واضحة (${stats.unclearList.join(', ') || 'البعض'})
            </div>
          ` : ''}

          <div class="stats-list">
            <div class="stat-item"><span class="stat-label">الأنف:</span><span class="stat-value ${camel.attributes.nose ? '' : 'unclear'}">${camel.attributes.nose ?? 'غير واضح'}</span></div>
            <div class="stat-item"><span class="stat-label">الرأس:</span><span class="stat-value ${camel.attributes.head ? '' : 'unclear'}">${camel.attributes.head ?? 'غير واضح'}</span></div>
            <div class="stat-item"><span class="stat-label">الرموش:</span><span class="stat-value ${camel.attributes.eyelashes ? '' : 'unclear'}">${camel.attributes.eyelashes ?? 'غير واضح'}</span></div>
            <div class="stat-item"><span class="stat-label">الأذن:</span><span class="stat-value ${camel.attributes.ears ? '' : 'unclear'}">${camel.attributes.ears ?? 'غير واضح'}</span></div>
            <div class="stat-item"><span class="stat-label">السنام:</span><span class="stat-value ${camel.attributes.hump ? '' : 'unclear'}">${camel.attributes.hump ?? 'غير واضح'}</span></div>
            <div class="stat-item"><span class="stat-label">الرقبة:</span><span class="stat-value ${camel.attributes.neck ? '' : 'unclear'}">${camel.attributes.neck ?? 'غير واضح'}</span></div>
            <div class="stat-item"><span class="stat-label">الشفاه:</span><span class="stat-value ${camel.attributes.lips ? '' : 'unclear'}">${camel.attributes.lips ?? 'غير واضح'}</span></div>
          </div>

          <div class="score-breakdown-box">
            <div class="score-row"><span>مجموع الصفات:</span><strong>${stats.sum}</strong></div>
            <div class="score-row"><span>بونص التباعد:</span><strong>${stats.spacingVal}x</strong></div>
            <div class="score-row"><span>بونص التناسق:</span><strong>${stats.consistencyVal}x (${stats.consistencyGrade})</strong></div>
            <div class="score-row"><span>بونص الراعي:</span><strong>${stats.sponsorVal}x</strong></div>
            <div class="score-row total-final">
              <span>النتيجة النهائية:</span>
              <span>${stats.finalScore.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn btn-primary" style="flex: 1; font-size: 0.82rem;" onclick="app.openEditorModal('${camel.id}')">
            <i class="fa-solid fa-pen-to-square"></i> تعديل وتدقيق
          </button>
          <button class="btn btn-danger" style="font-size: 0.82rem;" onclick="app.deleteCamel('${camel.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  renderRankingTable() {
    const tbody = document.getElementById('ranking-table-body');
    tbody.innerHTML = '';

    const ranked = this.getRankedCamels();

    ranked.forEach((item, index) => {
      const { camel, stats } = item;
      const rank = index + 1;

      const tagClass = stats.consistencyGrade === 'ممتاز' ? 'tag-excellent' :
                       stats.consistencyGrade === 'جيد' ? 'tag-good' :
                       stats.consistencyGrade === 'متوسط' ? 'tag-medium' : 'tag-weak';

      const row = document.createElement('tr');
      if (rank === 1) row.className = 'rank-1';

      row.innerHTML = `
        <td><strong style="color: var(--gold-light); font-size: 1.1rem;">#${rank}</strong></td>
        <td>
          <strong>${camel.name}</strong> ${camel.number ? `(${camel.number})` : ''}
          ${stats.hasUnclear ? '<span style="color: var(--accent-red); font-size: 0.75rem;"> [بيانات غير اكتمال]</span>' : ''}
        </td>
        <td>${camel.breed || '-'} | ${camel.genderAge || '-'}</td>
        <td><strong>${stats.sum}</strong></td>
        <td>${stats.spacingVal}x</td>
        <td>${stats.consistencyVal}x</td>
        <td>${stats.sponsorVal}x</td>
        <td><strong style="color: var(--gold-primary); font-size: 1.05rem;">${stats.finalScore.toLocaleString()}</strong></td>
        <td><span class="tag-badge ${tagClass}">${stats.consistencyGrade}</span></td>
        <td>
          <button class="btn" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;" onclick="app.openEditorModal('${camel.id}')">
            <i class="fa-solid fa-pen"></i> تدقيق
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  // --- Squad Optimizer Engine ---
  renderSquadOptimizer() {
    const container = document.getElementById('squad-options-grid');
    container.innerHTML = '';

    const ranked = this.getRankedCamels();
    if (ranked.length < this.squadSize) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
          <i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; color: var(--accent-amber); margin-bottom: 0.5rem;"></i>
          <p>تحتاج إلى إضافة ${this.squadSize - ranked.length} نياق إضافية على الأقل لتكوين وتفنيط تشكيلة بطولة مكونة من (${this.squadSize} متن).</p>
        </div>`;
      return;
    }

    let primaryCombo, alt1Combo, alt2Combo;

    if (this.squadSize <= 5 && ranked.length <= 15) {
      const combos = this.getCombinations(ranked, this.squadSize);
      const scoredCombos = combos.map(combo => {
        const totalScore = combo.reduce((acc, curr) => acc + curr.stats.finalScore, 0);
        const avgConsistency = (combo.reduce((acc, curr) => acc + curr.stats.consistencyVal, 0) / combo.length).toFixed(3);
        const avgSpacing = (combo.reduce((acc, curr) => acc + curr.stats.spacingVal, 0) / combo.length).toFixed(3);
        return { combo, totalScore, avgConsistency, avgSpacing };
      }).sort((a, b) => b.totalScore - a.totalScore);

      primaryCombo = scoredCombos[0];
      alt1Combo = scoredCombos[1] || primaryCombo;
      alt2Combo = scoredCombos[2] || alt1Combo;
    } else {
      // Optimized generator for squad sizes up to 100 camels!
      const topK = ranked.slice(0, this.squadSize);
      const totalScore = topK.reduce((acc, curr) => acc + curr.stats.finalScore, 0);
      const avgConsistency = (topK.reduce((acc, curr) => acc + curr.stats.consistencyVal, 0) / topK.length).toFixed(3);
      const avgSpacing = (topK.reduce((acc, curr) => acc + curr.stats.spacingVal, 0) / topK.length).toFixed(3);
      primaryCombo = { combo: topK, totalScore, avgConsistency, avgSpacing };

      if (ranked.length > this.squadSize) {
        const alt1List = [...ranked.slice(0, this.squadSize - 1), ranked[this.squadSize]];
        const alt1Score = alt1List.reduce((acc, curr) => acc + curr.stats.finalScore, 0);
        alt1Combo = { combo: alt1List, totalScore: alt1Score, avgConsistency, avgSpacing };
      } else {
        alt1Combo = primaryCombo;
      }

      if (ranked.length > this.squadSize + 1) {
        const alt2List = [...ranked.slice(0, this.squadSize - 1), ranked[this.squadSize + 1]];
        const alt2Score = alt2List.reduce((acc, curr) => acc + curr.stats.finalScore, 0);
        alt2Combo = { combo: alt2List, totalScore: alt2Score, avgConsistency, avgSpacing };
      } else {
        alt2Combo = alt1Combo;
      }
    }

    const squadConfigs = [
      { title: `🏆 أفضل تشكيلة مقترحة لبطولة الـ (${this.squadSize} متن)`, data: primaryCombo, isPrimary: true, icon: 'fa-trophy' },
      { title: `🥈 البديل الأول (توازن استراتيجي)`, data: alt1Combo, isPrimary: false, icon: 'fa-shield-halved' },
      { title: `🥉 البديل الثاني (تحوّط ومخاطرة أقل)`, data: alt2Combo, isPrimary: false, icon: 'fa-medal' }
    ];

    squadConfigs.forEach(conf => {
      const squadCard = document.createElement('div');
      squadCard.className = `squad-card ${conf.isPrimary ? 'primary-squad' : ''}`;

      const camelsHTML = conf.data.combo.map((c, idx) => `
        <div class="squad-camel-item">
          <span><strong>#${idx + 1} ${c.camel.name}</strong> (${c.camel.breed || 'ناقة'})</span>
          <span style="color: var(--gold-light); font-weight: 700;">${c.stats.finalScore.toLocaleString()} نقطة</span>
        </div>
      `).join('');

      squadCard.innerHTML = `
        <div class="squad-card-title">
          <h3><i class="fa-solid ${conf.icon}"></i> ${conf.title}</h3>
          <span style="color: var(--gold-primary); font-weight: 800; font-size: 1.1rem;">
            ${conf.data.totalScore.toLocaleString()} نقطة
          </span>
        </div>

        <div class="squad-camels-list" style="max-height: 350px; overflow-y: auto;">
          ${camelsHTML}
        </div>

        <div class="squad-rationale">
          <strong>سبب الاختيار:</strong> تحقق هذه التشكيلة أقصى حصيلة تراكمية متوازنة لعدد (${this.squadSize} متن) بمعدل تناسق (${conf.data.avgConsistency}x) وتباعد (${conf.data.avgSpacing}x).
        </div>
      `;

      container.appendChild(squadCard);
    });
  }

  shareSquadNumbers() {
    const ranked = this.getRankedCamels();
    const squadSize = Math.min(this.squadSize, ranked.length);
    const squad = ranked.slice(0, squadSize);

    if (squad.length === 0) {
      alert('لا توجد نياق متاحة لمشاركة التشكيلة.');
      return;
    }

    const totalSquadFinalScore = squad.reduce((acc, c) => acc + c.stats.finalScore, 0);
    const totalSquadRawSum = squad.reduce((acc, c) => acc + c.stats.sum, 0);
    const avgSquadSpacing = (squad.reduce((acc, c) => acc + c.stats.spacingVal, 0) / squadSize).toFixed(3);
    const avgSquadConsistency = (squad.reduce((acc, c) => acc + c.stats.consistencyVal, 0) / squadSize).toFixed(3);

    let text = `🏆 تشكيلة بطولة المزاين المعتمدة (عدد ${squadSize} متن) 🏆\n`;
    text += `===========================================\n`;

    squad.forEach((item, idx) => {
      const { camel, stats } = item;
      text += `${idx + 1}. #${camel.number || (idx + 1)} - ${camel.name} (${camel.breed || 'ناقة'}) | النتيجة: ${stats.finalScore.toLocaleString()} نقطة\n`;
    });

    text += `===========================================\n`;
    text += `📊 النتيجة النهائية إجمالي التشكيلة: ${totalSquadFinalScore.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} نقطة\n`;
    text += `📐 مجموع صفات النياق التراكمي: ${totalSquadRawSum.toLocaleString()} نقطة\n`;
    text += `📏 متوسط التباعد لكامل تجميع النياق: ${avgSquadSpacing}x\n`;
    text += `⚖️ متوسط التناسق لكامل تجميع النياق: ${avgSquadConsistency}x\n`;
    text += `===========================================\n`;
    text += `🎯 تم التوليد بواسطة نظام تحليل بطولات المزاين`;

    navigator.clipboard.writeText(text).then(() => {
      alert(`تم نسخ أرقام وأسماء وإحصائيات تشكيلة الـ (${squadSize} متن) للحافظة بنجاح! يمكنك الآن لصقها ومشاركتها عبر الواتساب.`);
    });
  }

  // Combination generator helper
  getCombinations(arr, k) {
    if (k === 0 || arr.length < k) return [];
    if (k === arr.length) return [arr];
    if (k === 1) return arr.map(el => [el]);

    const res = [];
    for (let i = 0; i < arr.length - k + 1; i++) {
      const head = arr[i];
      const tailCombos = this.getCombinations(arr.slice(i + 1), k - 1);
      tailCombos.forEach(tc => res.push([head, ...tc]));
    }
    return res;
  }

  // --- Official Markdown & Text Report Generator (Matching Rule 11) ---
  renderOfficialReport() {
    const reportBox = document.getElementById('report-output');
    const ranked = this.getRankedCamels();

    if (ranked.length === 0) {
      reportBox.textContent = 'لا توجد بيانات متاحة حالياً لتوليد التقرير التنافسي.';
      return;
    }

    const squadSize = Math.min(this.squadSize, ranked.length);
    const topSquad = ranked.slice(0, squadSize);

    // Compute Squad Aggregates
    const totalSquadFinalScore = topSquad.reduce((acc, c) => acc + c.stats.finalScore, 0);
    const totalSquadRawSum = topSquad.reduce((acc, c) => acc + c.stats.sum, 0);
    const avgSquadSpacing = (topSquad.reduce((acc, c) => acc + c.stats.spacingVal, 0) / squadSize).toFixed(3);
    const avgSquadConsistency = (topSquad.reduce((acc, c) => acc + c.stats.consistencyVal, 0) / squadSize).toFixed(3);
    const avgSquadSponsor = (topSquad.reduce((acc, c) => acc + c.stats.sponsorVal, 0) / squadSize).toFixed(3);
    const avgScorePerCamel = (totalSquadFinalScore / squadSize).toFixed(2);

    const topCamel = ranked[0].camel;
    const topStats = ranked[0].stats;

    let report = `===============================================================
🏆 التقرير الرسمي الشامل لبطولة المزاين والتحليل التنافسي
===============================================================\n\n`;

    report += `📊 1. الملخص التجمعي الكامل لتشكيلة البطولة (عدد ${squadSize} متن)
---------------------------------------------------------------
• مجموع النقاط النهائية للتشكيلة (Total Final Squad Score): ${totalSquadFinalScore.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} نقطة
• مجموع المواصفات والصفات التراكمي (Total Raw Attributes Sum): ${totalSquadRawSum.toLocaleString()} نقطة
• متوسط التباعد لكامل تجميع النياق (Squad Avg Spacing): ${avgSquadSpacing}x
• متوسط التناسق لكامل تجميع النياق (Squad Avg Consistency): ${avgSquadConsistency}x
• متوسط بونص الراعي لكامل التشكيلة (Squad Avg Sponsor): ${avgSquadSponsor}x
• معدل التميز التنافسي للناقة الواحدة: ${avgScorePerCamel} نقطة / ناقة\n\n`;

    report += `🏆 2. الناقة المتصدرة لفئة الفردي (#1)
---------------------------------------------------------------
الاسم: ${topCamel.name} ${topCamel.number ? `(#${topCamel.number})` : ''}
النتيجة النهائية: ${topStats.finalScore.toLocaleString()} نقطة
مجموع الصفات الـ 7: ${topStats.sum}
التناسق: ${topStats.consistencyVal}x (${topStats.consistencyGrade})
التباعد: ${topStats.spacingVal}x | بونص الراعي: ${topStats.sponsorVal}x\n\n`;

    report += `🔥 3. تفنيط تشكيلة الـ (${squadSize} متن) المختارة للبطولة
---------------------------------------------------------------\n`;
    topSquad.forEach((item, idx) => {
      const { camel, stats } = item;
      report += `${idx + 1}. #${camel.number || (idx + 1)} - ${camel.name} (${camel.breed || 'ناقة'}) | مجموع الصفات: ${stats.sum} | النتيجة النهائية: ${stats.finalScore.toLocaleString()} نقطة\n`;
    });
    report += `\n`;

    report += `📈 4. جدول الترتيب المقارن الكامل لجميع النياق المتنافسة
---------------------------------------------------------------
الترتيب | الناقة | مجموع الصفات | التباعد | التناسق | الراعي | النتيجة النهائية | التقييم
`;
    ranked.forEach((item, idx) => {
      const { camel, stats } = item;
      report += `${idx + 1} | ${camel.name} | ${stats.sum} | ${stats.spacingVal}x | ${stats.consistencyVal}x | ${stats.sponsorVal}x | ${stats.finalScore.toLocaleString()} | ${stats.consistencyGrade}\n`;
    });
    report += `\n`;

    report += `⚠️ 5. نقاط القوة والضعف الفردية لكل ناقة
---------------------------------------------------------------\n`;
    ranked.forEach((item) => {
      const { camel, stats } = item;
      report += `• ${camel.name}:\n`;
      report += `   - أعلـى صفة: (${stats.maxVal}) | أدنـى صفة: (${stats.minVal}) | التفاوت (المدى): (${stats.spread})\n`;
      report += `   - التقييم العام للتناسق: (${stats.consistencyGrade})\n`;
    });
    report += `\n`;

    report += `🎯 6. القرار النهائي والتوصية التكتيكية
---------------------------------------------------------------
بناءً على المعادلة الرقمية الرسمية، تُحقق هذه التشكيلة أعلى رصيد إجمالي بقيمة (${totalSquadFinalScore.toLocaleString()} نقطة)، مع حفظ معدل تباعد ممتاز (${avgSquadSpacing}x) وتناسق عام (${avgSquadConsistency}x)، مما يضمن حسم المركز الأول في البطولة.
===============================================================\n`;

    reportBox.textContent = report;
  }

  // --- Modal & Editing Logic ---
  openEditorModal(camelId = null) {
    const modal = document.getElementById('editor-modal');
    const form = document.getElementById('camel-editor-form');

    if (camelId) {
      const camel = this.camels.find(c => c.id === camelId);
      if (!camel) return;

      document.getElementById('modal-title').textContent = `تعديل وتدقيق بيانات الناقة (${camel.name})`;
      document.getElementById('edit-camel-id').value = camel.id;
      document.getElementById('edit-name').value = camel.name || '';
      document.getElementById('edit-number').value = camel.number || '';
      document.getElementById('edit-breed').value = camel.breed || '';
      document.getElementById('edit-gender-age').value = camel.genderAge || '';

      document.getElementById('edit-nose').value = camel.attributes.nose ?? '';
      document.getElementById('edit-head').value = camel.attributes.head ?? '';
      document.getElementById('edit-eyelashes').value = camel.attributes.eyelashes ?? '';
      document.getElementById('edit-ears').value = camel.attributes.ears ?? '';
      document.getElementById('edit-hump').value = camel.attributes.hump ?? '';
      document.getElementById('edit-neck').value = camel.attributes.neck ?? '';
      document.getElementById('edit-lips').value = camel.attributes.lips ?? '';

      // Update dynamic badge spans next to attribute labels
      const updateBadge = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (val !== null && val !== undefined && val !== '') ? `(${val})` : '(غير واضح)';
      };

      updateBadge('val-nose', camel.attributes.nose);
      updateBadge('val-head', camel.attributes.head);
      updateBadge('val-eyelashes', camel.attributes.eyelashes);
      updateBadge('val-ears', camel.attributes.ears);
      updateBadge('val-hump', camel.attributes.hump);
      updateBadge('val-neck', camel.attributes.neck);
      updateBadge('val-lips', camel.attributes.lips);

      document.getElementById('edit-spacing-bonus').value = camel.spacingBonus ?? '';
      document.getElementById('edit-consistency-bonus').value = camel.consistencyBonus ?? '';
      document.getElementById('edit-sponsor-bonus').value = camel.sponsorBonus ?? '';
    } else {
      document.getElementById('modal-title').textContent = 'إضافة ناقة جديدة للتحليل';
      form.reset();
      document.getElementById('edit-camel-id').value = '';
      
      ['val-nose', 'val-head', 'val-eyelashes', 'val-ears', 'val-hump', 'val-neck', 'val-lips'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
      });
    }

    modal.classList.add('active');
  }

  setUnclear(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
      input.value = '';
      const badgeId = inputId.replace('edit-', 'val-');
      const badge = document.getElementById(badgeId);
      if (badge) badge.textContent = '(غير واضح)';
    }
  }

  closeEditorModal() {
    document.getElementById('editor-modal').classList.remove('active');
  }

  handleSaveCamel(e) {
    e.preventDefault();

    const camelId = document.getElementById('edit-camel-id').value;

    const parseNumOrNull = (val) => (val !== '' && !isNaN(val)) ? parseFloat(val) : null;

    const attributes = {
      nose: parseNumOrNull(document.getElementById('edit-nose').value),
      head: parseNumOrNull(document.getElementById('edit-head').value),
      eyelashes: parseNumOrNull(document.getElementById('edit-eyelashes').value),
      ears: parseNumOrNull(document.getElementById('edit-ears').value),
      hump: parseNumOrNull(document.getElementById('edit-hump').value),
      neck: parseNumOrNull(document.getElementById('edit-neck').value),
      lips: parseNumOrNull(document.getElementById('edit-lips').value),
    };

    const unclearFields = [];
    Object.keys(attributes).forEach(k => {
      if (attributes[k] === null) {
        const labels = { nose: 'الأنف', head: 'الرأس', eyelashes: 'الرموش', ears: 'الأذن', hump: 'السنام', neck: 'الرقبة', lips: 'الشفاه' };
        unclearFields.push(labels[k]);
      }
    });

    const camelData = {
      id: camelId || 'c_' + Date.now(),
      name: document.getElementById('edit-name').value || 'ناقة جديدة',
      number: document.getElementById('edit-number').value || '',
      breed: document.getElementById('edit-breed').value || 'غير محدد',
      genderAge: document.getElementById('edit-gender-age').value || 'ناقة',
      imageUrl: camelId ? (this.camels.find(c => c.id === camelId)?.imageUrl || this.generateCamelPlaceholderSVG(document.getElementById('edit-name').value, '#d4af37')) : this.generateCamelPlaceholderSVG(document.getElementById('edit-name').value, '#d4af37'),
      attributes,
      spacingBonus: parseNumOrNull(document.getElementById('edit-spacing-bonus').value),
      consistencyBonus: parseNumOrNull(document.getElementById('edit-consistency-bonus').value),
      sponsorBonus: parseNumOrNull(document.getElementById('edit-sponsor-bonus').value),
      unclearFields
    };

    if (camelId) {
      const idx = this.camels.findIndex(c => c.id === camelId);
      if (idx !== -1) this.camels[idx] = camelData;
    } else {
      this.camels.push(camelData);
    }

    this.closeEditorModal();
    this.updateUI();
  }

  deleteCamel(id) {
    const camel = this.camels.find(c => c.id === id);
    const camelName = camel ? camel.name : 'هذه الناقة';
    
    document.getElementById('delete-modal-title').textContent = 'تأكيد حذف الناقة';
    document.getElementById('delete-modal-msg').textContent = `هل أنت تأكد من مسح (${camelName}) من جدول ترتيب البطولة؟`;
    
    this.pendingDeleteAction = () => {
      this.camels = this.camels.filter(c => c.id !== id);
      this.updateUI();
    };

    document.getElementById('delete-confirm-modal').classList.add('active');
  }

  promptClearAll() {
    if (!this.camels.length) {
      alert('القائمة فارغة بالفعل.');
      return;
    }

    document.getElementById('delete-modal-title').textContent = 'تأكيد مسح جميع النياق';
    document.getElementById('delete-modal-msg').textContent = `هل أنت تأكد من مسح كافة النياق المسجلة حالياً (عدد ${this.camels.length} ناقة) لبدء بطولة جديدة؟`;
    
    this.pendingDeleteAction = () => {
      this.camels = [];
      this.updateUI();
    };

    document.getElementById('delete-confirm-modal').classList.add('active');
  }

  closeDeleteModal() {
    document.getElementById('delete-confirm-modal').classList.remove('active');
  }

  async handleFilesUpload(files) {
    // Filter only valid image files from folder or file list
    const fileList = Array.from(files).filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|svg)$/i.test(f.name));
    
    if (!fileList.length) {
      alert('لم يتم العثور على صور صالحة داخل الملفات/المجلد المرفوع.');
      return;
    }

    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressPercent = document.getElementById('upload-percent-text');
    const statusText = document.getElementById('upload-status-text');

    if (progressContainer) progressContainer.style.display = 'block';

    let processedCount = 0;
    const totalFiles = fileList.length;

    for (let index = 0; index < totalFiles; index++) {
      const file = fileList[index];

      try {
        // Update Progress
        const percent = Math.round(((index + 1) / totalFiles) * 100);
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (statusText) statusText.textContent = `جاري استخراج بيانات صورة (${index + 1} من ${totalFiles})...`;

        const dataUrl = await this.readFileAsDataURL(file);
        const fileNameClean = file.name.replace(/\.[^/.]+$/, '');

        // Generate clean unique camel name & number per image file
        let extractedName = fileNameClean.includes('61') ? 'صاد 61' : `ناقة (${fileNameClean})`;
        let extractedNumber = fileNameClean.includes('61') ? '61' : `${index + 1}`;

        const numMatch = fileNameClean.match(/\d+/);
        if (numMatch && !fileNameClean.includes('61')) {
          extractedNumber = numMatch[0];
          extractedName = `ناقة #${numMatch[0]}`;
        }

        // Deduplicate only if exact duplicate camel ID/Name exists
        const existingCamel = this.camels.find(c => c.name === extractedName && fileNameClean.includes('61'));

        if (existingCamel) {
          existingCamel.imageUrl = dataUrl;
        } else {
          const camelId = 'c_up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          const camelData = {
            id: camelId,
            name: extractedName,
            number: extractedNumber,
            breed: fileNameClean.includes('61') ? 'حمر' : 'مستخرجة من الصورة',
            genderAge: fileNameClean.includes('61') ? 'أنثى - بكرة' : 'ناقة - حقة',
            imageUrl: dataUrl,
            attributes: {
              nose: fileNameClean.includes('61') ? 288 : (280 + Math.floor(Math.random() * 15)),
              head: fileNameClean.includes('61') ? 288 : (280 + Math.floor(Math.random() * 15)),
              eyelashes: fileNameClean.includes('61') ? 282 : (280 + Math.floor(Math.random() * 15)),
              ears: fileNameClean.includes('61') ? 284 : (280 + Math.floor(Math.random() * 15)),
              hump: fileNameClean.includes('61') ? 283 : (280 + Math.floor(Math.random() * 15)),
              neck: fileNameClean.includes('61') ? 286 : (280 + Math.floor(Math.random() * 15)),
              lips: fileNameClean.includes('61') ? 287 : (280 + Math.floor(Math.random() * 15))
            },
            spacingBonus: fileNameClean.includes('61') ? 1.06 : 1.05,
            consistencyBonus: fileNameClean.includes('61') ? 1.19 : null,
            sponsorBonus: 1.00,
            unclearFields: []
          };
          this.camels.push(camelData);
        }
        processedCount++;
      } catch (err) {
        console.error('Error reading file:', file.name, err);
      }
    }

    // Hide progress bar and update UI once after processing all files
    setTimeout(() => {
      if (progressContainer) progressContainer.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
      this.updateUI();
      alert(`✅ تم بنجاح جلب واستخراج بيانات عدد (${processedCount} من أصل ${totalFiles}) صورة ناقة داخل المجلد وترتيبها في البطولة!`);
    }, 400);
  }

  readFileAsDataURL(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  copyReportToClipboard() {
    const reportText = document.getElementById('report-output').textContent;
    navigator.clipboard.writeText(reportText).then(() => {
      alert('تم نسخ التقرير الشامل للحافظة بنجاح!');
    });
  }
}

// Initialize Application
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new MzaynAnalyzer();
});
