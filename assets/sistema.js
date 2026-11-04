// Cidade na Mão · Monitoramento — visualização das solicitações feitas pelo app, em tempo real.
(() => {
  const $ = s => document.querySelector(s);
  const D = DADOS;
  const rand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pickR = arr => arr[Math.floor(Math.random() * arr.length)];
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dfmt = {
    date: ts => new Date(ts).toLocaleDateString('pt-BR'),
    dt: ts => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    ago(ts) {
      const s = Math.max(0, (Date.now() - ts) / 1000);
      if (s < 10) return 'agora';
      if (s < 60) return `há ${Math.round(s)} s`;
      if (s < 3600) return `há ${Math.round(s / 60)} min`;
      if (s < 86400) return `há ${Math.round(s / 3600)} h`;
      const d = Math.round(s / 86400);
      return d === 1 ? 'há 1 dia' : `há ${d} dias`;
    },
    k: n => n >= 10000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : fmt.n(n),
  };
  const plural = (n, a, b) => `${fmt.n(n)} ${n === 1 ? a : b}`;
  const STATUS = {
    aberta:    { label: 'Aberta',       tone: 'info' },
    andamento: { label: 'Em andamento', tone: 'warning' },
    resolvida: { label: 'Resolvida',    tone: 'success' },
  };
  const tag = (tone, label, ic) => `<span class="tag tone-${tone}">${ic ? icon(ic, 12) : '<span class="dot"></span>'}${fmt.esc(label)}</span>`;
  const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

  // ---------- Estado ----------
  const BASE_CID = D.cidadaos.length;
  const S = {
    city: store.get('cnm:city', CNM.cities[0]),
    sim: store.get('cnm:sim', true),
    sound: store.get('cnm:sound', true),
    sol: [], cid: D.cidadaos, newToday: 0, flash: new Set(), dlg: null,
  };
  function seedState() {
    S.sol = D.solicitacoes.map(o => ({ ...o }));
    S.cid.length = BASE_CID;
    S.newToday = 0;
  }
  const openSol = () => S.sol.filter(s => s.status !== 'resolvida');

  function addSolicitacao(o) {
    const s = { proto: o.proto || D.nextProto(), tipo: o.tipo, sec: o.sec, bairro: o.bairro, status: 'aberta',
      aberta: Date.now(), resolvidaEm: null, cidadao: o.cidadao || D.nome(), desc: o.desc || '', via: o.via };
    S.sol.unshift(s);
    S.flash.add('sol:' + s.proto);
    return s;
  }

  // ---------- Simulação da cidade ----------
  function simulate() {
    if (!S.sim) return;
    const tp = pickR(D.TIPOS);
    addSolicitacao({ tipo: tp.tipo, sec: tp.sec, bairro: pickR(CNM.bairros).id, via: 'sim' });
    S.sol.filter(x => x.status !== 'resolvida' && x.via !== 'app').slice(0, 80).forEach(x => {
      if (Math.random() < .03) { x.status = x.status === 'aberta' ? 'andamento' : 'resolvida'; if (x.status === 'resolvida') x.resolvidaEm = Date.now(); }
    });
    if (Math.random() < .6) {
      S.cid.unshift({ nome: D.nome(), bairro: pickR(CNM.bairros).id, tel: `(92) 9••••-${String(rand(0, 9999)).padStart(4, '0')}`, canal: 'App', cadastro: Date.now(), acesso: Date.now() });
      S.newToday++;
    }
    refresh(true);
  }
  function scheduleSim() { setTimeout(() => { simulate(); scheduleSim(); }, rand(6000, 11000)); }

  // ---------- Solicitações vindas do app ----------
  function onEvent(evt) {
    const p = evt.payload || {};
    if (evt.type === 'report') {
      addSolicitacao({ proto: p.proto, tipo: p.cat, sec: p.sec, bairro: p.bairro, desc: p.desc, cidadao: p.name, via: 'app' });
      toast('info', 'inbox', 'Nova solicitação pelo app', `#${p.proto} · ${p.cat} · ${CNM.bairroNome(p.bairro)}`);
      if (S.sound) { Chime.unlock(); Chime.play('info'); }
      refresh(true);
    }
  }

  // ---------- Lista genérica (busca, filtros, chips, exportar, paginação, ordenação) ----------
  function listPage(cfg) {
    const st = { q: '', f: {}, chip: 'all', sort: cfg.defaultSort || null, dir: cfg.defaultDir || -1, page: 1 };
    let root;
    const size = cfg.pageSize || 20;

    function filtered() {
      const q = st.q.trim().toLowerCase();
      return cfg.data().filter(r => {
        if (q && !cfg.search(r).toLowerCase().includes(q)) return false;
        for (const f of cfg.filters || []) { const v = st.f[f.id]; if (v && !f.test(r, v)) return false; }
        return true;
      });
    }

    function mount(page) {
      const el = document.createElement('div');
      el.className = 'list-root';
      page.appendChild(el);
      root = el;
      const filters = (cfg.filters || []).map(f => `
        <label class="sr-only" for="f-${cfg.key}-${f.id}">${f.label}</label>
        <select class="select" id="f-${cfg.key}-${f.id}" data-f="${f.id}">
          <option value="">${f.label}</option>
          ${f.options().map(([v, l]) => `<option value="${fmt.esc(v)}" ${st.f[f.id] === v ? 'selected' : ''}>${fmt.esc(l)}</option>`).join('')}
        </select>`).join('');
      el.innerHTML = `
        <div class="toolbar">
          <div class="search">${icon('search', 16)}<label class="sr-only" for="q-${cfg.key}">Buscar</label>
            <input class="input" id="q-${cfg.key}" type="search" placeholder="${cfg.placeholder || 'Buscar'}" value="${fmt.esc(st.q)}"></div>
          ${filters}
        </div>
        ${cfg.chips ? `<div class="chips" data-chips></div>` : ''}
        <div class="list-meta">
          <button class="btn btn-ghost" data-export>${icon('download', 16)}Exportar</button>
          <span class="summary" data-summary></span>
          <nav class="pager" data-pager aria-label="Paginação"></nav>
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr>${cfg.columns.map(c => c.sort
            ? `<th><button data-sort="${c.key}">${c.label}<span class="s"></span></button></th>`
            : `<th><span>${c.label}</span></th>`).join('')}</tr></thead>
          <tbody></tbody>
        </table></div>`;
      el.querySelector(`#q-${cfg.key}`).addEventListener('input', e => { st.q = e.target.value; st.page = 1; update(); });
      el.querySelectorAll('[data-f]').forEach(s => s.addEventListener('change', e => { st.f[e.target.dataset.f] = e.target.value; st.page = 1; update(); }));
      el.querySelector('[data-export]').addEventListener('click', () => exportCsv());
      el.querySelector('thead').addEventListener('click', e => {
        const b = e.target.closest('[data-sort]'); if (!b) return;
        if (st.sort === b.dataset.sort) st.dir *= -1; else { st.sort = b.dataset.sort; st.dir = 1; }
        update();
      });
      el.addEventListener('click', e => {
        const chip = e.target.closest('[data-chip]'); if (chip) { st.chip = chip.dataset.chip; st.page = 1; return update(); }
        const pg = e.target.closest('[data-page]'); if (pg && !pg.disabled) { st.page = +pg.dataset.page; return update(); }
        const tr = e.target.closest('tr[data-id]'); if (tr && cfg.onRow) cfg.onRow(tr.dataset.id);
      });
      update();
    }

    function rowsNow() {
      let rows = filtered();
      const counts = {};
      if (cfg.chips) cfg.chips.forEach(([v]) => { counts[v] = v === 'all' ? rows.length : rows.filter(r => cfg.chipTest(r, v)).length; });
      if (cfg.chips && st.chip !== 'all') rows = rows.filter(r => cfg.chipTest(r, st.chip));
      if (st.sort) {
        const col = cfg.columns.find(c => c.key === st.sort);
        rows = rows.slice().sort((a, b) => { const x = col.sort(a), y = col.sort(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
      }
      return { rows, counts };
    }

    function update() {
      if (!root || !root.isConnected) return;
      const { rows, counts } = rowsNow();
      if (cfg.chips) root.querySelector('[data-chips]').innerHTML = cfg.chips.map(([v, l]) =>
        `<button class="chip-btn" data-chip="${v}" aria-pressed="${st.chip === v}">${l}<span class="c">${fmt.n(counts[v])}</span></button>`).join('');
      const pages = Math.max(1, Math.ceil(rows.length / size));
      st.page = Math.min(st.page, pages);
      const from = (st.page - 1) * size;
      const slice = rows.slice(from, from + size);
      root.querySelector('[data-summary]').textContent = rows.length
        ? `${fmt.n(from + 1)}–${fmt.n(from + slice.length)} de ${plural(rows.length, cfg.noun[0], cfg.noun[1])}` : `0 ${cfg.noun[1]}`;
      const nums = [...new Set([1, st.page - 1, st.page, st.page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
      let pg = `<button data-page="${st.page - 1}" ${st.page === 1 ? 'disabled' : ''} aria-label="Página anterior">${icon('back', 16)}</button>`;
      nums.forEach((n, i) => {
        if (i && n - nums[i - 1] > 1) pg += '<span>…</span>';
        pg += `<button data-page="${n}" ${n === st.page ? 'aria-current="page"' : ''}>${n}</button>`;
      });
      pg += `<button data-page="${st.page + 1}" ${st.page === pages ? 'disabled' : ''} aria-label="Próxima página">${icon('next', 16)}</button>`;
      root.querySelector('[data-pager]').innerHTML = pg;
      root.querySelectorAll('[data-sort]').forEach(b => {
        const on = b.dataset.sort === st.sort;
        b.querySelector('.s').textContent = on ? (st.dir > 0 ? '▲' : '▼') : '▲▼';
        b.querySelector('.s').classList.toggle('on', on);
      });
      root.querySelector('tbody').innerHTML = slice.length ? slice.map(r => {
        const id = cfg.rowKey(r);
        const fl = S.flash.has(cfg.key + ':' + id);
        return `<tr data-id="${fmt.esc(id)}" class="${cfg.onRow ? 'clickable' : ''} ${cfg.rowClass ? cfg.rowClass(r) : ''} ${fl ? 'flash' : ''}">${
          cfg.columns.map(c => `<td>${c.render(r)}</td>`).join('')}</tr>`;
      }).join('') : `<tr><td class="empty-row" colspan="${cfg.columns.length}">Nenhum resultado para os filtros escolhidos.</td></tr>`;
    }

    function exportCsv() {
      const { rows } = rowsNow();
      const cols = cfg.columns.filter(c => c.csv);
      const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = '﻿' + [cols.map(c => esc(c.label)).join(';'), ...rows.map(r => cols.map(c => esc(c.csv(r))).join(';'))].join('\r\n');
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `${cfg.key}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        toast('success', 'download', 'Planilha exportada', plural(rows.length, 'linha', 'linhas'));
      } catch { toast('danger', 'alert', 'Não foi possível exportar', 'Tente novamente pelo navegador.'); }
    }

    return { mount, update };
  }
  const bairroOpts = () => CNM.bairros.map(b => [b.id, b.nome]);
  const statusTag = s => tag(STATUS[s.status].tone, STATUS[s.status].label);

  // ---------- Páginas ----------
  const PAGES = {};

  PAGES.painel = {
    title: 'Painel', icon: 'layout',
    mount(el) {
      el.innerHTML = `
        <section class="kpis" id="kpis" aria-label="Indicadores"></section>
        <section class="card">
          <div class="card-head"><div><h2>Solicitações por mês em ${D.YEAR}</h2><p>Pedidos de serviço feitos pelos cidadãos no app</p></div>
            <a class="link-btn" href="#/solicitacoes">Ver solicitações ${icon('next', 14)}</a></div>
          <div class="vchart" id="vchart"></div>
        </section>
        <div class="grid2">
          <section class="card"><div class="card-head"><div><h2>Por secretaria em ${D.YEAR}</h2><p>Solicitações por área responsável</p></div></div><div class="hbars" id="bySec"></div></section>
          <section class="card"><div class="card-head"><div><h2>Por bairro em ${D.YEAR}</h2><p>Bairros que mais pediram serviços</p></div></div><div class="hbars" id="byBairro"></div></section>
        </div>
        <section class="card">
          <div class="card-head"><div><h2>Últimas solicitações</h2><p>Chegando do app em tempo real</p></div><a class="link-btn" href="#/solicitacoes">Ver todas ${icon('next', 14)}</a></div>
          <div class="table-wrap"><table class="data"><thead><tr><th><span>Situação</span></th><th><span>Protocolo</span></th><th><span>Tipo</span></th><th><span>Secretaria</span></th><th><span>Bairro</span></th><th><span>Recebida</span></th></tr></thead><tbody id="lastSol"></tbody></table></div>
        </section>`;
      el.querySelector('#lastSol').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) openSolDialog(tr.dataset.id); });
    },
    update() {
      const sol = S.sol, open = openSol();
      const ab = open.filter(s => s.status === 'aberta').length;
      const today = sol.filter(s => s.aberta >= startOfDay()).length;
      const res = sol.filter(s => s.status === 'resolvida');
      const resToday = res.filter(s => s.resolvidaEm >= startOfDay()).length;
      const avgH = res.length ? Math.round(res.reduce((t, s) => t + (s.resolvidaEm - s.aberta), 0) / res.length / 3600e3) : 0;
      const k = (href, label, value, sub) => `<a class="kpi" href="${href}"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span><span class="kpi-sub">${sub}</span></a>`;
      $('#kpis').innerHTML =
        k('#/solicitacoes', 'Recebidas hoje', fmt.n(today), `${plural(resToday, 'resolvida', 'resolvidas')} hoje`) +
        k('#/solicitacoes', 'Aguardando atendimento', fmt.n(ab), 'Abertas, ainda sem secretaria') +
        k('#/solicitacoes', 'Em andamento', fmt.n(open.length - ab), 'Encaminhadas às secretarias') +
        k('#/solicitacoes', `Resolvidas em ${D.YEAR}`, fmt.n(res.length), `Tempo médio de ${avgH} h por solicitação`) +
        k('#/cidadaos', 'Cidadãos com o app', fmt.n(S.cid.length), `${plural(S.newToday + 34, 'cadastro', 'cadastros')} hoje`);

      const nowM = new Date().getMonth();
      const byM = Array(12).fill(0);
      sol.forEach(s => { const d = new Date(s.aberta); if (d.getFullYear() === D.YEAR) byM[d.getMonth()]++; });
      const maxM = Math.max(...byM, 1);
      $('#vchart').innerHTML = byM.map((v, m) => `
        <div class="vcol ${m === nowM ? 'now' : ''} ${m > nowM ? 'future' : ''}">
          <span class="v">${m > nowM ? '' : fmt.n(v)}</span>
          <div class="track"><div class="fill" style="height:${m > nowM ? 0 : Math.max(1, (v / maxM) * 100)}%"></div></div>
          <span class="m">${MESES[m]}</span>
        </div>`).join('');

      const hb = pairs => { const mx = Math.max(...pairs.map(p => p[1]), 1); return pairs.map(([n, v]) => `<div class="hbar"><span class="n" title="${fmt.esc(n)}">${fmt.esc(n)}</span><span class="t"><i style="width:${(v / mx) * 100}%"></i></span><span class="v">${fmt.n(v)}</span></div>`).join(''); };
      $('#bySec').innerHTML = hb(D.SECRETARIAS.map(n => [n, sol.filter(s => s.sec === n).length]).sort((a, b) => b[1] - a[1]));
      $('#byBairro').innerHTML = hb(CNM.bairros.map(b => [b.nome, sol.filter(s => s.bairro === b.id).length]).sort((a, b) => b[1] - a[1]));

      $('#lastSol').innerHTML = sol.slice(0, 8).map(s => `
        <tr data-id="${s.proto}" class="clickable ${s.via === 'app' ? 'hl' : ''} ${S.flash.has('sol:' + s.proto) ? 'flash' : ''}">
          <td>${statusTag(s)}</td>
          <td class="mono">${s.proto}</td>
          <td><span class="strong">${fmt.esc(s.tipo)}</span><span class="sub">${fmt.esc(s.cidadao)}</span></td>
          <td>${fmt.esc(s.sec)}</td>
          <td>${fmt.esc(CNM.bairroNome(s.bairro))}</td>
          <td>${dfmt.ago(s.aberta)}</td>
        </tr>`).join('');
    },
  };

  const solList = listPage({
    key: 'sol', noun: ['solicitação', 'solicitações'], placeholder: 'Protocolo, tipo ou cidadão',
    data: () => S.sol, rowKey: s => s.proto, search: s => `${s.proto} ${s.tipo} ${s.cidadao}`,
    filters: [
      { id: 'sec', label: 'Secretaria', options: () => D.SECRETARIAS.map(s => [s, s]), test: (s, v) => s.sec === v },
      { id: 'b', label: 'Bairro', options: bairroOpts, test: (s, v) => s.bairro === v },
      { id: 'tipo', label: 'Tipo', options: () => D.TIPOS.map(t => [t.tipo, t.tipo]), test: (s, v) => s.tipo === v },
    ],
    chips: [['all', 'Todas'], ['aberta', 'Aberta'], ['andamento', 'Em andamento'], ['resolvida', 'Resolvida']],
    chipTest: (s, v) => s.status === v,
    rowClass: s => s.via === 'app' ? 'hl' : '',
    onRow: proto => openSolDialog(proto),
    columns: [
      { key: 'st', label: 'Situação', sort: s => ['aberta', 'andamento', 'resolvida'].indexOf(s.status), render: statusTag, csv: s => STATUS[s.status].label },
      { key: 'proto', label: 'Protocolo', sort: s => s.proto, render: s => `<span class="mono">${s.proto}</span>`, csv: s => s.proto },
      { key: 'tipo', label: 'Tipo', sort: s => s.tipo, render: s => `<span class="strong">${fmt.esc(s.tipo)}</span>${s.via === 'app' ? `<span class="sub" style="color:var(--fg-brand)">Recebida agora</span>` : ''}`, csv: s => s.tipo },
      { key: 'cid', label: 'Cidadão', sort: s => s.cidadao, render: s => fmt.esc(s.cidadao), csv: s => s.cidadao },
      { key: 'sec', label: 'Secretaria', sort: s => s.sec, render: s => fmt.esc(s.sec), csv: s => s.sec },
      { key: 'b', label: 'Bairro', sort: s => CNM.bairroNome(s.bairro), render: s => fmt.esc(CNM.bairroNome(s.bairro)), csv: s => CNM.bairroNome(s.bairro) },
      { key: 'at', label: 'Recebida em', sort: s => s.aberta, render: s => `${dfmt.date(s.aberta)}<span class="sub">${dfmt.ago(s.aberta)}</span>`, csv: s => dfmt.dt(s.aberta) },
      { key: 'res', label: 'Resolvida em', sort: s => s.resolvidaEm || 0, render: s => s.resolvidaEm ? dfmt.date(s.resolvidaEm) : '<span class="dim">—</span>', csv: s => s.resolvidaEm ? dfmt.dt(s.resolvidaEm) : '' },
    ],
  });
  PAGES.solicitacoes = { title: 'Solicitações', icon: 'inbox', count: () => openSol().length, mount: el => solList.mount(el), update: () => solList.update() };

  const cidList = listPage({
    key: 'cid', noun: ['cidadão', 'cidadãos'], placeholder: 'Nome ou telefone',
    data: () => S.cid, rowKey: c => c.nome + c.cadastro, search: c => c.nome + ' ' + c.tel,
    filters: [{ id: 'b', label: 'Bairro', options: bairroOpts, test: (c, v) => c.bairro === v }],
    defaultSort: 'cad', defaultDir: -1,
    columns: [
      { key: 'nome', label: 'Nome', sort: c => c.nome, render: c => `<span class="strong">${fmt.esc(c.nome)}</span>`, csv: c => c.nome },
      { key: 'b', label: 'Bairro', sort: c => CNM.bairroNome(c.bairro), render: c => fmt.esc(CNM.bairroNome(c.bairro)), csv: c => CNM.bairroNome(c.bairro) },
      { key: 'tel', label: 'Telefone', render: c => `<span class="mono">${c.tel}</span>`, csv: c => c.tel },
      { key: 'cad', label: 'Cadastro no app', sort: c => c.cadastro, render: c => dfmt.date(c.cadastro), csv: c => dfmt.date(c.cadastro) },
      { key: 'ac', label: 'Último acesso', sort: c => c.acesso, render: c => dfmt.ago(c.acesso), csv: c => dfmt.date(c.acesso) },
    ],
  });
  PAGES.cidadaos = { title: 'Cidadãos com o app', nav: 'Cidadãos', icon: 'users', count: () => dfmt.k(S.cid.length), mount: el => cidList.mount(el), update: () => cidList.update() };

  PAGES.config = {
    title: 'Configurações', icon: 'settings',
    mount(el) {
      el.innerHTML = `
        <div class="settings">
          <section class="card"><div class="card-head"><div><h2>Município</h2><p>Nome exibido no sistema</p></div></div>
            <div class="field"><label for="citySel">Município da demonstração</label><select id="citySel" class="select">${CNM.cities.map(c => `<option ${c === S.city ? 'selected' : ''}>${c}</option>`).join('')}</select></div></section>
          <section class="card"><div class="card-head"><div><h2>Aparência e som</h2></div></div>
            <div class="set-row"><span><strong>Tema escuro</strong><small>Recomendado para projetar em sala escura</small></span><button class="switch" role="switch" id="swTheme" aria-checked="${document.documentElement.dataset.theme === 'dark'}" aria-label="Tema escuro"></button></div>
            <div class="set-row"><span><strong>Som de nova solicitação</strong><small>Toca quando chega uma solicitação pelo app</small></span><button class="switch" role="switch" id="swSound" aria-checked="${S.sound}" aria-label="Som de nova solicitação"></button></div></section>
          <section class="card"><div class="card-head"><div><h2>Demonstração</h2></div></div>
            <div class="set-row"><span><strong>Simular atividade da cidade</strong><small>Novas solicitações e cadastros chegam a cada 6 a 11 segundos</small></span><button class="switch" role="switch" id="swSim" aria-checked="${S.sim}" aria-label="Simular atividade"></button></div>
            <div class="set-row"><span><strong>Reiniciar demonstração</strong><small>Volta os números ao início e apaga as solicitações recebidas hoje</small></span><button class="btn btn-secondary" id="resetBtn">${icon('reset', 16)}Reiniciar</button></div></section>
        </div>`;
      $('#citySel').addEventListener('change', e => { S.city = e.target.value; store.set('cnm:city', S.city); renderCity(); Bus.emit('config', { city: S.city }); toast('success', 'check', 'Município alterado', S.city); });
      const sw = (id, fn) => $(id).addEventListener('click', e => { const v = e.currentTarget.getAttribute('aria-checked') !== 'true'; e.currentTarget.setAttribute('aria-checked', v); fn(v); });
      sw('#swTheme', v => setTheme(v ? 'dark' : 'light'));
      sw('#swSound', v => { S.sound = v; store.set('cnm:sound', v); });
      sw('#swSim', v => { S.sim = v; store.set('cnm:sim', v); });
      $('#resetBtn').addEventListener('click', confirmReset);
    },
    update() {},
  };

  // ---------- Diálogos ----------
  const dlg = $('#dlg');
  dlg.addEventListener('close', () => { S.dlg = null; dlg.className = 'dialog'; });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  function openSolDialog(proto) { S.dlg = { type: 'sol', id: proto }; dlg.className = 'dialog wide'; renderDialog(); if (!dlg.open) dlg.showModal(); }

  function renderDialog() {
    if (!S.dlg || S.dlg.type !== 'sol') return;
    const s = S.sol.find(x => x.proto === S.dlg.id); if (!s) return dlg.close();
    dlg.innerHTML = `<div class="dialog-body">
      <div style="display:flex;gap:6px;flex-wrap:wrap">${statusTag(s)}${s.via === 'app' ? tag('brand', 'Recebida agora pelo app', 'phone') : ''}</div>
      <h3>${fmt.esc(s.tipo)}</h3>
      <dl class="kv"><dt>Protocolo</dt><dd class="mono">${s.proto}</dd><dt>Cidadão</dt><dd>${fmt.esc(s.cidadao)}</dd><dt>Bairro</dt><dd>${fmt.esc(CNM.bairroNome(s.bairro))}</dd>
        <dt>Secretaria</dt><dd>${fmt.esc(s.sec)}</dd><dt>Recebida em</dt><dd>${dfmt.dt(s.aberta)}</dd>
        ${s.resolvidaEm ? `<dt>Resolvida em</dt><dd>${dfmt.dt(s.resolvidaEm)}</dd>` : ''}${s.desc ? `<dt>Descrição</dt><dd>${fmt.esc(s.desc)}</dd>` : ''}</dl>
    </div>
    <div class="dialog-actions"><button class="btn btn-primary" data-close>Fechar</button></div>`;
    dlg.querySelector('[data-close]').onclick = () => dlg.close();
  }

  function confirmReset() {
    S.dlg = { type: 'reset' }; dlg.className = 'dialog';
    dlg.innerHTML = `<div class="dialog-body"><h3>Reiniciar a demonstração?</h3>
      <p class="muted">As solicitações recebidas hoje serão apagadas e os números voltam ao início. Isso não pode ser desfeito.</p></div>
      <div class="dialog-actions"><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-danger" id="doReset">Reiniciar</button></div>`;
    dlg.querySelector('[data-close]').onclick = () => dlg.close();
    dlg.querySelector('#doReset').onclick = () => {
      dlg.close(); seedState(); Bus.emit('reset', {});
      toast('success', 'reset', 'Demonstração reiniciada', 'Os números voltaram ao início.'); refresh(true);
    };
    dlg.showModal();
  }

  // ---------- Toasts ----------
  function toast(tone, ic, title, sub) {
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.innerHTML = `${icon(ic, 18)}<div><strong>${fmt.esc(title)}</strong><span>${fmt.esc(sub)}</span></div>`;
    $('#toasts').prepend(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 4500);
    const all = $('#toasts').children; if (all.length > 4) all[all.length - 1].remove();
  }

  // ---------- Casca ----------
  const NAV = [['painel'], ['Atendimento', 'solicitacoes'], ['Cidadãos', 'cidadaos']];
  let route = 'painel';

  function renderNav() {
    const link = k => { const p = PAGES[k]; const c = p.count ? p.count() : '';
      return `<a class="sb-link" href="#/${k}" ${k === route ? 'aria-current="page"' : ''}>${icon(p.icon, 18)}<span>${p.nav || p.title}</span>${c !== '' && c !== 0 ? `<span class="sb-count">${typeof c === 'number' ? fmt.n(c) : c}</span>` : ''}</a>`; };
    $('#nav').innerHTML = NAV.map(g => g.length === 1 ? link(g[0]) : `<div class="sb-group">${g[0]}</div>` + g.slice(1).map(link).join('')).join('');
    $('#navBottom').innerHTML = link('config') + `<a class="sb-link" href="login.html" id="logout">${icon('back', 18)}<span>Sair</span></a>`;
    $('#logout').onclick = () => { try { sessionStorage.removeItem('cnm:auth'); } catch {} };
  }
  function renderCity() { $('#userName').textContent = `Prefeitura de ${S.city}`; }

  function go() {
    const k = (location.hash.match(/^#\/([\w-]+)/) || [])[1];
    route = PAGES[k] ? k : 'painel';
    const p = PAGES[route];
    $('#pageTitle').textContent = p.title;
    document.title = `${p.title} · Cidade na Mão`;
    const page = $('#page');
    page.innerHTML = '';
    p.mount(page);
    p.update();
    renderNav();
    document.body.classList.remove('nav-open');
    scrollTo(0, 0);
  }

  let rafPending = false, navPending = false;
  function refresh(withNav) {
    if (withNav) navPending = true;
    if (rafPending) return;
    rafPending = true;
    setTimeout(() => {
      rafPending = false;
      PAGES[route].update();
      if (navPending) { renderNav(); navPending = false; }
      if (S.dlg) renderDialog();
      if (S.flash.size) setTimeout(() => S.flash.clear(), 50);
    }, 0);
  }

  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('cnm:theme', t); } catch {}
    $('#themeBtn').innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 18);
  }

  function initShell() {
    $('#menuBtn').innerHTML = icon('menu', 20);
    $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
    $('#scrim').onclick = () => document.body.classList.remove('nav-open');
    $('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    setTheme(document.documentElement.dataset.theme || 'dark');
    $('#dataDate').textContent = `Dados de ${dfmt.date(Date.now())}`;
    renderCity();
    addEventListener('hashchange', go);
    document.addEventListener('pointerdown', () => Chime.unlock(), { once: true });
  }

  // ---------- Início ----------
  (async () => {
    seedState();
    initShell();
    await Bus.init();
    $('#liveText').textContent = 'Ao vivo';
    Bus.on(onEvent);
    go();
    setInterval(() => refresh(true), 15000);
    scheduleSim();
  })();
})();
