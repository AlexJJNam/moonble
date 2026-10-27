// Shared CSV format and storage for the library and existing solver.
import { supabase } from './supabase.js';

  var LEGACY_CUSTOM_BANK_KEY = 'moonble-custom-bank-v1';
  var CUSTOM_BANK_KEY_PREFIX = 'moonble:user:';
  var DEFAULT_GROUP_ID = 'ungrouped';
  var activeUserId = null;
  var remoteWriteQueues = new Map();
  var MIN_QUESTIONS = 20;
  var CUSTOM_ID_BASE = 100000;

  // ---- storage ----
  function legacyStorageKey(userId) {
    var id = userId || activeUserId;
    return id ? CUSTOM_BANK_KEY_PREFIX + id + ':custom-bank-v2' : null;
  }
  function storageKey(userId) {
    var id = userId || activeUserId;
    return id ? CUSTOM_BANK_KEY_PREFIX + id + ':custom-banks-v3' : null;
  }
  function makeId(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return prefix + '-' + crypto.randomUUID();
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }
  function defaultTitle(sourceLabel) {
    return (typeof sourceLabel === 'string' && sourceLabel ? sourceLabel : '내 문제지').replace(/\.csv$/i, '');
  }
  function validQuestions(questions) {
    return Array.isArray(questions) && questions.length >= MIN_QUESTIONS && questions.every(q => q && Number.isInteger(q.id) && typeof q.q === 'string' && Array.isArray(q.options) && q.options.length >= 2 && q.options.every(o => typeof o === 'string') && Array.isArray(q.correct) && q.correct.length && q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length));
  }
  function normalizeBank(bank) {
    if (!bank || !validQuestions(bank.questions)) return null;
    var source = typeof bank.source === 'string' ? bank.source : '커스텀 문제';
    return {
      ...bank,
      id: typeof bank.id === 'string' && bank.id ? bank.id : makeId('bank'),
      groupId: typeof bank.groupId === 'string' && bank.groupId ? bank.groupId : DEFAULT_GROUP_ID,
      source: source,
      title: typeof bank.title === 'string' && bank.title.trim() ? bank.title.trim() : defaultTitle(source),
      description: typeof bank.description === 'string' && bank.description.trim() ? bank.description.trim() : '직접 등록한 문제로 학습을 시작해보세요.',
      savedAt: typeof bank.savedAt === 'string' ? bank.savedAt : new Date().toISOString()
    };
  }
  function emptyCollection() {
    return { version: 3, bankOrderVersion: 1, activeBankId: null, groups: [], banks: [] };
  }
  function normalizeCollection(value) {
    var parsed = value && typeof value === 'object' ? value : emptyCollection();
    var groups = Array.isArray(parsed.groups) ? parsed.groups.filter(group => group && typeof group.id === 'string' && typeof group.name === 'string' && group.name.trim()).map(group => ({ ...group, name: group.name.trim() })) : [];
    var groupIds = new Set(groups.map(group => group.id));
    var banks = (Array.isArray(parsed.banks) ? parsed.banks : []).map(normalizeBank).filter(Boolean).map(bank => groupIds.has(bank.groupId) ? bank : { ...bank, groupId: DEFAULT_GROUP_ID });
    if (parsed.bankOrderVersion !== 1) {
      banks.sort(function (a, b) {
        return new Date(b.updatedAt || b.savedAt || 0).getTime() - new Date(a.updatedAt || a.savedAt || 0).getTime();
      });
    }
    var activeBankId = banks.some(bank => bank.id === parsed.activeBankId) ? parsed.activeBankId : (banks[0]?.id || null);
    return { version: 3, bankOrderVersion: 1, activeBankId: activeBankId, groups: groups, banks: banks };
  }
  function writeCollection(collection, userId, options) {
    var key = storageKey(userId);
    if (!key) throw new Error('로그인 상태를 확인해주세요.');
    var before = options && options.sync === false ? null : readCollection(userId);
    var next = normalizeCollection(collection);
    localStorage.setItem(key, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('moonble:custom-bank-collection', { detail: { userId: userId || activeUserId } }));
    }
    if (!options || options.sync !== false) queueRemoteCollectionWrite(before || emptyCollection(), next, userId || activeUserId);
  }
  function remoteGroupRow(group, sortOrder) {
    return {
      id: group.id,
      name: group.name,
      color_key: group.colorKey || null,
      sort_order: sortOrder,
      created_at: group.createdAt || new Date().toISOString(),
      updated_at: group.updatedAt || group.createdAt || new Date().toISOString()
    };
  }
  function remoteBankRow(bank, sortOrder) {
    return {
      id: bank.id,
      group_id: bank.groupId === DEFAULT_GROUP_ID ? null : bank.groupId,
      title: bank.title,
      description: bank.description || '',
      source: bank.source || '커스텀 문제',
      questions: bank.questions,
      sort_order: sortOrder,
      saved_at: bank.savedAt || new Date().toISOString(),
      updated_at: bank.updatedAt || bank.savedAt || new Date().toISOString()
    };
  }
  async function saveRemoteCollection(collection, userId, deletedGroupIds, deletedBankIds) {
    if (!supabase || !userId) return;
    var groups = collection.groups.map(function (group, index) { return remoteGroupRow(group, index); });
    var banks = collection.banks.map(function (bank, index) { return remoteBankRow(bank, index); });
    var result = await supabase.rpc('moonble_save_custom_bank_collection', {
      p_groups: groups,
      p_banks: banks,
      p_deleted_group_ids: deletedGroupIds || [],
      p_deleted_bank_ids: deletedBankIds || []
    });
    if (result.error) throw result.error;
    for (var group of groups) {
      if (!group.color_key) continue;
      var colorResult = await supabase.rpc('moonble_set_quiz_group_color', {
        p_group_id: group.id,
        p_color_key: group.color_key
      });
      if (colorResult.error) throw colorResult.error;
    }
  }
  function queueRemoteCollectionWrite(before, next, userId) {
    if (!supabase || !userId) return;
    var previous = remoteWriteQueues.get(userId) || Promise.resolve();
    var previousGroupIds = new Set(before.groups.map(function (group) { return group.id; }));
    var nextGroupIds = new Set(next.groups.map(function (group) { return group.id; }));
    var previousBankIds = new Set(before.banks.map(function (bank) { return bank.id; }));
    var nextBankIds = new Set(next.banks.map(function (bank) { return bank.id; }));
    var deletedGroupIds = Array.from(previousGroupIds).filter(function (id) { return !nextGroupIds.has(id); });
    var deletedBankIds = Array.from(previousBankIds).filter(function (id) { return !nextBankIds.has(id); });
    var task = previous.catch(function () {}).then(function () {
      return saveRemoteCollection(next, userId, deletedGroupIds, deletedBankIds);
    });
    remoteWriteQueues.set(userId, task);
    task.catch(function () {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('moonble:custom-bank-sync-error', {
          detail: { message: '문제지는 이 기기에 저장됐어요. 서버에 동기화하지 못해 다음 접속이나 네트워크 복귀 때 다시 시도합니다.' }
        }));
      }
    });
  }
  function mergeRemoteCollection(remoteGroupRows, remoteBankRows, userId) {
    var local = readCollection(userId);
    var remoteGroupRecords = remoteGroupRows || [];
    var remoteBankRecords = remoteBankRows || [];
    var deletedGroupIds = new Set(remoteGroupRecords.filter(function (row) { return row.deleted_at; }).map(function (row) { return row.id; }));
    var deletedBankIds = new Set(remoteBankRecords.filter(function (row) { return row.deleted_at; }).map(function (row) { return row.id; }));
    var localGroups = new Map(local.groups.map(function (group) { return [group.id, group]; }));
    var localBanks = new Map(local.banks.map(function (bank) { return [bank.id, bank]; }));
    var mergedGroups = [];
    var seenGroupIds = new Set();
    remoteGroupRecords.filter(function (row) { return !row.deleted_at; }).forEach(function (row) {
      var remote = { id: row.id, name: row.name, colorKey: row.color_key || undefined, createdAt: row.created_at, updatedAt: row.updated_at };
      var localGroup = localGroups.get(row.id);
      var chosen = localGroup && new Date(localGroup.updatedAt || localGroup.createdAt || 0) > new Date(row.updated_at || row.created_at || 0) ? localGroup : remote;
      mergedGroups.push(chosen);
      seenGroupIds.add(row.id);
    });
    local.groups.forEach(function (group) {
      if (!seenGroupIds.has(group.id) && !deletedGroupIds.has(group.id)) mergedGroups.push(group);
    });

    var mergedBanks = [];
    var seenBankIds = new Set();
    remoteBankRecords.filter(function (row) { return !row.deleted_at; }).forEach(function (row) {
      var remote = normalizeBank({
        id: row.id,
        groupId: row.group_id || DEFAULT_GROUP_ID,
        title: row.title,
        description: row.description,
        source: row.source,
        questions: row.questions,
        savedAt: row.saved_at,
        updatedAt: row.updated_at
      });
      if (!remote) return;
      var localBank = localBanks.get(row.id);
      var chosen = localBank && new Date(localBank.updatedAt || localBank.savedAt || 0) > new Date(row.updated_at || row.saved_at || 0) ? localBank : remote;
      mergedBanks.push(chosen);
      seenBankIds.add(row.id);
    });
    local.banks.forEach(function (bank) {
      if (!seenBankIds.has(bank.id) && !deletedBankIds.has(bank.id)) mergedBanks.push(bank);
    });

    var normalized = normalizeCollection({
      version: 3,
      bankOrderVersion: 1,
      activeBankId: local.activeBankId,
      groups: mergedGroups,
      banks: mergedBanks
    });
    var localOnlyCount = local.banks.filter(function (bank) {
      return !remoteBankRecords.some(function (row) { return row.id === bank.id; }) && !deletedBankIds.has(bank.id);
    }).length;
    return { collection: normalized, localOnlyCount: localOnlyCount };
  }
  export async function syncCustomBankCollection(userId) {
    var id = userId || activeUserId;
    var local = readCollection(id);
    if (!id || !supabase) return { collection: local, synced: false, migrated: 0 };
    var pendingWrite = remoteWriteQueues.get(id);
    if (pendingWrite) await pendingWrite.catch(function () {});
    var results = await Promise.all([
      supabase.from('quiz_groups').select('id,owner_id,name,color_key,sort_order,created_at,updated_at,deleted_at').eq('owner_id', id).order('sort_order', { ascending: true }),
      supabase.from('quiz_banks').select('id,owner_id,group_id,title,description,source,questions,sort_order,saved_at,updated_at,deleted_at').eq('owner_id', id).order('sort_order', { ascending: true })
    ]);
    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;
    var merged = mergeRemoteCollection(results[0].data, results[1].data, id);
    // mergeRemoteCollection은 현재 localStorage를 다시 읽어, 서버 응답을 기다리는 동안의 변경도 포함한다.
    writeCollection(merged.collection, id, { sync: false });
    await saveRemoteCollection(merged.collection, id, [], []);
    return { collection: merged.collection, synced: true, migrated: merged.localOnlyCount };
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', function () {
      if (activeUserId) syncCustomBankCollection(activeUserId).catch(function () {});
    });
  }
  function readCollection(userId) {
    var key = storageKey(userId);
    if (!key) return emptyCollection();
    var raw = localStorage.getItem(key);
    if (raw) return normalizeCollection(JSON.parse(raw));
    var legacyKey = legacyStorageKey(userId);
    var legacyRaw = legacyKey ? localStorage.getItem(legacyKey) : null;
    if (!legacyRaw) return emptyCollection();
    var legacyBank = normalizeBank(JSON.parse(legacyRaw));
    var migrated = legacyBank ? { version: 3, activeBankId: legacyBank.id, groups: [], banks: [legacyBank] } : emptyCollection();
    writeCollection(migrated, userId, { sync: false });
    localStorage.removeItem(legacyKey);
    return normalizeCollection(migrated);
  }
  export function setCustomBankUser(userId) {
    activeUserId = typeof userId === 'string' && userId ? userId : null;
    var legacyKey = legacyStorageKey();
    if (!legacyKey) return;
    try {
      if (!localStorage.getItem(storageKey()) && !localStorage.getItem(legacyKey)) {
        var legacy = localStorage.getItem(LEGACY_CUSTOM_BANK_KEY);
        if (legacy) localStorage.setItem(legacyKey, legacy);
      }
      localStorage.removeItem(LEGACY_CUSTOM_BANK_KEY);
      readCollection();
    } catch (e) { /* 저장소 제한 시 읽기 함수가 안전하게 null을 반환한다. */ }
  }
  export function getCustomBankCollection(userId) {
    try {
      return readCollection(userId);
    } catch (e) { return emptyCollection(); }
  }
  export function getCustomBanks(userId) {
    return getCustomBankCollection(userId).banks;
  }
  export function getCustomGroups(userId) {
    return getCustomBankCollection(userId).groups;
  }
  export function getCustomBankMeta(userId, bankId) {
    var collection = getCustomBankCollection(userId);
    var id = bankId || collection.activeBankId;
    return collection.banks.find(bank => bank.id === id) || null;
  }
  export function getCustomBank(userId, bankId) {
    var meta = getCustomBankMeta(userId, bankId);
    return meta ? meta.questions : null;
  }
  export function setActiveCustomBank(bankId, userId) {
    try {
      var collection = readCollection(userId);
      if (!collection.banks.some(bank => bank.id === bankId)) return null;
      collection.activeBankId = bankId;
      writeCollection(collection, userId, { sync: false });
      return collection.banks.find(bank => bank.id === bankId) || null;
    } catch (e) { throw new Error('문제지를 열지 못했습니다.'); }
  }
  export function setCustomBank(questions, sourceLabel, userId, details) {
    try {
      var meta = details || {};
      var collection = readCollection(userId);
      var bankId = typeof meta.bankId === 'string' ? meta.bankId : (!meta.create ? collection.activeBankId : null);
      var existing = collection.banks.find(bank => bank.id === bankId);
      var now = new Date().toISOString();
      var bank = normalizeBank({
        ...existing,
        id: existing?.id || makeId('bank'),
        groupId: typeof meta.groupId === 'string' ? meta.groupId : (existing?.groupId || DEFAULT_GROUP_ID),
        questions: questions,
        source: sourceLabel,
        title: typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : defaultTitle(sourceLabel),
        description: typeof meta.description === 'string' && meta.description.trim() ? meta.description.trim() : '직접 등록한 문제로 학습을 시작해보세요.',
        savedAt: existing?.savedAt || now,
        updatedAt: now
      });
      if (!bank) throw new Error('문제지 형식이 올바르지 않습니다.');
      collection.banks = existing ? collection.banks.map(item => item.id === bank.id ? bank : item) : [bank, ...collection.banks];
      collection.activeBankId = bank.id;
      writeCollection(collection, userId);
      return bank;
    } catch (e) { throw new Error('브라우저 저장 공간에 문제지를 저장하지 못했습니다.'); }
  }
  export function updateCustomBankMeta(title, description, userId, bankId, groupId) {
    try {
      var collection = readCollection(userId);
      var id = bankId || collection.activeBankId;
      var bank = collection.banks.find(item => item.id === id);
      if (!bank) return null;
      var validGroup = groupId === DEFAULT_GROUP_ID || collection.groups.some(group => group.id === groupId);
      var next = {
        ...bank,
        title: typeof title === 'string' && title.trim() ? title.trim() : defaultTitle(bank.source),
        description: typeof description === 'string' && description.trim() ? description.trim() : '직접 등록한 문제로 학습을 시작해보세요.',
        groupId: validGroup ? groupId : bank.groupId,
        updatedAt: new Date().toISOString()
      };
      collection.banks = collection.banks.map(item => item.id === id ? next : item);
      writeCollection(collection, userId);
      return next;
    } catch (e) { throw new Error('문제지 정보를 저장하지 못했습니다.'); }
  }
  export function clearCustomBank(userId, bankId) {
    try {
      var collection = readCollection(userId);
      var id = bankId || collection.activeBankId;
      collection.banks = collection.banks.filter(bank => bank.id !== id);
      if (collection.activeBankId === id) collection.activeBankId = collection.banks[0]?.id || null;
      writeCollection(collection, userId);
    } catch (e) { throw new Error(e.message === '로그인 상태를 확인해주세요.' ? e.message : '문제지를 삭제하지 못했습니다.'); }
  }
  export function createCustomGroup(name, userId, colorKey) {
    try {
      var collection = readCollection(userId);
      var cleanName = typeof name === 'string' ? name.trim().slice(0, 24) : '';
      if (!cleanName) throw new Error('그룹 이름을 입력해주세요.');
      if (collection.groups.some(group => group.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw new Error('같은 이름의 그룹이 이미 있어요.');
      var group = { id: makeId('group'), name: cleanName, colorKey: colorKey || 'blue', createdAt: new Date().toISOString() };
      collection.groups.push(group);
      writeCollection(collection, userId);
      return group;
    } catch (e) { throw new Error(e.message || '그룹을 만들지 못했습니다.'); }
  }
  export function updateCustomGroup(groupId, name, userId, colorKey) {
    try {
      var collection = readCollection(userId);
      var cleanName = typeof name === 'string' ? name.trim().slice(0, 24) : '';
      if (!cleanName) throw new Error('그룹 이름을 입력해주세요.');
      if (collection.groups.some(group => group.id !== groupId && group.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw new Error('같은 이름의 그룹이 이미 있어요.');
      if (!collection.groups.some(group => group.id === groupId)) throw new Error('그룹을 찾지 못했습니다.');
      collection.groups = collection.groups.map(group => group.id === groupId ? { ...group, name: cleanName, colorKey: colorKey || group.colorKey || 'blue', updatedAt: new Date().toISOString() } : group);
      writeCollection(collection, userId);
      return collection.groups.find(group => group.id === groupId);
    } catch (e) { throw new Error(e.message || '그룹 이름을 바꾸지 못했습니다.'); }
  }
  export function deleteCustomGroup(groupId, userId) {
    try {
      var collection = readCollection(userId);
      collection.groups = collection.groups.filter(group => group.id !== groupId);
      collection.banks = collection.banks.map(bank => bank.groupId === groupId ? { ...bank, groupId: DEFAULT_GROUP_ID, updatedAt: new Date().toISOString() } : bank);
      writeCollection(collection, userId);
    } catch (e) { throw new Error('그룹을 삭제하지 못했습니다.'); }
  }
  export function reorderCustomGroups(groupIds, userId) {
    try {
      var collection = readCollection(userId);
      var order = Array.isArray(groupIds) ? groupIds : [];
      var rank = new Map(order.map(function (id, index) { return [id, index]; }));
      collection.groups = collection.groups.slice().sort(function (a, b) {
        var aRank = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
        var bRank = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
        return aRank - bRank;
      });
      var now = new Date().toISOString();
      collection.groups = collection.groups.map(function (group, index) { return { ...group, sortOrder: index, updatedAt: now }; });
      writeCollection(collection, userId);
      return collection.groups;
    } catch (e) { throw new Error('그룹 순서를 저장하지 못했습니다.'); }
  }
  export function reorderCustomBanks(bankIds, userId) {
    try {
      var collection = readCollection(userId);
      var order = Array.isArray(bankIds) ? bankIds : [];
      var rank = new Map(order.map(function (id, index) { return [id, index]; }));
      var originalRank = new Map(collection.banks.map(function (bank, index) { return [bank.id, index]; }));
      collection.banks = collection.banks.slice().sort(function (a, b) {
        var aRank = rank.has(a.id) ? rank.get(a.id) : order.length + originalRank.get(a.id);
        var bRank = rank.has(b.id) ? rank.get(b.id) : order.length + originalRank.get(b.id);
        return aRank - bRank;
      });
      var now = new Date().toISOString();
      collection.banks = collection.banks.map(function (bank, index) { return { ...bank, sortOrder: index, updatedAt: now }; });
      writeCollection(collection, userId);
      return collection.banks;
    } catch (e) { throw new Error('문제지 순서를 저장하지 못했습니다.'); }
  }
  export { DEFAULT_GROUP_ID };
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

  export function exportCustomBankPDF(bank) {
    if (!bank || !Array.isArray(bank.questions) || !bank.questions.length) return false;
    var escapeHTML = function (value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
      });
    };
    var title = escapeHTML(bank.title || '문제지');
    var description = escapeHTML(bank.description || '');
    var questionMarkup = bank.questions.map(function (question, index) {
      var options = Array.isArray(question.options) ? question.options : [];
      var optionMarkup = options.map(function (option, optionIndex) {
        return '<li><span>' + (optionIndex + 1) + '.</span><span>' + escapeHTML(option) + '</span></li>';
      }).join('');
      return '<article class="question"><h2><span>Q' + (index + 1) + '</span>' + escapeHTML(question.q || '') + '</h2><ol>' + optionMarkup + '</ol></article>';
    }).join('');
    var answerRows = bank.questions.map(function (question, index) {
      var options = Array.isArray(question.options) ? question.options : [];
      var correct = Array.isArray(question.correct) ? question.correct : [];
      var answers = correct.map(function (optionIndex) {
        var answerText = options[Number(optionIndex)];
        return (Number(optionIndex) + 1) + '번' + (answerText ? ' · ' + escapeHTML(answerText) : '');
      }).join('<br>') || '정답 정보 없음';
      return '<tr><th scope="row">' + (index + 1) + '</th><td>' + answers + '</td><td>' + (escapeHTML(question.explain || '') || '—') + '</td></tr>';
    }).join('');
    var printWindow = window.open('', '_blank');
    if (!printWindow) return false;
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title><style>' +
      '*{box-sizing:border-box}body{margin:0;color:#202733;background:#fff;font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif;font-size:12pt;line-height:1.6}.document{max-width:820px;margin:0 auto;padding:38px 32px 60px}header{margin-bottom:28px;padding-bottom:18px;border-bottom:1px solid #dfe5ec}h1{margin:0;font-size:24pt;line-height:1.3;letter-spacing:-.03em}.description{margin:9px 0 0;color:#667487;white-space:pre-wrap}.meta{margin:12px 0 0;color:#768294;font-size:9.5pt}.question{break-inside:avoid;margin:0 0 16px;padding:16px 18px;border:1px solid #e1e6ed;border-radius:12px}.question h2{display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;font-size:12pt;line-height:1.55;white-space:pre-wrap}.question h2>span{flex:0 0 auto;color:#2374ee;font-size:10pt;font-weight:700}.question ol{display:grid;gap:7px;margin:0;padding:0;list-style:none}.question li{display:flex;gap:9px;white-space:pre-wrap}.question li>span:first-child{flex:0 0 auto;color:#6b7684}.answer-key{break-before:page;page-break-before:always}.answer-key h2{margin:0 0 8px;font-size:21pt;letter-spacing:-.02em}.answer-key>p{margin:0 0 20px;color:#667487}.answer-key table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5pt}.answer-key thead{display:table-header-group}.answer-key tr{break-inside:avoid;page-break-inside:avoid}.answer-key th,.answer-key td{padding:10px 12px;border:1px solid #dfe5ec;vertical-align:top;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}.answer-key thead th{color:#475569;background:#f3f6f9;font-weight:700}.answer-key th:first-child,.answer-key td:first-child{width:54px;text-align:center}.answer-key td:nth-child(2){width:34%}.answer-key td:nth-child(3){color:#596579}@page{size:A4;margin:16mm}@media print{body{font-size:10.5pt}.document{max-width:none;margin:0;padding:0}.question{margin-bottom:12px;padding:12px 14px}h1{font-size:21pt}.question h2{font-size:10.5pt}.question li,.answer-key table{font-size:9.5pt}}' +
      '</style></head><body><main class="document"><header><h1>' + title + '</h1>' + (description ? '<p class="description">' + description + '</p>' : '') + '<p class="meta">총 ' + bank.questions.length + '문항 · 내보낸 날짜 ' + escapeHTML(new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date())) + '</p></header><section aria-label="문제지">' + questionMarkup + '</section><section class="answer-key" aria-label="정답 및 해설"><h2>정답 및 해설</h2><p>' + title + ' · ' + bank.questions.length + '문항</p><table><thead><tr><th>문항</th><th>정답</th><th>해설</th></tr></thead><tbody>' + answerRows + '</tbody></table></section></main></body></html>');
    printWindow.document.close();
    var printStarted = false;
    var startPrint = function () {
      if (printStarted) return;
      printStarted = true;
      window.setTimeout(function () {
        printWindow.focus();
        printWindow.print();
      }, 250);
    };
    printWindow.addEventListener('load', startPrint, { once: true });
    window.setTimeout(function () {
      try { if (printWindow.document.readyState === 'complete') startPrint(); } catch { /* 닫힌 인쇄 창은 무시한다. */ }
    }, 800);
    return true;
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

