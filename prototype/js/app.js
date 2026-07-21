/**
 * 撮るほど インタラクティブ・プロトタイプ
 * ハッシュルーティング + localStorage 状態
 *
 * localStorage キー:
 *   toruhodo.records  — Record[]
 *   toruhodo.settings — { furiganaDefault, modeDefault, geoEnabled }
 *   toruhodo.seeded   — 初回シード済みフラグ
 */

(() => {
  'use strict';

  // ─── State ───
  const state = {
    route: 'home',
    routeParam: null,
    settings: loadSettings(),
    records: loadRecords(),
    // scan flow
    scanPhase: 'idle', // idle | capturing | ocr | generating
    capturePhoto: null, // data URL or null
    forceOutcome: null, // null | 'success' | 'partial' | 'failed'
    // result local
    result: null,
    resultMode: 'easy',
    resultFurigana: true,
    resultSaved: false,
    // camera
    cameraStream: null,
    flashOn: false,
    // map
    mapInstance: null,
    mapPopupId: null,
    // timers
    loadTimers: [],
  };

  const appEl = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const lightboxEl = document.getElementById('lightbox');

  // ─── Routing ───
  const ROUTES = {
    home: { tab: 'home', render: renderHome },
    scan: { tab: null, render: renderScan },
    result: { tab: null, render: renderResult },
    failed: { tab: null, render: renderFailed },
    history: { tab: 'history', render: renderHistory },
    map: { tab: 'map', render: renderMap },
    settings: { tab: 'settings', render: renderSettings },
  };

  function navigate(route, param) {
    if (route !== 'scan') stopCamera();
    clearLoadTimers();
    state.route = route;
    state.routeParam = param ?? null;
    const hash = param ? `#${route}/${param}` : `#${route}`;
    if (location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
    render();
  }

  function parseHash() {
    const h = (location.hash || '#home').replace(/^#/, '');
    const [route, param] = h.split('/');
    if (ROUTES[route]) {
      state.route = route;
      state.routeParam = param || null;
    } else {
      state.route = 'home';
      state.routeParam = null;
    }
  }

  window.addEventListener('hashchange', () => {
    parseHash();
    render();
  });

  // ─── Render shell ───
  function render() {
    const conf = ROUTES[state.route] || ROUTES.home;
    conf.render();
    renderTabBar(conf.tab);
  }

  function setScreen(html) {
    // Keep tab bar and overlays outside screen content
    let screen = document.getElementById('screen-root');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-root';
      screen.className = 'screen active';
      appEl.insertBefore(screen, appEl.firstChild);
    }
    screen.innerHTML = html;
    screen.className = 'screen active' + (state.route === 'scan' ? ' screen-scan' : '');
    bindScreenEvents();
  }

  function renderTabBar(activeTab) {
    let bar = document.getElementById('tab-bar');
    if (!activeTab) {
      if (bar) bar.style.display = 'none';
      return;
    }
    if (!bar) {
      bar = document.createElement('nav');
      bar.id = 'tab-bar';
      bar.className = 'tab-bar';
      bar.innerHTML = `
        <div class="tab-bar-inner">
          <button type="button" class="tab-item" data-tab="home"><span class="ms">home</span><span class="label">ホーム</span></button>
          <button type="button" class="tab-item" data-tab="history"><span class="ms">menu_book</span><span class="label">履歴</span></button>
          <button type="button" class="tab-item" data-tab="map"><span class="ms">map</span><span class="label">地図</span></button>
          <button type="button" class="tab-item" data-tab="settings"><span class="ms">settings</span><span class="label">設定</span></button>
        </div>`;
      bar.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (btn) navigate(btn.dataset.tab);
      });
      appEl.appendChild(bar);
    }
    bar.style.display = '';
    bar.querySelectorAll('.tab-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.tab === activeTab);
    });
  }

  // ─── Icons helper ───
  const icon = (name, cls = '') =>
    `<span class="ms ${cls}" aria-hidden="true">${name}</span>`;

  // ─── Record card HTML ───
  function recordCardHtml(rec, index) {
    const date = formatDateJa(rec.createdAt);
    const place = rec.placeName || '';
    const meta = place ? `${date}・${place}` : date;
    const memo = rec.memo && rec.memo.trim()
      ? `<div class="memo-badge">${icon('edit_note')}メモあり</div>`
      : '';
    const bg = rec.photoDataUrl
      ? `background-image:url(${rec.photoDataUrl});background-size:cover`
      : thumbStyle(index);
    return `
      <button type="button" class="record-card" data-record-id="${rec.id}">
        <div class="record-thumb" style="${bg}"></div>
        <div class="record-body">
          <div class="record-title">${escapeHtml(rec.title)}</div>
          <div class="record-meta">${escapeHtml(meta)}</div>
          ${memo}
        </div>
        ${icon('chevron_right', 'record-chevron')}
      </button>`;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── 1b Home ───
  function renderHome() {
    state.records = loadRecords();
    const recent = [...state.records]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    const list = recent.length
      ? recent.map((r, i) => recordCardHtml(r, i)).join('')
      : `<p style="padding:8px 4px;font-size:14px;color:var(--color-muted);line-height:1.8">まだ記録がありません。「かざして解説」から始めてみましょう。</p>`;

    setScreen(`
      <div class="screen-scroll has-tab">
        <header class="app-header">
          <div class="logo-mark"><span>撮</span></div>
          <span class="logo-word">撮るほど</span>
        </header>
        <button type="button" class="cta-scan" id="btn-scan">
          <div class="cta-scan-icon">${icon('photo_camera', 'fill')}</div>
          <div class="cta-scan-title">かざして解説</div>
          <div class="cta-scan-sub">石碑や案内板にカメラを向けるだけ</div>
        </button>
        <div class="section-head">
          <h2>さいきんの記録</h2>
          <button type="button" class="link-all" id="btn-see-all">すべて見る</button>
        </div>
        <div class="record-list">${list}</div>
      </div>`);
  }

  // ─── 1c / 1d Scan ───
  function renderScan() {
    const loading = state.scanPhase === 'ocr' || state.scanPhase === 'generating';
    const ocrDone = state.scanPhase === 'generating';

    setScreen(`
      <div class="scan-view" id="scan-view">
        <video id="camera-video" autoplay playsinline muted style="display:none"></video>
        <div class="scan-placeholder-label" id="scan-placeholder">カメラ映像（ライブ）</div>
        <button type="button" class="scan-close" id="btn-scan-close" aria-label="閉じる">${icon('close')}</button>
        <div class="scan-hint">${icon('lightbulb')}文字がはっきり写るように撮ってね</div>
        <div class="scan-guide">
          <div class="scan-corner tl"></div>
          <div class="scan-corner tr"></div>
          <div class="scan-corner bl"></div>
          <div class="scan-corner br"></div>
          <div class="scan-guide-label">石碑や案内板を、枠のなかに</div>
        </div>
        <div class="scan-demo-hint">タップ＝通常 / 長押し＝部分 / ダブルタップ＝失敗</div>
        <div class="scan-overlay ${loading ? 'visible' : ''}" id="scan-overlay"></div>
      </div>
      <div class="scan-controls" id="scan-controls" style="${loading ? 'display:none' : ''}">
        <button type="button" class="scan-side-btn" id="btn-gallery" aria-label="ギャラリー">${icon('photo_library')}</button>
        <button type="button" class="shutter" id="btn-shutter" aria-label="シャッター"><div class="shutter-inner"></div></button>
        <button type="button" class="scan-side-btn ${state.flashOn ? 'active' : ''}" id="btn-flash" aria-label="フラッシュ">${icon('bolt')}</button>
      </div>
      <div class="loading-sheet ${loading ? 'visible' : ''}" id="loading-sheet">
        <div class="sheet-handle"></div>
        <div class="loading-step" id="step-ocr">
          ${
            ocrDone
              ? `${icon('check_circle', 'fill')}<div class="done-label">読み取りました</div>`
              : `<div class="spinner"></div><div><div class="step-title">読み取っています…</div></div>`
          }
        </div>
        <div class="loading-step" id="step-gen" style="${ocrDone ? '' : 'opacity:.45'}">
          ${
            ocrDone
              ? `<div class="spinner"></div><div><div class="step-title">解説を作っています…</div><div class="step-sub">やさしい言葉に言いかえています</div></div>`
              : `<div style="width:26px"></div><div><div class="step-title" style="font-size:15px;font-weight:500;color:var(--color-muted)">解説を作っています…</div></div>`
          }
        </div>
        <div class="loading-wait">そのまま少しだけお待ちください</div>
        <button type="button" class="loading-cancel" id="btn-cancel-load">キャンセル</button>
      </div>
      <input type="file" accept="image/*" class="hidden-file" id="file-input" />`);

    if (state.scanPhase === 'idle' || state.scanPhase === 'capturing') {
      startCamera();
    } else if (state.capturePhoto) {
      showCapturedPhoto(state.capturePhoto);
    }
  }

  function showCapturedPhoto(dataUrl) {
    const view = document.getElementById('scan-view');
    if (!view) return;
    const video = document.getElementById('camera-video');
    if (video) video.style.display = 'none';
    const ph = document.getElementById('scan-placeholder');
    if (ph) {
      ph.textContent = '撮影した写真';
      ph.style.display = 'flex';
    }
    view.style.backgroundImage = dataUrl ? `url(${dataUrl})` : '';
    view.style.backgroundSize = 'cover';
    view.style.backgroundPosition = 'center';
  }

  async function startCamera() {
    stopCamera();
    const video = document.getElementById('camera-video');
    const ph = document.getElementById('scan-placeholder');
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      state.cameraStream = stream;
      video.srcObject = stream;
      video.style.display = 'block';
      if (ph) ph.style.display = 'none';
      state.scanPhase = 'capturing';
    } catch {
      if (ph) {
        ph.textContent = 'カメラ映像（プレースホルダー）';
        ph.style.display = 'flex';
      }
      state.scanPhase = 'capturing';
    }
  }

  function stopCamera() {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((t) => t.stop());
      state.cameraStream = null;
    }
  }

  function captureFrame() {
    const video = document.getElementById('camera-video');
    if (video && video.style.display !== 'none' && video.videoWidth) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.85);
    }
    return null;
  }

  function clearLoadTimers() {
    state.loadTimers.forEach(clearTimeout);
    state.loadTimers = [];
  }

  function beginLoading(outcome) {
    // outcome: 'success' | 'partial' | 'failed'
    stopCamera();
    state.forceOutcome = outcome;
    state.capturePhoto = captureFrame();
    state.scanPhase = 'ocr';
    renderScan();

    // Stage 1: OCR ~1.4s → Stage 2: generating ~1.6s → result
    const t1 = setTimeout(() => {
      state.scanPhase = 'generating';
      renderScan();
      if (state.capturePhoto) showCapturedPhoto(state.capturePhoto);
    }, 1400);
    const t2 = setTimeout(() => {
      finishScan(outcome);
    }, 3000);
    state.loadTimers = [t1, t2];
  }

  function finishScan(outcome) {
    clearLoadTimers();
    state.scanPhase = 'idle';
    const settings = loadSettings();
    state.resultMode = settings.modeDefault;
    state.resultFurigana = settings.furiganaDefault;
    state.resultSaved = false;

    if (outcome === 'failed') {
      navigate('failed');
      return;
    }

    const mock = outcome === 'partial' ? MOCK_PARTIAL : MOCK_SUCCESS;
    const now = new Date().toISOString();
    const geo = settings.geoEnabled;

    state.result = {
      id: uid(),
      title: mock.title,
      placeName: geo && mock.placeName ? mock.placeName : null,
      lat: geo && mock.lat != null ? mock.lat : null,
      lng: geo && mock.lng != null ? mock.lng : null,
      easyText: mock.easyText,
      easyRuby: mock.easyRuby,
      detailText: mock.detailText,
      detailRuby: mock.detailRuby,
      aiNote: mock.aiNote,
      aiNoteRuby: mock.aiNoteRuby,
      aiNoteDetail: mock.aiNoteDetail || mock.aiNote,
      aiNoteDetailRuby: mock.aiNoteDetailRuby || mock.aiNoteRuby,
      ocrRaw: mock.ocrRaw,
      partial: !!mock.partial,
      partialChars: mock.partialChars,
      memo: '',
      photoLabel: mock.photoLabel,
      photoDataUrl: state.capturePhoto,
      createdAt: now,
    };
    navigate('result', state.result.id);
  }

  function cancelLoading() {
    clearLoadTimers();
    state.scanPhase = 'idle';
    state.capturePhoto = null;
    renderScan();
  }

  // ─── Result 1e/1f/1g/1i ───
  function openResultById(id) {
    // Prefer current scan result, else load from records
    if (state.result && state.result.id === id) {
      navigate('result', id);
      return;
    }
    const rec = loadRecords().find((r) => r.id === id);
    if (!rec) {
      showToast('記録が見つかりません');
      navigate('history');
      return;
    }
    const settings = loadSettings();
    state.result = { ...rec };
    state.resultMode = settings.modeDefault;
    state.resultFurigana = settings.furiganaDefault;
    state.resultSaved = true;
    navigate('result', id);
  }

  function renderResult() {
    const r = state.result;
    if (!r) {
      navigate('home');
      return;
    }
    const mode = state.resultMode;
    const furi = state.resultFurigana;
    const isPartial = r.partial;

    const mainHtml = furi
      ? mode === 'easy'
        ? r.easyRuby
        : r.detailRuby
      : mode === 'easy'
        ? escapeHtml(r.easyText)
        : escapeHtml(r.detailText);

    const aiHtml = furi
      ? mode === 'easy'
        ? r.aiNoteRuby
        : r.aiNoteDetailRuby || r.aiNoteRuby
      : mode === 'easy'
        ? escapeHtml(r.aiNote)
        : escapeHtml(r.aiNoteDetail || r.aiNote);

    const washiHint = mode === 'easy' ? 'やさしく言いかえ' : '原文にそった説明';
    const metaDate = formatDateTimeJa(r.createdAt);
    let metaPlace = '';
    if (r.placeName) {
      metaPlace = `・${icon('location_on')}${escapeHtml(r.placeName)}`;
    } else if (isPartial || r.lat == null) {
      metaPlace = '・場所は記録されていません';
    }

    const photoBg = r.photoDataUrl
      ? `background-image:url(${r.photoDataUrl});background-size:cover`
      : '';

    const partialBanner = isPartial
      ? `<div class="partial-banner">${icon('info')}<span>一部だけ読み取れました。読み取れた部分だけ解説しています。</span></div>`
      : '';

    const partialChip = isPartial && r.partialChars
      ? `<div class="partial-chip">読めた文字：${escapeHtml(r.partialChars)}</div>`
      : '';

    const saveBtn = isPartial && !state.resultSaved
      ? `<div class="result-actions">
           <button type="button" class="btn-primary outline" id="btn-retry">${icon('photo_camera')}もう一度撮る</button>
           <button type="button" class="btn-primary" id="btn-save">${icon('bookmark_add')}このまま記録に残す</button>
         </div>`
      : `<button type="button" class="btn-primary ${state.resultSaved ? 'saved' : ''}" id="btn-save">
           ${icon(state.resultSaved ? 'bookmark' : 'bookmark_add', state.resultSaved ? 'fill' : '')}
           ${state.resultSaved ? '記録済み' : '記録に残す'}
         </button>`;

    const modeControls = isPartial
      ? ''
      : `<div class="controls-row">
          <div class="segment" id="mode-seg">
            <button type="button" class="segment-btn ${mode === 'easy' ? 'active' : ''}" data-mode="easy">やさしい</button>
            <button type="button" class="segment-btn ${mode === 'detail' ? 'active' : ''}" data-mode="detail">くわしい</button>
          </div>
          <div class="furigana-toggle">
            <span class="furi-label ${furi ? '' : 'off'}">ふりがな</span>
            <button type="button" class="toggle-switch ${furi ? 'on' : ''}" id="btn-furi" aria-label="ふりがな" aria-pressed="${furi}">
              <span class="toggle-knob"></span>
            </button>
          </div>
        </div>`;

    setScreen(`
      <div class="nav-bar">
        <button type="button" class="nav-icon-btn" id="btn-back" aria-label="戻る">${icon('arrow_back_ios_new')}</button>
        <div class="nav-title">解説</div>
        <div style="width:40px"></div>
      </div>
      <div class="screen-scroll">
        <div class="result-body ${furi ? 'ruby-on' : 'ruby-off'}">
          ${partialBanner}
          <div class="result-photo" id="result-photo" style="${photoBg}">
            ${r.photoDataUrl ? '' : `<span class="result-photo-label">${escapeHtml(r.photoLabel || '写真')}</span>`}
            <div class="zoom-pill">${icon('zoom_in')}タップで拡大</div>
          </div>
          <div>
            <div class="result-title">${escapeHtml(r.title)}</div>
            <div class="result-meta">${escapeHtml(metaDate)}${metaPlace}</div>
          </div>
          ${modeControls}
          <div class="washi-card">
            <div class="card-header">
              ${icon('menu_book', 'fill')}
              <span class="card-label">ここに書かれていること</span>
              ${isPartial ? '' : `<span class="card-hint">${washiHint}</span>`}
            </div>
            ${partialChip}
            <div class="washi-body ${furi ? 'ruby-on' : ''} ${furi ? '' : 'ruby-off'}" id="washi-body">${mainHtml}</div>
          </div>
          <div class="ai-card">
            <div class="card-header">
              ${icon('auto_awesome', 'fill')}
              <span class="card-label">AIによる補足</span>
              ${isPartial ? '' : `<span class="card-hint">背景知識のおぎない</span>`}
            </div>
            <div class="ai-body ${furi ? 'ruby-on' : ''} ${furi ? '' : 'ruby-off'}" id="ai-body">${aiHtml}</div>
          </div>
          <div>
            <div class="memo-section-label">じぶんのメモ</div>
            <div class="memo-field">
              ${icon('edit_note')}
              <textarea id="memo-input" rows="2" placeholder="気づいたことをメモしておけます（例：子どもと来た。榎はどれ？）">${escapeHtml(r.memo || '')}</textarea>
            </div>
          </div>
          ${saveBtn}
          <div class="disclaimer">AIによる解説です。正確な情報は現地の案内をご確認ください。</div>
        </div>
      </div>`);
  }

  function updateResultTexts() {
    const r = state.result;
    if (!r) return;
    const mode = state.resultMode;
    const furi = state.resultFurigana;
    const washi = document.getElementById('washi-body');
    const ai = document.getElementById('ai-body');
    if (!washi || !ai) return;

    washi.classList.add('fading');
    ai.classList.add('fading');

    setTimeout(() => {
      if (furi) {
        washi.innerHTML = mode === 'easy' ? r.easyRuby : r.detailRuby;
        ai.innerHTML = mode === 'easy' ? r.aiNoteRuby : r.aiNoteDetailRuby || r.aiNoteRuby;
        washi.classList.add('ruby-on');
        washi.classList.remove('ruby-off');
        ai.classList.add('ruby-on');
        ai.classList.remove('ruby-off');
      } else {
        washi.textContent = mode === 'easy' ? r.easyText : r.detailText;
        ai.textContent = mode === 'easy' ? r.aiNote : r.aiNoteDetail || r.aiNote;
        washi.classList.add('ruby-off');
        washi.classList.remove('ruby-on');
        ai.classList.add('ruby-off');
        ai.classList.remove('ruby-on');
      }
      washi.classList.remove('fading');
      ai.classList.remove('fading');
    }, 120);

    // Update segment / toggle UI without full re-render when possible
    document.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    const furiBtn = document.getElementById('btn-furi');
    if (furiBtn) {
      furiBtn.classList.toggle('on', furi);
      furiBtn.setAttribute('aria-pressed', String(furi));
    }
    const furiLabel = document.querySelector('.furi-label');
    if (furiLabel) furiLabel.classList.toggle('off', !furi);
    const hint = document.querySelector('.washi-card .card-hint');
    if (hint) hint.textContent = mode === 'easy' ? 'やさしく言いかえ' : '原文にそった説明';
  }

  function saveCurrentResult() {
    if (!state.result) return;
    const memoEl = document.getElementById('memo-input');
    if (memoEl) state.result.memo = memoEl.value;

    state.records = loadRecords();
    const idx = state.records.findIndex((r) => r.id === state.result.id);
    const toSave = { ...state.result };
    if (idx >= 0) {
      state.records[idx] = toSave;
    } else {
      state.records.unshift(toSave);
    }
    saveRecords(state.records);
    state.resultSaved = true;
    showToast('旅の記録に残しました');
    // Update button
    const btn = document.getElementById('btn-save');
    if (btn && !btn.classList.contains('outline')) {
      btn.classList.add('saved');
      btn.innerHTML = `${icon('bookmark', 'fill')}記録済み`;
    } else {
      renderResult();
    }
  }

  // ─── Failed 1h ───
  function renderFailed() {
    setScreen(`
      <div class="nav-bar">
        <button type="button" class="nav-icon-btn" id="btn-back" aria-label="閉じる">${icon('close')}</button>
        <div class="nav-title">解説</div>
        <div style="width:40px"></div>
      </div>
      <div class="failed-body">
        <div class="failed-icon">${icon('no_photography')}</div>
        <div class="failed-title">うまく読み取れませんでした</div>
        <div class="failed-desc">文字が小さかったり、影に入っていたりすると、読み取りがむずかしいことがあります。だいじょうぶ、もう一度ためしてみましょう。</div>
        <div class="tips-card">
          <h3>うまく撮るコツ</h3>
          <div class="tips-list">
            <div class="tip-row"><div class="tip-icon">${icon('zoom_in')}</div><span>文字に近づいて、大きく写す</span></div>
            <div class="tip-row"><div class="tip-icon">${icon('light_mode')}</div><span>影や反射をさけて、明るいところで</span></div>
            <div class="tip-row"><div class="tip-icon">${icon('center_focus_strong')}</div><span>正面から、まっすぐ撮る</span></div>
          </div>
        </div>
        <div class="failed-actions">
          <button type="button" class="btn-primary" id="btn-retry">${icon('photo_camera')}もう一度撮る</button>
          <button type="button" class="link-muted" id="btn-home">ホームにもどる</button>
        </div>
      </div>`);
  }

  // ─── History 1j / 1k ───
  function renderHistory() {
    state.records = loadRecords();
    const sorted = [...state.records].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (!sorted.length) {
      setScreen(`
        <div class="screen-scroll has-tab" style="display:flex;flex-direction:column">
          <div class="page-title-block">
            <div class="page-title">旅の記録</div>
          </div>
          <div class="empty-state">
            <div class="empty-icon">${icon('auto_stories')}</div>
            <div class="empty-title">まだ記録がありません</div>
            <div class="empty-desc">散歩に出かけて、最初の一枚を撮ってみませんか。石碑や案内板が、きっと何かを教えてくれます。</div>
            <button type="button" class="btn-primary inline" id="btn-scan">${icon('photo_camera')}かざして解説をはじめる</button>
          </div>
        </div>`);
      return;
    }

    setScreen(`
      <div class="screen-scroll has-tab">
        <div class="page-title-block">
          <div class="page-title">旅の記録</div>
          <div class="page-sub">あるいた分だけ、たまっていきます — ${sorted.length}件</div>
        </div>
        <div class="record-list" style="padding-top:12px">
          ${sorted.map((r, i) => recordCardHtml(r, i)).join('')}
        </div>
      </div>`);
  }

  // ─── Map 1l ───
  function renderMap() {
    state.records = loadRecords();
    const withGeo = state.records.filter((r) => r.lat != null && r.lng != null);
    const settings = loadSettings();
    const month = new Date().getMonth() + 1;

    setScreen(`
      <div class="screen-scroll has-tab" style="display:flex;flex-direction:column;padding-bottom:0">
        <div class="page-title-row" style="flex:none">
          <div class="page-title">旅の記録地図</div>
          <span class="count-chip">${month}月・${withGeo.length}件</span>
        </div>
        <div class="map-container" id="map-container" style="margin-bottom:calc(var(--tab-height) + env(safe-area-inset-bottom,0px))">
          ${!settings.geoEnabled || withGeo.length === 0 ? '' : ''}
          <div class="map-geo-note" id="map-geo-note" style="${settings.geoEnabled && withGeo.length ? '' : ''}">
            ${
              !settings.geoEnabled
                ? '位置情報がオフでも、記録は残せます'
                : withGeo.length === 0
                  ? '位置つきの記録がまだありません'
                  : '位置情報がオフでも、記録は残せます'
            }
          </div>
        </div>
      </div>`);

    // Defer map init so container has size
    requestAnimationFrame(() => initMap(withGeo));
  }

  function initMap(records) {
    const container = document.getElementById('map-container');
    if (!container) return;

    // Destroy previous
    if (state.mapInstance) {
      try {
        state.mapInstance.remove();
      } catch {
        /* ignore */
      }
      state.mapInstance = null;
    }

    const hasMapLibre = typeof maplibregl !== 'undefined';

    if (hasMapLibre && records.length) {
      try {
        const map = new maplibregl.Map({
          container: 'map-container',
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap',
              },
            },
            layers: [
              {
                id: 'osm',
                type: 'raster',
                source: 'osm',
                paint: {
                  'raster-saturation': -0.35,
                  'raster-opacity': 0.9,
                },
              },
            ],
          },
          center: [records[0].lng, records[0].lat],
          zoom: 9.5,
          attributionControl: true,
        });
        state.mapInstance = map;

        records.forEach((rec, i) => {
          const el = document.createElement('div');
          el.className = 'map-pin' + (i === 0 ? ' large' : '');
          el.textContent = 'location_on';
          el.title = rec.title;
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            showMapPopup(rec, el);
          });
          new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([rec.lng, rec.lat])
            .addTo(map);
        });

        if (records.length > 1) {
          const bounds = new maplibregl.LngLatBounds();
          records.forEach((r) => bounds.extend([r.lng, r.lat]));
          map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
        }

        // Re-append geo note on top
        ensureMapNote(container);
        return;
      } catch (err) {
        console.warn('MapLibre init failed, using fallback', err);
      }
    }

    // Static fallback map
    renderFallbackMap(container, records);
  }

  function ensureMapNote(container) {
    if (!document.getElementById('map-geo-note')) {
      const note = document.createElement('div');
      note.className = 'map-geo-note';
      note.id = 'map-geo-note';
      note.textContent = '位置情報がオフでも、記録は残せます';
      container.appendChild(note);
    }
  }

  function renderFallbackMap(container, records) {
    const positions = [
      { left: '42%', top: '38%' },
      { left: '18%', top: '58%' },
      { left: '68%', top: '70%' },
      { left: '82%', top: '36%' },
      { left: '50%', top: '55%' },
      { left: '30%', top: '45%' },
    ];

    container.innerHTML = `
      <div class="map-fallback">
        <svg viewBox="0 0 375 560" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%">
          <rect width="375" height="560" fill="#EDE6D3"/>
          <ellipse cx="86" cy="130" rx="78" ry="50" fill="#DFE3C6"></ellipse>
          <path d="M 250 580 C 268 470 330 430 390 418" fill="none" stroke="#C9D8DE" stroke-width="30" stroke-linecap="round"></path>
          <path d="M -10 420 C 90 380 150 300 192 212 C 224 142 300 92 390 72" fill="none" stroke="#FBF7EC" stroke-width="22" stroke-linecap="round"></path>
          <path d="M -10 252 C 80 262 190 302 390 262" fill="none" stroke="#FBF7EC" stroke-width="13" stroke-linecap="round"></path>
        </svg>
        <div id="fallback-pins"></div>
        <div class="map-geo-note">位置情報がオフでも、記録は残せます</div>
      </div>`;

    const pinsEl = container.querySelector('#fallback-pins');
    if (!records.length) {
      // still show design pins as decoration if no records? show empty note only
      return;
    }

    records.slice(0, 6).forEach((rec, i) => {
      const pos = positions[i % positions.length];
      const pin = document.createElement('span');
      pin.className = 'map-pin' + (i === 0 ? ' large' : '');
      pin.textContent = 'location_on';
      pin.style.left = pos.left;
      pin.style.top = pos.top;
      pin.addEventListener('click', () => {
        // remove old popup
        const old = container.querySelector('.map-popup');
        if (old) old.remove();
        const popup = document.createElement('button');
        popup.type = 'button';
        popup.className = 'map-popup';
        popup.style.left = pos.left;
        popup.style.top = `calc(${pos.top} - 72px)`;
        popup.innerHTML = `
          <div class="map-popup-thumb"></div>
          <div style="flex:1;min-width:0;text-align:left">
            <div class="map-popup-title">${escapeHtml(rec.title)}</div>
            <div class="map-popup-meta">${escapeHtml(formatDateJa(rec.createdAt))}${rec.placeName ? '・' + escapeHtml(rec.placeName.replace(/^神奈川県/, '')) : ''}</div>
          </div>
          ${icon('chevron_right', 'record-chevron')}`;
        popup.addEventListener('click', () => openResultById(rec.id));
        container.querySelector('.map-fallback').appendChild(popup);
      });
      pinsEl.appendChild(pin);

      // Auto-show first popup
      if (i === 0) {
        setTimeout(() => pin.click(), 100);
      }
    });
  }

  function showMapPopup(rec, markerEl) {
    // Simple toast-style open for MapLibre
    openResultById(rec.id);
  }

  // ─── Settings ───
  function renderSettings() {
    state.settings = loadSettings();
    const s = state.settings;

    setScreen(`
      <div class="screen-scroll has-tab">
        <div class="page-title-block">
          <div class="page-title">設定</div>
        </div>
        <div class="settings-list">
          <div class="settings-group-title">表示の初期値</div>
          <div class="settings-group">
            <div class="settings-row">
              <div style="flex:1">
                <div class="settings-row-label">ふりがな</div>
                <div class="settings-row-desc">解説画面を開いたときの初期状態</div>
              </div>
              <button type="button" class="toggle-switch ${s.furiganaDefault ? 'on' : ''}" id="set-furi" aria-label="ふりがな初期値">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="settings-row">
              <div style="flex:1">
                <div class="settings-row-label">解説モード</div>
                <div class="settings-row-desc">やさしい / くわしい</div>
              </div>
              <div class="settings-seg" id="set-mode">
                <button type="button" data-mode="easy" class="${s.modeDefault === 'easy' ? 'active' : ''}">やさしい</button>
                <button type="button" data-mode="detail" class="${s.modeDefault === 'detail' ? 'active' : ''}">くわしい</button>
              </div>
            </div>
          </div>

          <div class="settings-group-title">プライバシー</div>
          <div class="settings-group">
            <div class="settings-row">
              <div style="flex:1">
                <div class="settings-row-label">位置情報を記録する</div>
                <div class="settings-row-desc">オフでも記録自体は残せます</div>
              </div>
              <button type="button" class="toggle-switch ${s.geoEnabled ? 'on' : ''}" id="set-geo" aria-label="位置情報">
                <span class="toggle-knob"></span>
              </button>
            </div>
          </div>

          <div class="settings-group-title">データ</div>
          <div class="settings-group">
            <button type="button" class="settings-row" id="btn-clear-data">
              <div class="settings-row-label settings-danger">すべての記録を削除</div>
            </button>
          </div>

          <div class="settings-group-title">その他</div>
          <div class="settings-group">
            <button type="button" class="settings-row" id="btn-disclaimer">
              <div class="settings-row-label">免責・利用について</div>
              ${icon('chevron_right', 'record-chevron')}
            </button>
          </div>

          <div class="settings-footer">
            撮るほど プロトタイプ<br>
            AIによる解説です。正確な情報は現地の案内をご確認ください。
          </div>
        </div>
      </div>`);
  }

  // ─── Events ───
  function bindScreenEvents() {
    const root = document.getElementById('screen-root');
    if (!root) return;

    // Home / generic
    root.querySelector('#btn-scan')?.addEventListener('click', () => {
      state.scanPhase = 'idle';
      state.capturePhoto = null;
      navigate('scan');
    });
    root.querySelector('#btn-see-all')?.addEventListener('click', () => navigate('history'));
    root.querySelector('#btn-home')?.addEventListener('click', () => navigate('home'));
    root.querySelector('#btn-back')?.addEventListener('click', () => {
      if (state.route === 'result' || state.route === 'failed') {
        navigate('home');
      } else {
        history.back();
      }
    });
    root.querySelector('#btn-retry')?.addEventListener('click', () => {
      state.scanPhase = 'idle';
      state.capturePhoto = null;
      navigate('scan');
    });

    // Record cards
    root.querySelectorAll('[data-record-id]').forEach((el) => {
      el.addEventListener('click', () => openResultById(el.dataset.recordId));
    });

    // Scan
    root.querySelector('#btn-scan-close')?.addEventListener('click', () => {
      clearLoadTimers();
      state.scanPhase = 'idle';
      stopCamera();
      navigate('home');
    });
    root.querySelector('#btn-cancel-load')?.addEventListener('click', cancelLoading);
    root.querySelector('#btn-flash')?.addEventListener('click', (e) => {
      state.flashOn = !state.flashOn;
      e.currentTarget.classList.toggle('active', state.flashOn);
      // torch if available
      const track = state.cameraStream?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      if (caps?.torch) {
        track.applyConstraints({ advanced: [{ torch: state.flashOn }] }).catch(() => {});
      }
    });
    root.querySelector('#btn-gallery')?.addEventListener('click', () => {
      document.getElementById('file-input')?.click();
    });
    root.querySelector('#file-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        state.capturePhoto = reader.result;
        stopCamera();
        // gallery pick → random outcome (mostly success)
        const roll = Math.random();
        const outcome = roll < 0.15 ? 'failed' : roll < 0.35 ? 'partial' : 'success';
        // show photo then load
        state.scanPhase = 'ocr';
        renderScan();
        showCapturedPhoto(state.capturePhoto);
        // re-run loading with photo already set
        state.forceOutcome = outcome;
        const t1 = setTimeout(() => {
          state.scanPhase = 'generating';
          renderScan();
          showCapturedPhoto(state.capturePhoto);
        }, 1400);
        const t2 = setTimeout(() => finishScan(outcome), 3000);
        state.loadTimers = [t1, t2];
      };
      reader.readAsDataURL(file);
    });

    // Shutter: tap = success / long-press = partial / double-tap = failed
    const shutter = root.querySelector('#btn-shutter');
    if (shutter) {
      let pressTimer = null;
      let longPressed = false;
      let lastTapAt = 0;
      let singleTimer = null;

      shutter.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        longPressed = false;
        pressTimer = setTimeout(() => {
          longPressed = true;
          clearTimeout(singleTimer);
          singleTimer = null;
          lastTapAt = 0;
          shutter.style.opacity = '0.7';
          beginLoading('partial');
        }, 550);
      });
      const cancelPress = () => {
        clearTimeout(pressTimer);
        shutter.style.opacity = '';
      };
      shutter.addEventListener('pointerup', (e) => {
        e.preventDefault();
        cancelPress();
        if (longPressed) return;
        const now = Date.now();
        if (now - lastTapAt < 350) {
          // double tap → failed
          clearTimeout(singleTimer);
          singleTimer = null;
          lastTapAt = 0;
          beginLoading('failed');
          return;
        }
        lastTapAt = now;
        clearTimeout(singleTimer);
        singleTimer = setTimeout(() => {
          singleTimer = null;
          lastTapAt = 0;
          beginLoading('success');
        }, 320);
      });
      shutter.addEventListener('pointerleave', cancelPress);
      shutter.addEventListener('pointercancel', cancelPress);
    }

    // Result controls
    root.querySelector('#mode-seg')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      state.resultMode = btn.dataset.mode;
      updateResultTexts();
    });
    root.querySelector('#btn-furi')?.addEventListener('click', () => {
      state.resultFurigana = !state.resultFurigana;
      updateResultTexts();
    });
    root.querySelector('#btn-save')?.addEventListener('click', saveCurrentResult);
    root.querySelector('#memo-input')?.addEventListener('change', (e) => {
      if (state.result) {
        state.result.memo = e.target.value;
        if (state.resultSaved) {
          // auto-persist memo edits when already saved
          const records = loadRecords();
          const idx = records.findIndex((r) => r.id === state.result.id);
          if (idx >= 0) {
            records[idx].memo = e.target.value;
            saveRecords(records);
          }
        }
      }
    });
    root.querySelector('#result-photo')?.addEventListener('click', () => {
      openLightbox(state.result?.photoDataUrl, state.result?.photoLabel);
    });

    // Settings
    root.querySelector('#set-furi')?.addEventListener('click', (e) => {
      state.settings.furiganaDefault = !state.settings.furiganaDefault;
      saveSettings(state.settings);
      e.currentTarget.classList.toggle('on', state.settings.furiganaDefault);
    });
    root.querySelector('#set-geo')?.addEventListener('click', (e) => {
      state.settings.geoEnabled = !state.settings.geoEnabled;
      saveSettings(state.settings);
      e.currentTarget.classList.toggle('on', state.settings.geoEnabled);
    });
    root.querySelector('#set-mode')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      state.settings.modeDefault = btn.dataset.mode;
      saveSettings(state.settings);
      root.querySelectorAll('#set-mode button').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === state.settings.modeDefault);
      });
    });
    root.querySelector('#btn-clear-data')?.addEventListener('click', () => {
      if (confirm('すべての旅の記録と設定を削除しますか？この操作は取り消せません。')) {
        clearAllData();
        state.records = [];
        state.settings = loadSettings();
        showToast('データを削除しました');
        renderSettings();
      }
    });
    root.querySelector('#btn-disclaimer')?.addEventListener('click', () => {
      alert(
        '【免責・利用について】\n\n撮るほどの解説は AI によるものです。歴史的事実の正確性を保証するものではありません。正確な情報は現地の案内板・資料をご確認ください。\n\n本プロトタイプはデモ用であり、撮影画像・記録は端末の localStorage にのみ保存されます。'
      );
    });
  }

  // ─── Lightbox ───
  function openLightbox(dataUrl, label) {
    if (!lightboxEl) return;
    const inner = lightboxEl.querySelector('.lightbox-inner');
    if (dataUrl) {
      inner.style.backgroundImage = `url(${dataUrl})`;
      inner.textContent = '';
    } else {
      inner.style.backgroundImage = '';
      inner.textContent = label || '写真';
    }
    lightboxEl.classList.add('visible');
  }
  function closeLightbox() {
    lightboxEl?.classList.remove('visible');
  }
  lightboxEl?.addEventListener('click', closeLightbox);

  // ─── Toast ───
  let toastTimer = null;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 2200);
  }

  // ─── Boot ───
  function boot() {
    parseHash();
    // Ensure seed on first visit
    state.records = loadRecords();
    state.settings = loadSettings();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
