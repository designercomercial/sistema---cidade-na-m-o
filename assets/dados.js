// Base de dados fictícia da demonstração (gerada de forma determinística: sempre os mesmos números).
const DADOS = (() => {
  let seed = 20260311;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const wpick = pairs => { const tot = pairs.reduce((s, p) => s + p[1], 0); let r = rnd() * tot; for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; } return pairs[0][0]; };

  const NOW = Date.now();
  const YEAR = new Date().getFullYear();
  const Y0 = new Date(YEAR, 0, 1).getTime();
  const DAY = 864e5;

  const PRIMEIROS = ['Maria', 'José', 'Ana', 'João', 'Francisca', 'Antônio', 'Raimunda', 'Francisco', 'Luzia', 'Carlos', 'Joana', 'Paulo', 'Rita', 'Pedro', 'Sebastiana', 'Manoel', 'Rosa', 'Raimundo', 'Juliana', 'Marcos', 'Edilene', 'Lucas', 'Gabriela', 'Mateus', 'Kelly', 'Rafael', 'Sandra', 'Thiago', 'Cláudia', 'Wellington', 'Ivone', 'Diego', 'Aldenora', 'Bruno', 'Socorro'];
  const SOBRENOMES = ['Souza', 'Silva', 'Oliveira', 'Lima', 'Pereira', 'Costa', 'Ferreira', 'Rodrigues', 'Almeida', 'Nascimento', 'Araújo', 'Barbosa', 'Cardoso', 'Monteiro', 'Batista', 'Freitas', 'Gomes', 'Ribeiro', 'Martins', 'Carvalho', 'Brito', 'Teixeira'];
  const nome = () => `${pick(PRIMEIROS)} ${pick(SOBRENOMES)}${rnd() < .35 ? ' ' + pick(SOBRENOMES) : ''}`;

  const TIPOS = [
    { tipo: 'Buraco na via', sec: 'Infraestrutura', w: 18 },
    { tipo: 'Iluminação pública apagada', sec: 'Infraestrutura', w: 14 },
    { tipo: 'Limpeza de bueiro', sec: 'Infraestrutura', w: 6 },
    { tipo: 'Coleta de lixo atrasada', sec: 'Meio ambiente', w: 10 },
    { tipo: 'Queimada em terreno', sec: 'Meio ambiente', w: 4 },
    { tipo: 'Falta de medicamento na UBS', sec: 'Saúde', w: 8 },
    { tipo: 'Agendamento de consulta', sec: 'Saúde', w: 9 },
    { tipo: 'Vaga em creche', sec: 'Educação', w: 5 },
    { tipo: 'Transporte escolar', sec: 'Educação', w: 5 },
    { tipo: 'Rua alagada', sec: 'Defesa Civil', w: 5 },
    { tipo: 'Árvore com risco de queda', sec: 'Defesa Civil', w: 4 },
    { tipo: 'Sugestão ao prefeito', sec: 'Gabinete', w: 5 },
  ];
  const SECRETARIAS = ['Infraestrutura', 'Saúde', 'Meio ambiente', 'Educação', 'Defesa Civil', 'Gabinete'];
  const ORIGENS = ['App', 'Telefone 156', 'Presencial', 'WhatsApp'];
  const bairroPick = () => wpick(CNM.bairros.map(b => [b.id, b.pop]));

  // ---------- Solicitações ----------
  const MES_BASE = [212, 198, 236, 251, 289, 264, 243, 231, 276, 302, 288, 260];
  const solicitacoes = [];
  const curMonth = new Date().getMonth();
  for (let m = 0; m <= curMonth; m++) {
    const start = new Date(YEAR, m, 1).getTime();
    const end = Math.min(new Date(YEAR, m + 1, 1).getTime(), NOW - 3600e3);
    const frac = (end - start) / (new Date(YEAR, m + 1, 1).getTime() - start);
    const n = Math.round(MES_BASE[m] * frac);
    for (let i = 0; i < n; i++) {
      const t = start + rnd() * (end - start);
      const tp = wpick(TIPOS.map(x => [x, x.w]));
      const age = (NOW - t) / DAY;
      let status;
      if (age > 20) status = rnd() < .985 ? 'resolvida' : 'andamento';
      else if (age > 7) status = wpick([['resolvida', 78], ['andamento', 16], ['aberta', 6]]);
      else status = wpick([['resolvida', 22], ['andamento', 34], ['aberta', 44]]);
      solicitacoes.push({
        proto: '', tipo: tp.tipo, sec: tp.sec, bairro: bairroPick(),
        origem: wpick([['App', 62], ['Telefone 156', 18], ['Presencial', 12], ['WhatsApp', 8]]),
        status, aberta: t, resolvidaEm: status === 'resolvida' ? t + ri(2, 52) * 3600e3 : null, cidadao: nome(),
      });
    }
  }
  solicitacoes.sort((a, b) => a.aberta - b.aberta);
  solicitacoes.forEach((s, i) => { s.proto = `${YEAR}-${String(i + 1).padStart(6, '0')}`; });
  solicitacoes.reverse();
  let protoSeq = solicitacoes.length;
  const nextProto = () => `${YEAR}-${String(++protoSeq).padStart(6, '0')}`;

  // ---------- Cidadãos ----------
  const cidadaos = [];
  const CAD0 = new Date(YEAR - 1, 2, 10).getTime();
  CNM.bairros.forEach(b => {
    for (let i = 0; i < b.pop; i++) {
      const cad = CAD0 + Math.pow(rnd(), .8) * (NOW - CAD0 - DAY);
      cidadaos.push({
        nome: nome(), bairro: b.id,
        tel: `(92) 9••••-${String(ri(0, 9999)).padStart(4, '0')}`,
        canal: rnd() < .86 ? 'App' : 'SMS',
        cadastro: cad, acesso: Math.max(cad, NOW - Math.pow(rnd(), 2) * 40 * DAY),
      });
    }
  });
  cidadaos.sort((a, b) => b.cadastro - a.cadastro);

  // ---------- Alertas anteriores ----------
  const HIST = [
    [0, 14, 'info', 'Saúde', 'todos', 'Vacinação contra a dengue nas escolas', 'Equipes de saúde vão às escolas municipais nesta semana. Leve a caderneta de vacinação da criança.'],
    [1, 9, 'warning', 'Defesa Civil', 'todos', 'Chuva forte prevista para esta noite', 'Evite áreas de encosta e não atravesse ruas alagadas. Em emergência, ligue 199.'],
    [2, 21, 'warning', 'Defesa Civil', 'beirario', 'Nível do rio em observação', 'O rio está a 26,9 m. A Defesa Civil acompanha a subida e avisa por aqui se houver risco.'],
    [3, 18, 'critical', 'Defesa Civil', 'beirario', 'Cheia: abrigo aberto na Escola Municipal', 'Famílias da Beira-Rio devem seguir para o abrigo na Escola Municipal do Centro. Há transporte saindo da orla.'],
    [4, 6, 'warning', 'Infraestrutura', 'saojose', 'Abastecimento de água suspenso', 'Manutenção na rede do São José das 8h às 16h. Carros-pipa nas ruas principais.'],
    [5, 3, 'info', 'Saúde', 'todos', 'Campanha de vacinação contra a gripe', 'Vacinação em todas as UBS das 8h às 17h. Leve documento com foto e o cartão do SUS.'],
    [6, 11, 'info', 'Educação', 'todos', 'Matrículas abertas na rede municipal', 'Matrículas para 2027 pelo app ou na Secretaria de Educação até o dia 30.'],
    [7, 25, 'warning', 'Meio ambiente', 'todos', 'Fumaça de queimadas na cidade', 'Evite atividades ao ar livre e mantenha janelas fechadas. Procure a UBS em caso de falta de ar.'],
    [8, 16, 'warning', 'Infraestrutura', 'centro', 'Interdição da Rua Floriano Peixoto', 'Obra de drenagem até sexta-feira. Use a Av. Amazonas como desvio.'],
    [9, 2, 'info', 'Meio ambiente', 'esperanca', 'Coleta de lixo com novo horário', 'A coleta na Nova Esperança passa a ser às terças, quintas e sábados pela manhã.'],
    [9, 28, 'info', 'Saúde', 'rural', 'Mutirão de saúde na zona rural', 'Atendimento médico e odontológico no sábado, das 8h às 14h, na escola da comunidade.'],
  ];
  const alertas = HIST.map(([m, d, level, cat, target, title, msg], i) => {
    const at = new Date(YEAR, m, d, ri(8, 17), ri(0, 59)).getTime();
    return { id: 'h' + i, at, past: true, payload: { level, cat, target, title, msg } };
  }).filter(a => a.at < NOW - DAY);

  return { rnd, ri, pick, nome, NOW, YEAR, Y0, DAY, TIPOS, SECRETARIAS, ORIGENS, solicitacoes, nextProto, cidadaos, alertas };
})();
