// Barramento de eventos em tempo real entre o painel e o app.
//
// Dois modos, escolhidos automaticamente:
//  - "servidor": página aberta via http://<ip>:3000 (node server.js). Eventos passam
//    pelo servidor (SSE), então qualquer celular na mesma rede recebe os alertas.
//  - "local": arquivo aberto direto (duplo clique). Eventos passam por
//    BroadcastChannel + localStorage, entre abas/janelas do mesmo navegador.

const CNM = {
  levels: {
    info:     { label: 'Informativo', tone: 'info',    icon: 'info' },
    warning:  { label: 'Atenção',     tone: 'warning', icon: 'alert' },
    critical: { label: 'Crítico',     tone: 'danger',  icon: 'alert' },
  },
  categories: ['Defesa Civil', 'Saúde', 'Infraestrutura', 'Educação', 'Meio ambiente', 'Comunicado geral'],
  bairros: [
    { id: 'centro',    nome: 'Centro',          pop: 3120 },
    { id: 'saojose',   nome: 'São José',        pop: 2240 },
    { id: 'esperanca', nome: 'Nova Esperança',  pop: 1980 },
    { id: 'luzia',     nome: 'Santa Luzia',     pop: 1460 },
    { id: 'beirario',  nome: 'Beira-Rio',       pop: 1720 },
    { id: 'aparecida', nome: 'Aparecida',       pop: 1160 },
    { id: 'rural',     nome: 'Zona rural',      pop: 800 },
  ],
  cities: ['Urucurituba', 'Borba', 'Bela Vista', 'Envira', 'Município demonstração'],
};
CNM.totalPop = CNM.bairros.reduce((s, b) => s + b.pop, 0);
CNM.bairroNome = id => id === 'todos' ? 'Todos os bairros' : (CNM.bairros.find(b => b.id === id) || {}).nome || id;
CNM.audience = id => id === 'todos' ? CNM.totalPop : (CNM.bairros.find(b => b.id === id) || {}).pop || 0;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  sset(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};

const Bus = (() => {
  const EVT_KEY = 'cnm:event';
  const HIST_KEY = 'cnm:history';
  const listeners = new Set();
  const seen = new Set();
  let mode = 'local';
  let channel = null;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  let deviceId = store.sget('cnm:device');
  if (!deviceId) { deviceId = 'd-' + uid(); store.sset('cnm:device', deviceId); }

  function deliver(evt) {
    if (!evt || !evt.id || seen.has(evt.id)) return;
    seen.add(evt.id);
    listeners.forEach(fn => { try { fn(evt); } catch (e) { console.error(e); } });
  }

  async function init() {
    if ('BroadcastChannel' in window) {
      try { channel = new BroadcastChannel('cidade-na-mao'); channel.onmessage = e => deliver(e.data); } catch {}
    }
    window.addEventListener('storage', e => {
      if (e.key === EVT_KEY && e.newValue) { try { deliver(JSON.parse(e.newValue)); } catch {} }
    });
    if (location.protocol.startsWith('http')) {
      try {
        const r = await fetch('api/ping', { cache: 'no-store' });
        if (r.ok) {
          mode = 'server';
          const es = new EventSource('api/stream');
          es.onmessage = e => { try { deliver(JSON.parse(e.data)); } catch {} };
        }
      } catch {}
    }
    return mode;
  }

  function emit(type, payload) {
    const evt = { id: uid(), type, payload, at: Date.now(), device: deviceId };
    seen.add(evt.id);
    if (channel) { try { channel.postMessage(evt); } catch {} }
    store.set(EVT_KEY, evt);
    if (type === 'alert') {
      const h = store.get(HIST_KEY, []); h.unshift(evt); store.set(HIST_KEY, h.slice(0, 40));
    }
    if (type === 'config') store.set('cnm:config', payload);
    if (type === 'reset') store.set(HIST_KEY, []);
    if (mode === 'server') {
      fetch('api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evt) }).catch(() => {});
    }
    return evt;
  }

  async function history() {
    if (mode === 'server') {
      try {
        const r = await fetch('api/history', { cache: 'no-store' });
        if (r.ok) { const d = await r.json(); return { alerts: d.alerts || [], config: d.config || store.get('cnm:config', null) }; }
      } catch {}
    }
    return { alerts: store.get(HIST_KEY, []), config: store.get('cnm:config', null) };
  }

  return {
    init, emit, history,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get mode() { return mode; },
    get deviceId() { return deviceId; },
  };
})();

// Som curto de notificação (WebAudio, sem arquivos externos).
const Chime = (() => {
  let ctx = null;
  function unlock() {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch {}
    return !!ctx;
  }
  function play(kind = 'info') {
    if (!ctx) return;
    const seq = kind === 'critical' ? [880, 660, 880, 660] : kind === 'warning' ? [740, 988] : [660, 880];
    const t0 = ctx.currentTime;
    seq.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = t0 + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.16);
    });
  }
  return { unlock, play, get ready() { return !!ctx && ctx.state === 'running'; } };
})();

const fmt = {
  n: v => Number(v).toLocaleString('pt-BR'),
  time: ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  timeS: ts => new Date(ts).toLocaleTimeString('pt-BR'),
  ago(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 10) return 'agora';
    if (s < 60) return `há ${s} s`;
    const m = Math.round(s / 60);
    if (m < 60) return `há ${m} min`;
    return fmt.time(ts);
  },
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
};
