// Shared CSV format and storage for the library and existing solver.
  var LEGACY_CUSTOM_BANK_KEY = 'moonble-custom-bank-v1';
  var CUSTOM_BANK_KEY_PREFIX = 'moonble:user:';
  var activeUserId = null;
  var MIN_QUESTIONS = 20;
  var CUSTOM_ID_BASE = 100000;

  // ---- storage ----
  function storageKey(userId) {
    var id = userId || activeUserId;
    return id ? CUSTOM_BANK_KEY_PREFIX + id + ':custom-bank-v2' : null;
  }
  function defaultTitle(sourceLabel) {
    return (typeof sourceLabel === 'string' && sourceLabel ? sourceLabel : '내 문제지').replace(/\.csv$/i, '');
  }
  export function setCustomBankUser(userId) {
    activeUserId = typeof userId === 'string' && userId ? userId : null;
    var key = storageKey();
    if (!key) return;
    try {
      if (!localStorage.getItem(key)) {
        var legacy = localStorage.getItem(LEGACY_CUSTOM_BANK_KEY);
        if (legacy) localStorage.setItem(key, legacy);
      }
      localStorage.removeItem(LEGACY_CUSTOM_BANK_KEY);
    } catch (e) { /* 저장소 제한 시 읽기 함수가 안전하게 null을 반환한다. */ }
  }
  export function getCustomBankMeta(userId) {
    try {
      var key = storageKey(userId);
      if (!key) return null;
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length < MIN_QUESTIONS) return null;
      if (!parsed.questions.every(q => q && Number.isInteger(q.id) && typeof q.q === 'string' && Array.isArray(q.options) && q.options.length >= 2 && q.options.every(o => typeof o === 'string') && Array.isArray(q.correct) && q.correct.length && q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length))) return null;
      var source = typeof parsed.source === 'string' ? parsed.source : '커스텀 문제';
      return {
        ...parsed,
        source: source,
        title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : defaultTitle(source),
        description: typeof parsed.description === 'string' && parsed.description.trim() ? parsed.description.trim() : '직접 등록한 문제로 학습을 시작해보세요.'
      };
    } catch (e) { return null; }
  }
  export function getCustomBank(userId) {
    var meta = getCustomBankMeta(userId);
    return meta ? meta.questions : null;
  }
  export function setCustomBank(questions, sourceLabel, userId, details) {
    try {
      var key = storageKey(userId);
      if (!key) throw new Error('로그인 상태를 확인해주세요.');
      var meta = details || {};
      localStorage.setItem(key, JSON.stringify({
        questions: questions,
        source: sourceLabel,
        title: typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : defaultTitle(sourceLabel),
        description: typeof meta.description === 'string' && meta.description.trim() ? meta.description.trim() : '직접 등록한 문제로 학습을 시작해보세요.',
        savedAt: new Date().toISOString()
      }));
    } catch (e) { throw new Error('브라우저 저장 공간에 문제지를 저장하지 못했습니다.'); }
  }
  export function updateCustomBankMeta(title, description, userId) {
    try {
      var key = storageKey(userId);
      if (!key) throw new Error('로그인 상태를 확인해주세요.');
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      parsed.title = typeof title === 'string' && title.trim() ? title.trim() : defaultTitle(parsed.source);
      parsed.description = typeof description === 'string' && description.trim() ? description.trim() : '직접 등록한 문제로 학습을 시작해보세요.';
      localStorage.setItem(key, JSON.stringify(parsed));
      return getCustomBankMeta(userId);
    } catch (e) { throw new Error('문제지 정보를 저장하지 못했습니다.'); }
  }
  export function clearCustomBank(userId) {
    try {
      var key = storageKey(userId);
      if (!key) throw new Error('로그인 상태를 확인해주세요.');
      localStorage.removeItem(key);
    } catch (e) { throw new Error(e.message === '로그인 상태를 확인해주세요.' ? e.message : '문제지를 삭제하지 못했습니다.'); }
  }
  // ---- CSV 파싱 (따옴표로 감싼 콤마를 처리하는 간단한 RFC4180 스타일 파서) ----
  function parseCSVText(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else if (c === '\r') {
        // skip, \n이 줄바꿈 처리
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
  }

  export function csvToQuestions(text) {
    var parsedRows = parseCSVText(text);
    var meta = { title: '', description: '' };
    parsedRows.forEach(function (r) {
      var key = (r[0] || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (key === '# title' || key === '#title') meta.title = r.slice(1).join(',').trim();
      if (key === '# description' || key === '#description') meta.description = r.slice(1).join(',').trim();
    });
    // '#'로 시작하는 행은 문제지 메타데이터/주석 행으로 보고 건너뛴다.
    var rows = parsedRows.filter(function (r) {
      return !(r[0] && r[0].replace(/^\uFEFF/, '').trim().charAt(0) === '#');
    });
    if (!rows.length) return { error: 'CSV 내용이 비어 있습니다.' };
    var header = rows[0].map(function (h) { return (h || '').replace(/^\uFEFF/, '').trim().toLowerCase(); });
    var qIdx = header.indexOf('question');
    var cIdx = header.indexOf('correct');
    var optIdx = [
      header.indexOf('option1'), header.indexOf('option2'),
      header.indexOf('option3'), header.indexOf('option4')
    ];
    var eIdx = header.indexOf('explain');
    if (qIdx === -1 || cIdx === -1 || optIdx[0] === -1 || optIdx[1] === -1) {
      return { error: '헤더에 question, option1, option2, correct 컬럼이 필요합니다.' };
    }
    var questions = [];
    var errors = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var qText = (r[qIdx] || '').trim();
      if (!qText) continue;
      var opts = optIdx.map(function (idx) { return idx === -1 ? '' : (r[idx] || '').trim(); }).filter(Boolean);
      var correctRaw = (r[cIdx] || '').trim();
      var explain = eIdx === -1 ? '' : (r[eIdx] || '').trim();

      if (opts.length < 2) { errors.push((i + 1) + '행: 보기가 2개 미만입니다.'); continue; }
      var correctNums = correctRaw.split(',').map(function (s) { return parseInt(s.trim(), 10); }).filter(function (n) { return !isNaN(n); });
      if (!correctNums.length) { errors.push((i + 1) + '행: 정답 번호가 올바르지 않습니다.'); continue; }
      var correctIdx = correctNums.map(function (n) { return n - 1; });
      var outOfRange = correctIdx.some(function (n) { return n < 0 || n >= opts.length; });
      if (outOfRange) { errors.push((i + 1) + '행: 정답 번호가 보기 범위를 벗어납니다.'); continue; }

      questions.push({
        id: CUSTOM_ID_BASE + questions.length + 1,
        q: qText,
        options: opts,
        correct: correctIdx,
        explain: explain,
        multi: correctIdx.length > 1
      });
    }
    if (questions.length < MIN_QUESTIONS) {
      var msg = '유효한 문항이 ' + questions.length + '개뿐입니다. 최소 ' + MIN_QUESTIONS + '개가 필요합니다.';
      if (errors.length) msg += ' (' + errors.slice(0, 3).join(' / ') + (errors.length > 3 ? ' 외 ' + (errors.length - 3) + '건' : '') + ')';
      return { error: msg };
    }
    return { questions: questions, title: meta.title, description: meta.description };
  }

  // ---- 샘플 CSV 다운로드 ----
  export function downloadSampleCSV() {
    var header = ['번호', 'question', 'option1', 'option2', 'option3', 'option4', 'correct', 'explain'];
    var dataRows = [];
    for (var i = 1; i <= 500; i++) {
      if (i === 1) {
        dataRows.push([
          'Q.' + i,
          '샘플 문제입니다. 이 문항을 실제 문제로 바꿔서 사용하세요.',
          '보기 1', '보기 2', '보기 3', '보기 4',
          '1,3',
          '정답이 여러 개인 경우의 예시입니다(1번, 3번이 정답). 정답이 하나면 "1"처럼 숫자 하나만 적으면 됩니다.'
        ]);
      } else {
        dataRows.push(['Q.' + i, '', '', '', '', '', '', '']);
      }
    }
    var metadataRows = [['# title', '나만의 문제지'], ['# description', '학습 목표와 범위를 한 줄로 적어주세요.']];
    var csv = metadataRows.concat([header], dataRows).map(function (r) {
      return r.map(function (v) {
        v = String(v);
        return (v.indexOf(',') !== -1 || v.indexOf('"') !== -1) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'moonble_custom_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  // ---- 구글 시트 링크 → export CSV URL ----
  export function extractSheetExportUrl(link) {
    var m = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) return null;
    var id = m[1];
    var gidMatch = link.match(/[#&?]gid=(\d+)/);
    var url = 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=csv';
    if (gidMatch) url += '&gid=' + gidMatch[1];
    return url;
  }

