(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'fichaTransporte.v1';
  var MESES = FichaPDF.MESES, PERIODOS = FichaPDF.PERIODOS;

  /* ---------------- dados ---------------- */
  var PREFIXO = 'Tiquira Centro de Desenvolvimento Humano LTDA - ';
  var UNITS = [
    { id: '1', num: 1, endereco: 'Rua Frei Antônio de Pádua, 1208 – Jd. Guanabara, Campinas/SP' },
    { id: '3', num: 3, endereco: 'Rua Frei Antônio de Pádua, 1215 – Jd. Guanabara, Campinas/SP' },
    { id: '4', num: 4, endereco: 'Rua Camargo Pimentel, 620 – Jd. Guanabara, Campinas/SP' },
    { id: '5', num: 5, endereco: 'Rua Frei Antônio de Pádua, 825 – Jd. Guanabara, Campinas/SP' }
  ];
  UNITS.forEach(function (u) { u.rotulo = 'Unidade ' + u.num; u.nome = PREFIXO + u.rotulo; });
  var LEGACY_UNIT = { u1: '5' };   // versão anterior do app: "Unidade V" = 5
  var db = load();
  var cur = { studentId: null };
  var currentFile = null;

  function fixUnit(id) { id = LEGACY_UNIT[id] || id; return unitById(id) ? id : ''; }
  function load() {
    var d = null;
    try {
      var r = localStorage.getItem(KEY);
      if (r) d = JSON.parse(r);
    } catch (e) { /* armazenamento indisponível: segue só em memória */ }
    if (!d || !Array.isArray(d.students)) d = { students: [] };
    d.students.forEach(function (s) { s.unidadeId = fixUnit(s.unidadeId); });
    delete d.units;
    return d;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('Não foi possível gravar os dados neste navegador.'); }
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function norm(s) { return clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function byName(a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }
  function unitById(id) { return UNITS.filter(function (u) { return u.id === id; })[0] || null; }
  function studentById(id) { return db.students.filter(function (s) { return s.id === id; })[0] || null; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------------- utilidades de interface ---------------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function openSheet(id) {
    closeSheets(); $('toast').hidden = true;
    $('backdrop').hidden = false; $(id).hidden = false;
  }
  function closeSheets() {
    $('backdrop').hidden = true;
    ['sheetPick', 'sheetAluno', 'sheetPdf'].forEach(function (i) { $(i).hidden = true; });
  }
  function showTab(name) {
    ['ficha', 'alunos', 'ajustes'].forEach(function (t) {
      $('view-' + t).classList.toggle('active', t === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === name);
    });
    window.scrollTo(0, 0);
    if (name === 'alunos') renderAlunos();
    if (name === 'ajustes') renderUnidades();
  }
  function getPeriodo(name) {
    var r = document.querySelector('input[name=' + name + ']:checked');
    return r ? r.value : '';
  }
  function setPeriodo(name, v) {
    Array.prototype.forEach.call(document.querySelectorAll('input[name=' + name + ']'), function (r) { r.checked = (r.value === v); });
  }

  /* ---------------- selects ---------------- */
  function fillMonths(sel) {
    sel.innerHTML = '';
    MESES.forEach(function (m, i) { var o = el('option', '', cap(m)); o.value = i; sel.appendChild(o); });
  }
  function fillUnits(sel, keep) {
    var prev = keep ? sel.value : '';
    sel.innerHTML = '';
    var p = el('option', '', 'Selecione a unidade…'); p.value = ''; sel.appendChild(p);
    UNITS.forEach(function (u) { var o = el('option', '', u.rotulo); o.value = u.id; sel.appendChild(o); });
    sel.value = prev && unitById(prev) ? prev : '';
  }
  function showUnitAddress() {
    var u = unitById($('unidade').value);
    $('endUnidade').textContent = u ? u.nome + '\n' + u.endereco : '';
  }

  /* ---------------- ficha ---------------- */
  function setToday() {
    var t = new Date();
    $('mesRef').value = t.getMonth(); $('anoRef').value = t.getFullYear();
    $('diaAss').value = t.getDate(); $('mesAss').value = t.getMonth(); $('anoAss').value = t.getFullYear();
  }
  function updatePicker() {
    var s = cur.studentId && studentById(cur.studentId);
    var t = $('pickerText');
    t.textContent = s ? s.nome : 'Toque para escolher um aluno salvo';
    t.className = s ? '' : 'placeholder';
    $('clearStudent').hidden = !(s || $('nome').value || $('endAluno').value);
  }
  function selectStudent(id) {
    var s = studentById(id); if (!s) return;
    cur.studentId = id;
    $('nome').value = s.nome; $('endAluno').value = s.endereco;
    fillUnits($('unidade'), false);
    $('unidade').value = unitById(s.unidadeId) ? s.unidadeId : '';
    setPeriodo('periodo', s.periodo);
    showUnitAddress(); updatePicker(); closeSheets();
    window.scrollTo(0, 0);
  }
  function clearStudent() {
    cur.studentId = null;
    $('nome').value = ''; $('endAluno').value = '';
    fillUnits($('unidade'), false); setPeriodo('periodo', '');
    showUnitAddress(); updatePicker();
    $('nome').focus();
  }
  function fail(msg, field) {
    toast(msg);
    if (field) { field.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (field.focus) field.focus(); }
  }
  function gerar() {
    var nome = clean($('nome').value), end = $('endAluno').value.trim();
    var unit = unitById($('unidade').value), per = getPeriodo('periodo');
    var mR = parseInt($('mesRef').value, 10), aR = parseInt($('anoRef').value, 10);
    var dia = parseInt($('diaAss').value, 10), mA = parseInt($('mesAss').value, 10), aA = parseInt($('anoAss').value, 10);
    if (!nome) return fail('Informe o nome do aluno.', $('nome'));
    if (!end) return fail('Informe o endereço do aluno.', $('endAluno'));
    if (!unit) return fail('Escolha a unidade escolar.', $('unidade'));
    if (!per) return fail('Escolha o período.', $('lblPeriodo'));
    if (!(aR >= 2000 && aR <= 2100)) return fail('Confira o ano de referência.', $('anoRef'));
    if (!(aA >= 2000 && aA <= 2100)) return fail('Confira o ano da assinatura.', $('anoAss'));
    if (!(dia >= 1 && dia <= new Date(aA, mA + 1, 0).getDate())) return fail('Confira o dia da assinatura.', $('diaAss'));

    var dados = {
      aluno: nome, endAluno: end, unidade: unit.nome, endUnidade: unit.endereco, periodo: per,
      mesRef: MESES[mR], anoRef: String(aR), diaAss: String(dia), mesAss: MESES[mA], anoAss: String(aA)
    };
    var bytes;
    try { bytes = FichaPDF.gerar(dados); }
    catch (e) { return fail('Não consegui gerar o PDF: ' + e.message); }

    if ($('salvar').checked) upsertFromForm(nome, end, unit.id, per);

    var filename = ('Atestado - ' + nome + ' - ' + MESES[mR] + ' ' + aR + '.pdf').replace(/[\\\/:*?"<>|]+/g, '');
    currentFile = new File([bytes], filename, { type: 'application/pdf' });
    $('pdfNome').textContent = filename;
    $('compartilhar').hidden = !canShareFile(currentFile);
    openSheet('sheetPdf');
  }
  function upsertFromForm(nome, end, unidadeId, per) {
    var s = cur.studentId ? studentById(cur.studentId) : null;
    if (!s || norm(s.nome) !== norm(nome)) {
      s = db.students.filter(function (x) { return norm(x.nome) === norm(nome); })[0] || null;
    }
    if (!s) { s = { id: uid() }; db.students.push(s); }
    s.nome = nome; s.endereco = end; s.unidadeId = unidadeId; s.periodo = per; s.updated = Date.now();
    cur.studentId = s.id; save(); updatePicker();
  }

  /* ---------------- compartilhar / baixar ---------------- */
  function canShareFile(f) {
    try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] })); } catch (e) { return false; }
  }
  function shareFile(f, title) {
    return navigator.share({ files: [f], title: title }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      toast('Não foi possível compartilhar. Use “Baixar PDF”.');
    });
  }
  function downloadFile(f) {
    var url = URL.createObjectURL(f), a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  /* ---------------- lista de alunos ---------------- */
  function unitName(id) { var u = unitById(id); return u ? u.rotulo : 'Sem unidade'; }
  function studentItem(s, withGo, onMain) {
    var it = el('div', 'item');
    var main = el('button', '', '');
    main.type = 'button';
    main.style.cssText = 'all:unset;flex:1;min-width:0;cursor:pointer';
    var tx = el('div', 'tx');
    tx.appendChild(el('div', 'n', s.nome));
    tx.appendChild(el('div', 's', (PERIODOS[s.periodo] ? PERIODOS[s.periodo].rotulo : '—') + ' · ' + unitName(s.unidadeId)));
    main.appendChild(tx); main.onclick = onMain;
    it.appendChild(main);
    if (withGo) {
      var go = el('button', 'go', 'Gerar ficha'); go.type = 'button';
      go.onclick = function () { showTab('ficha'); selectStudent(s.id); };
      it.appendChild(go);
    }
    return it;
  }
  function renderList(container, q, withGo, onPick) {
    container.innerHTML = '';
    var qq = norm(q || '');
    var list = db.students.filter(function (s) { return !qq || norm(s.nome).indexOf(qq) >= 0; }).sort(byName);
    if (!list.length) {
      container.appendChild(el('div', 'empty', db.students.length ? 'Nenhum aluno encontrado.' : 'Nenhum aluno cadastrado ainda.'));
      return;
    }
    list.forEach(function (s) { container.appendChild(studentItem(s, withGo, function () { onPick(s); })); });
  }
  function renderAlunos() {
    renderList($('listaAlunos'), $('buscaAlunos').value, true, function (s) { editAluno(s.id); });
  }
  function renderPick() {
    renderList($('listaPick'), $('buscaPick').value, false, function (s) { selectStudent(s.id); });
  }

  /* ---------------- editar aluno ---------------- */
  var editingStudent = null;
  function editAluno(id) {
    editingStudent = id;
    var s = id ? studentById(id) : null;
    $('tituloAluno').textContent = s ? 'Editar aluno' : 'Novo aluno';
    fillUnits($('eUnidade'), false);
    $('eNome').value = s ? s.nome : ''; $('eEnd').value = s ? s.endereco : '';
    if (s && unitById(s.unidadeId)) $('eUnidade').value = s.unidadeId;
    setPeriodo('ePeriodo', s ? s.periodo : '');
    $('excluirAluno').hidden = !s;
    openSheet('sheetAluno');
  }
  function salvarAluno() {
    var nome = clean($('eNome').value), end = $('eEnd').value.trim(), uidSel = $('eUnidade').value, per = getPeriodo('ePeriodo');
    if (!nome) return toast('Informe o nome do aluno.');
    if (!end) return toast('Informe o endereço do aluno.');
    if (!uidSel) return toast('Escolha a unidade escolar.');
    if (!per) return toast('Escolha o período.');
    var dup = db.students.filter(function (x) { return x.id !== editingStudent && norm(x.nome) === norm(nome); })[0];
    if (dup) return toast('Já existe um aluno com esse nome.');
    var s = editingStudent ? studentById(editingStudent) : null;
    if (!s) { s = { id: uid() }; db.students.push(s); }
    s.nome = nome; s.endereco = end; s.unidadeId = uidSel; s.periodo = per; s.updated = Date.now();
    save(); closeSheets(); renderAlunos();
    if (cur.studentId === s.id) selectStudent(s.id);
    toast('Aluno salvo.');
  }
  function excluirAluno() {
    var s = studentById(editingStudent); if (!s) return;
    if (!confirm('Excluir “' + s.nome + '” do cadastro?')) return;
    db.students = db.students.filter(function (x) { return x.id !== s.id; });
    if (cur.studentId === s.id) { cur.studentId = null; updatePicker(); }
    save(); closeSheets(); renderAlunos(); toast('Aluno excluído.');
  }

  /* ---------------- unidades ---------------- */
  function renderUnidades() {
    var c = $('listaUnidades'); c.innerHTML = '';
    UNITS.forEach(function (u) {
      var it = el('div', 'item'), tx = el('div', 'tx');
      tx.appendChild(el('div', 'n', u.rotulo)); tx.appendChild(el('div', 's', u.endereco));
      it.appendChild(tx); c.appendChild(it);
    });
  }
  function refreshUnitSelects() { fillUnits($('unidade'), true); showUnitAddress(); }

  /* ---------------- backup ---------------- */
  function exportar() {
    var payload = { app: 'ficha-transporte', version: 1, exportedAt: new Date().toISOString(), students: db.students };
    var t = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    var name = 'fichas-backup-' + t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()) + '.json';
    var f = new File([JSON.stringify(payload, null, 1)], name, { type: 'application/json' });
    if (canShareFile(f)) shareFile(f, name); else { downloadFile(f); toast('Arquivo de backup baixado.'); }
  }
  function importar(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var imp = JSON.parse(r.result);
        if (!imp || !Array.isArray(imp.students)) throw new Error('formato');
        var ns = 0;
        imp.students.forEach(function (s) {
          if (!s || !s.nome) return;
          var un = fixUnit(s.unidadeId || '');
          var ex = studentById(s.id) || db.students.filter(function (x) { return norm(x.nome) === norm(s.nome); })[0];
          if (!ex) { db.students.push({ id: s.id || uid(), nome: clean(s.nome), endereco: String(s.endereco || ''), unidadeId: un, periodo: s.periodo || 'manha', updated: s.updated || 0 }); ns++; }
          else if ((s.updated || 0) > (ex.updated || 0)) { ex.nome = clean(s.nome); ex.endereco = String(s.endereco || ''); ex.unidadeId = un; ex.periodo = s.periodo || ex.periodo; ex.updated = s.updated; ns++; }
        });
        save(); renderUnidades(); refreshUnitSelects(); updatePicker();
        toast('Importado: ' + ns + ' aluno(s) novo(s) ou atualizado(s).');
      } catch (e) { toast('Arquivo inválido. Use um backup exportado por este app.'); }
    };
    r.readAsText(file);
  }

  /* ---------------- eventos ---------------- */
  function init() {
    $('logo').src = 'data:image/jpeg;base64,' + FICHA_ASSETS.logo;
    fillMonths($('mesRef')); fillMonths($('mesAss'));
    fillUnits($('unidade'), false); setToday(); showUnitAddress(); updatePicker(); save();

    Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) {
      b.onclick = function () { showTab(b.getAttribute('data-tab')); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) { b.onclick = closeSheets; });
    $('backdrop').onclick = closeSheets;

    $('pickStudent').onclick = function () { $('buscaPick').value = ''; renderPick(); openSheet('sheetPick'); };
    $('buscaPick').oninput = renderPick;
    $('pickNovo').onclick = function () { editingStudent = null; closeSheets(); showTab('alunos'); editAluno(null); };
    $('clearStudent').onclick = clearStudent;
    $('unidade').onchange = showUnitAddress;
    ['nome', 'endAluno'].forEach(function (i) { $(i).addEventListener('input', updatePicker); });
    $('gerar').onclick = gerar;

    $('buscaAlunos').oninput = renderAlunos;
    $('novoAluno').onclick = function () { editAluno(null); };
    $('salvarAluno').onclick = salvarAluno;
    $('excluirAluno').onclick = excluirAluno;

    $('compartilhar').onclick = function () { if (currentFile) shareFile(currentFile, currentFile.name); };
    $('baixar').onclick = function () { if (currentFile) { downloadFile(currentFile); toast('PDF baixado.'); } };

    $('exportar').onclick = exportar;
    $('importar').onclick = function () { $('arquivoImport').click(); };
    $('arquivoImport').onchange = function () { if (this.files[0]) importar(this.files[0]); this.value = ''; };

    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignora */ }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline é opcional */ });
    }
  }
  init();
})();
