// App do cidadão — recebe os alertas do painel em tempo real e envia respostas e solicitações.
(() => {
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const EMBED = params.has('embed');
  const MOBILE = !EMBED && (matchMedia('(max-width: 540px)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
  document.body.classList.toggle('embed', EMBED);
  document.body.classList.toggle('mobile', MOBILE);

  const STATE_KEY = 'cnm:app:' + (EMBED ? 'embed' : 'std');
  const DEMANDAS = [
    { cat: 'Buraco na via', sec: 'Infraestrutura' },
    { cat: 'Iluminação pública apagada', sec: 'Infraestrutura' },
    { cat: 'Coleta de lixo atrasada', sec: 'Meio ambiente' },
    { cat: 'Rua alagada', sec: 'Defesa Civil' },
    { cat: 'Árvore com risco de queda', sec: 'Defesa Civil' },
    { cat: 'Falta de medicamento na UBS', sec: 'Saúde' },
    { cat: 'Vaga em creche', sec: 'Educação' },
    { cat: 'Sugestão ao prefeito', sec: 'Gabinete' },
  ];
  const STATUS = { aberta: ['Recebida', 'info', 1], andamento: ['Em andamento', 'warning', 2], resolvida: ['Resolvida', 'success', 3] };

  const saved = store.get(STATE_KEY, {});
  const S = {
    city: (store.get('cnm:config', null) || {}).city || 'Urucurituba',
    alerts: [],
    read: saved.read || {},
    resp: saved.resp || {},
    reports: saved.reports || [],
    profile: saved.profile || { name: 'Maria Souza', bairro: 'beirario' },
    view: 'home', param: null, history: [],
  };
  const persist = () => store.set(STATE_KEY, { read: S.read, resp: S.resp, reports: S.reports, profile: S.profile });
  const unread = () => S.alerts.filter(a => !S.read[a.id]).length;
  const lv = a => CNM.levels[a.payload.level] || CNM.levels.info;

  // ---------- Navegação ----------
  function go(view, param, push = true) {
    if (push && S.view !== view) S.history.push([S.view, S.param]);
    S.view = view; S.param = param;
    render();
    $('#view').scrollTop = 0;
  }
  function back() { const [v, p] = S.history.pop() || ['home', null]; S.view = v; S.param = p; render(); }

  function renderTabs() {
    const tabs = [['home', 'home', 'Início'], ['alerts', 'bell', 'Alertas'], ['reports', 'inbox', 'Solicitações'], ['profile', 'user', 'Perfil']];
    const root = { detail: 'alerts', report: 'reports', done: 'reports' }[S.view] || S.view;
    const n = unread();
    $('#tabbar').innerHTML = tabs.map(([v, ic, label]) => `
      <button class="tab" data-tab="${v}" ${root === v ? 'aria-current="page"' : ''}>
        <span class="pill">${icon(ic, 20)}</span>${label}
        ${v === 'alerts' && n ? `<span class="badge-n" aria-label="${n} não lidos">${n}</span>` : ''}
      </button>`).join('');
  }
  $('#tabbar').addEventListener('click', e => {
    const t = e.target.closest('[data-tab]'); if (!t) return;
    S.history = []; go(t.dataset.tab, null, false);
  });

  // ---------- Telas ----------
  const header = (title, withBack = true) => `
    <div class="bar-head">
      ${withBack ? `<button class="btn-icon" data-act="back" aria-label="Voltar">${icon('back', 22)}</button>` : ''}
      <h1>${title}</h1>
    </div>`;

  function alertItem(a) {
    const l = lv(a);
    return `
      <button class="item ${S.read[a.id] ? '' : 'unread'}" data-open="${a.id}">
        <span class="i-ic tone-${l.tone}">${icon(l.icon, 18)}</span>
        <span class="i-top"><span class="badge tone-${l.tone}">${l.label}</span><span class="i-meta">${fmt.ago(a.at)}</span></span>
        <span class="i-title">${fmt.esc(a.payload.title)}</span>
        <span class="i-meta">${fmt.esc(a.payload.cat)} · ${fmt.esc(CNM.bairroNome(a.payload.target))}</span>
      </button>`;
  }

  const VIEWS = {
    home() {
      const first = S.profile.name.split(' ')[0];
      const active = S.alerts.find(a => Date.now() - a.at < 3 * 3600 * 1000);
      const n = unread();
      const menu = [
        ['user', 'Minhas informações', 'soon'], ['message', 'Fale com o prefeito', 'report'],
        ['landmark', 'Serviços', 'soon'], ['help', 'Pergunta cidade', 'soon'],
        ['building', 'Nossa cidade', 'soon'], ['megaphone', 'Notícias e informes', 'soon'],
      ];
      return `
        <section class="hero">
          <div class="hero-top">
            <button class="btn-icon" aria-label="Menu" data-act="soon">${icon('menu', 22)}</button>
            <button class="btn-icon" aria-label="Alertas" data-tab-go="alerts">${icon('bell', 22)}</button>
          </div>
          <div class="crest">
            <div class="crest-badge">${icon('shield', 28)}</div>
            <div><small>Prefeitura municipal de</small><strong>${fmt.esc(S.city)}</strong></div>
          </div>
          <div class="hello">Olá, ${fmt.esc(first)}. O que você precisa hoje?</div>
        </section>
        <div class="view-pad">
          ${active ? `
            <button class="active-alert ${lv(active).tone}" data-open="${active.id}">
              <span class="row"><span class="badge tone-${lv(active).tone}">${icon(lv(active).icon, 12)}${lv(active).label} · ${fmt.esc(active.payload.cat)}</span><span class="subtle" style="font-size:12px">${fmt.ago(active.at)}</span></span>
              <strong>${fmt.esc(active.payload.title)}</strong>
              <span class="more">Ver orientações ${icon('back', 14).replace('<svg', '<svg style="transform:rotate(180deg)"')}</span>
            </button>` : ''}
          <div class="menu">
            ${menu.map(([ic, label, act]) => `<button class="menu-btn" data-act="${act}">${icon(ic, 20)}${label}</button>`).join('')}
            <button class="menu-btn" data-tab-go="alerts">${icon('bell', 20)}Alertas e avisos${n ? `<span class="count">${n}</span>` : ''}</button>
            <button class="menu-btn alt" data-act="report">${icon('plus', 20)}Solicitar serviço</button>
          </div>
        </div>`;
    },

    alerts() {
      return header('Alertas e avisos', false) + `<div class="view-pad">
        ${S.alerts.length ? `<div class="list">${S.alerts.map(alertItem).join('')}</div>` :
          `<div class="empty">${icon('bell', 40)}<strong>Nenhum alerta por enquanto</strong><span>Os avisos da prefeitura aparecem aqui assim que forem enviados.</span></div>`}
      </div>`;
    },

    detail(id) {
      const a = S.alerts.find(x => x.id === id);
      if (!a) return VIEWS.alerts();
      const l = lv(a), p = a.payload, r = S.resp[a.id];
      let answer = '';
      if (p.level === 'critical') {
        answer = r ? `
          <div class="answered tone-${r.answer === 'safe' ? 'success' : 'danger'}">
            ${icon(r.answer === 'safe' ? 'shieldCheck' : 'sos', 20)}
            <span>Você respondeu <strong>${r.answer === 'safe' ? 'Estou seguro' : 'Preciso de ajuda'}</strong> às ${fmt.time(r.at)}. ${r.answer === 'safe' ? 'A Defesa Civil foi avisada.' : 'Uma equipe da Defesa Civil vai entrar em contato.'}</span>
          </div>` : `
          <div class="answer">
            <button class="btn btn-primary btn-lg" data-answer="safe" data-id="${a.id}">${icon('shieldCheck', 18)}Estou seguro</button>
            <button class="btn btn-secondary btn-lg" data-answer="help" data-id="${a.id}">${icon('sos', 18)}Preciso de ajuda</button>
          </div>`;
      }
      return header('Alerta') + `<div class="view-pad detail">
        <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="badge tone-${l.tone}">${icon(l.icon, 12)}${l.label}</span><span class="badge tone-neutral">${fmt.esc(p.cat)}</span></div>
        <h2>${fmt.esc(p.title)}</h2>
        <p class="body">${fmt.esc(p.msg)}</p>
        <div class="facts">
          <div>${icon('pin', 16)}Área: <strong>${fmt.esc(CNM.bairroNome(p.target))}</strong></div>
          <div>${icon('landmark', 16)}Enviado por: <strong>${fmt.esc(p.from || 'Prefeitura')}</strong></div>
          <div>${icon('clock', 16)}Recebido às <strong>${fmt.time(a.at)}</strong></div>
        </div>
        ${answer}
      </div>`;
    },

    report() {
      return header('Solicitar serviço') + `<div class="view-pad">
        <form class="form" id="reportForm">
          <div class="field"><label for="rCat">O que aconteceu</label>
            <select id="rCat" class="select">${DEMANDAS.map((d, i) => `<option value="${i}">${d.cat}</option>`).join('')}</select></div>
          <div class="field"><label for="rBairro">Bairro</label>
            <select id="rBairro" class="select">${CNM.bairros.map(b => `<option value="${b.id}" ${b.id === S.profile.bairro ? 'selected' : ''}>${b.nome}</option>`).join('')}</select></div>
          <div class="field"><label for="rDesc">Descrição</label>
            <textarea id="rDesc" class="textarea" maxlength="200" placeholder="Ex.: Buraco grande em frente ao número 120, perto da escola.">Buraco grande em frente à escola, carros desviando pela contramão.</textarea></div>
          <button class="btn btn-primary btn-lg" type="submit">${icon('send', 18)}Enviar solicitação</button>
          <p class="subtle" style="font-size:12px;text-align:center">Sua solicitação chega direto na secretaria responsável.</p>
        </form>
      </div>`;
    },

    done(proto) {
      return header('Solicitação enviada') + `<div class="done">
        <div class="big">${icon('check', 32)}</div>
        <h2>Recebemos sua solicitação</h2>
        <span class="muted">Guarde o número do protocolo. Você será avisado aqui a cada atualização.</span>
        <span class="proto">#${fmt.esc(proto)}</span>
        <button class="btn btn-primary btn-lg" data-tab-go="reports" style="width:100%">Acompanhar solicitação</button>
      </div>`;
    },

    reports() {
      return header('Minhas solicitações', false) + `<div class="view-pad">
        ${S.reports.length ? `<div class="list">${S.reports.map(r => {
          const [label, tone, step] = STATUS[r.status] || STATUS.aberta;
          return `<div class="item" style="cursor:default">
            <span class="i-ic tone-${tone}">${icon('file', 18)}</span>
            <span class="i-top"><span class="badge tone-${tone}"><span class="dot"></span>${label}</span><span class="i-meta">${fmt.ago(r.updated || r.at)}</span></span>
            <span class="i-title">${fmt.esc(r.cat)}</span>
            <span class="i-meta"><span class="mono">#${fmt.esc(r.proto)}</span> · ${fmt.esc(r.sec)}</span>
            <span class="steps">${[1, 2, 3].map(s => `<i class="${s <= step ? 'on' : ''}"></i>`).join('')}</span>
          </div>`;
        }).join('')}</div>` : `<div class="empty">${icon('inbox', 40)}<strong>Nenhuma solicitação ainda</strong><span>Peça um serviço e acompanhe cada etapa por aqui.</span></div>`}
        <button class="menu-btn alt" data-act="report">${icon('plus', 20)}Nova solicitação</button>
      </div>`;
    },

    profile() {
      const ini = S.profile.name.split(' ').map(s => s[0]).slice(0, 2).join('');
      return header('Perfil', false) + `<div class="view-pad">
        <div class="profile-card"><div class="avatar">${fmt.esc(ini)}</div>
          <div><strong style="color:var(--fg-strong)">${fmt.esc(S.profile.name)}</strong><div class="muted" style="font-size:13px">Cidadã de ${fmt.esc(S.city)}</div></div></div>
        <div class="field"><label for="pBairro">Meu bairro</label>
          <select id="pBairro" class="select">${CNM.bairros.map(b => `<option value="${b.id}" ${b.id === S.profile.bairro ? 'selected' : ''}>${b.nome}</option>`).join('')}</select></div>
        <div class="section-title">Notificações</div>
        <div class="setting"><span>Alertas da Defesa Civil<small>Sempre ativos para sua segurança</small></span><i class="switch" aria-label="Ativado"></i></div>
        <div class="setting"><span>Saúde e vacinação<small>Campanhas e avisos das UBS</small></span><i class="switch" aria-label="Ativado"></i></div>
        <div class="setting"><span>Obras e serviços<small>Interdições, água e energia</small></span><i class="switch" aria-label="Ativado"></i></div>
        <div class="section-title">Conexão</div>
        <div class="setting"><span>Painel da prefeitura<small>${Bus.mode === 'server' ? 'Conectado pela rede, em tempo real' : 'Conectado neste computador, em tempo real'}</small></span><span class="badge tone-success"><span class="dot"></span>Online</span></div>
      </div>`;
    },
  };

  function render() {
    const fn = VIEWS[S.view] || VIEWS.home;
    $('#view').innerHTML = fn(S.param);
    renderTabs();
    if (S.view === 'detail' && S.param && !S.read[S.param]) markRead(S.param);
  }

  // ---------- Ações ----------
  $('#screen').addEventListener('click', e => {
    const t = e.target;
    const open = t.closest('[data-open]'); if (open) return go('detail', open.dataset.open);
    const tabGo = t.closest('[data-tab-go]'); if (tabGo) { S.history = []; return go(tabGo.dataset.tabGo, null, false); }
    const ans = t.closest('[data-answer]'); if (ans) return answer(ans.dataset.id, ans.dataset.answer);
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'back') return back();
      if (a === 'report') return go('report');
      if (a === 'soon') return snack('Disponível na versão completa do app.');
    }
  });

  $('#screen').addEventListener('submit', e => {
    if (e.target.id !== 'reportForm') return;
    e.preventDefault();
    const d = DEMANDAS[+$('#rCat').value];
    const proto = `${new Date().getFullYear()}-${String(2600 + Math.floor(Math.random() * 400)).padStart(6, '0')}`;
    const r = { proto, cat: d.cat, sec: d.sec, bairro: $('#rBairro').value, desc: $('#rDesc').value.trim(), status: 'aberta', at: Date.now() };
    S.reports.unshift(r); persist();
    Bus.emit('report', { ...r, name: S.profile.name, embed: EMBED, mobile: MOBILE });
    S.history = []; go('done', proto, false);
  });

  $('#screen').addEventListener('change', e => {
    if (e.target.id === 'pBairro') { S.profile.bairro = e.target.value; persist(); }
  });

  function markRead(id) {
    S.read[id] = true; persist();
    Bus.emit('read', { alertId: id });
    renderTabs();
  }

  function answer(id, ans) {
    S.resp[id] = { answer: ans, at: Date.now() }; S.read[id] = true; persist();
    Bus.emit('response', { alertId: id, answer: ans, name: S.profile.name, bairro: S.profile.bairro });
    hideCritical();
    S.history = []; go('detail', id, false);
    snack(ans === 'safe' ? 'Resposta enviada. Obrigado por avisar.' : 'Pedido de ajuda enviado à Defesa Civil.');
  }

  function snack(text) {
    document.querySelectorAll('.snack').forEach(n => n.remove());
    const el = document.createElement('div'); el.className = 'snack'; el.textContent = text;
    $('#screen').appendChild(el); setTimeout(() => el.remove(), 2800);
  }

  // ---------- Notificações ----------
  let pushTimer = null;
  function showPush({ tone, title, msg, label, onOpen }) {
    const el = $('#push');
    clearTimeout(pushTimer);
    el.className = `push ${tone || ''}`;
    el.innerHTML = `
      <div class="p-icon">CM</div>
      <div class="p-top"><b>Cidade na Mão · ${fmt.esc(label)}</b><span>agora</span></div>
      <div class="p-title">${fmt.esc(title)}</div>
      <div class="p-msg">${fmt.esc(msg)}</div>`;
    el.hidden = false;
    el.onclick = () => { hidePush(); onOpen && onOpen(); };
    pushTimer = setTimeout(hidePush, 7000);
  }
  function hidePush() {
    const el = $('#push'); if (el.hidden) return;
    el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 300);
  }

  function showCritical(a) {
    const p = a.payload, el = $('#critical');
    el.innerHTML = `
      <div class="c-ic">${icon('alert', 36)}</div>
      <div class="c-kicker">Alerta crítico · ${fmt.esc(p.cat)}</div>
      <h2 id="critTitle">${fmt.esc(p.title)}</h2>
      <p>${fmt.esc(p.msg)}</p>
      <span class="c-area">${icon('pin', 16)}${fmt.esc(CNM.bairroNome(p.target))}</span>
      <div class="c-actions">
        <button class="btn btn-safe" data-answer="safe" data-id="${a.id}">${icon('shieldCheck', 20)}Estou seguro</button>
        <button class="btn btn-help" data-answer="help" data-id="${a.id}">${icon('sos', 20)}Preciso de ajuda</button>
        <button class="btn btn-later" data-crit-later>Ver depois</button>
      </div>`;
    el.hidden = false;
    el.querySelector('[data-crit-later]').onclick = () => { hideCritical(); markRead(a.id); };
  }
  function hideCritical() { $('#critical').hidden = true; }

  function vibrate(pattern) { try { navigator.vibrate && navigator.vibrate(pattern); } catch {} }

  function receiveAlert(evt, live) {
    if (S.alerts.some(a => a.id === evt.id)) return;
    S.alerts.unshift(evt);
    S.alerts.sort((a, b) => b.at - a.at);
    if (!live) return;
    Bus.emit('delivered', { alertId: evt.id, embed: EMBED, mobile: MOBILE });
    const p = evt.payload, l = lv(evt);
    if (p.city) S.city = p.city;
    if (!EMBED) Chime.play(p.level);
    vibrate(p.level === 'critical' ? [400, 150, 400, 150, 600] : [200, 100, 200]);
    if (p.level === 'critical') showCritical(evt);
    else showPush({ tone: l.tone, label: `${l.label} · ${p.cat}`, title: p.title, msg: p.msg, onOpen: () => { S.history = []; go('detail', evt.id, false); } });
    render();
  }

  function onEvent(evt) {
    const p = evt.payload || {};
    if (evt.type === 'alert') receiveAlert(evt, true);
    if (evt.type === 'whois') Bus.emit('ping', { embed: EMBED, mobile: MOBILE });
    if (evt.type === 'rescue' && (!p.device || p.device === Bus.deviceId)) {
      if (!EMBED) Chime.play('warning');
      vibrate([200, 100, 200]);
      const onWay = p.status === 'caminho';
      showPush({ tone: onWay ? 'warning' : '', label: 'Defesa Civil',
        title: onWay ? 'Equipe da Defesa Civil a caminho' : 'Atendimento concluído',
        msg: onWay ? 'Fique em local seguro e mantenha o celular por perto. A equipe vai até o seu endereço.' : 'A Defesa Civil registrou o seu atendimento. Se precisar de novo, responda pelo app.',
        onOpen: () => { if (p.alertId) { S.history = []; go('detail', p.alertId, false); } } });
    }
    if (evt.type === 'config' && p.city) { S.city = p.city; render(); }
    if (evt.type === 'status') {
      const r = S.reports.find(x => x.proto === p.proto);
      if (!r) return;
      r.status = p.status; r.updated = Date.now(); persist();
      if (!EMBED) Chime.play('info');
      vibrate([150]);
      showPush({ tone: '', label: p.sec || 'Solicitação', title: p.status === 'aberta' ? 'Sua solicitação foi reaberta' : `Sua solicitação está ${p.status === 'resolvida' ? 'resolvida' : 'em andamento'}`,
        msg: `Protocolo #${p.proto} · ${p.cat}. ${p.status === 'resolvida' ? 'Obrigado por ajudar a cuidar da cidade.' : p.status === 'aberta' ? 'Ela voltou para a fila de atendimento.' : 'A equipe já foi encaminhada.'}`,
        onOpen: () => { S.history = []; go('reports', null, false); } });
      render();
    }
    if (evt.type === 'reset') {
      S.alerts = []; S.read = {}; S.resp = {}; S.reports = []; persist();
      hideCritical(); hidePush(); S.history = []; S.view = 'home'; render();
    }
  }

  // ---------- Barra de status ----------
  $('#sbIcons').innerHTML = icon('wifi', 14) + `<svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true"><rect x=".5" y=".5" width="20" height="11" rx="3" fill="none" stroke="currentColor" opacity=".6"/><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor"/><rect x="21.5" y="4" width="1.5" height="4" rx=".75" fill="currentColor" opacity=".6"/></svg>`;
  const clock = () => { $('#sbTime').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  clock(); setInterval(clock, 15000);

  // ---------- Início ----------
  (async () => {
    await Bus.init();
    Bus.on(onEvent);
    const hist = await Bus.history();
    if (hist.config && hist.config.city) S.city = hist.config.city;
    (hist.alerts || []).forEach(e => receiveAlert(e, false));
    render();
    const hello = () => Bus.emit('hello', { embed: EMBED, mobile: MOBILE });
    hello();
    setInterval(() => Bus.emit('ping', { embed: EMBED, mobile: MOBILE }), 15000);
    addEventListener('pagehide', () => Bus.emit('bye', {}));
    setInterval(() => { if (['alerts', 'reports', 'home'].includes(S.view)) renderTabs(); }, 30000);

    if (!EMBED) {
      $('#unlockIc').innerHTML = icon('bell', 32);
      $('#unlock').hidden = false;
      $('#unlockBtn').onclick = () => { Chime.unlock(); Chime.play('info'); vibrate(60); $('#unlock').hidden = true; };
    }
  })();
})();
