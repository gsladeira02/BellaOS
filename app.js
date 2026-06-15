(() => {
  const DB_KEY = 'bellaos.db.v1';
  const SESSION_KEY = 'bellaos.session.v1';
  const PUBLIC_BASE_URL = 'https://os-bella.vercel.app';
  const SUPABASE_PROJECT_URL = 'https://omhrigszheellguyyihz.supabase.co';
  const SUPABASE_REST_URL = `${SUPABASE_PROJECT_URL}/rest/v1`;
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Urza4wG2be2xxgMzxJrCEQ_ya_uV0z-';
  const SUPABASE_STATE_ID = 'bellaos_app';
  const USE_SUPABASE_SYNC = true;
  let remoteSyncStarted = false;
  let remoteSaveTimer = null;
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  const state = {
    view: 'home',
    modal: null,
    selectedDate: todayISO(),
    serviceFilter: 'Todos',
    clientSearch: '',
    publicBooking: {
      items: [],
      draftProfessionalId: '',
      draftServiceId: '',
      date: todayISO(),
      time: '',
      clientName: '',
      clientPhone: '',
      notes: ''
    },
    appointmentDraft: {
      items: [],
      draftProfessionalId: '',
      draftServiceId: '',
      date: todayISO(),
      time: ''
    }
  };

  function uid(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  }

  function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function brDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function money(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function timeToMin(t) {
    const [h, m] = String(t || '00:00').split(':').map(Number);
    return h * 60 + m;
  }

  function minToTime(min) {
    const h = Math.floor(min / 60).toString().padStart(2, '0');
    const m = (min % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  function initials(name) {
    return String(name || 'B').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function slugify(text) {
    return String(text || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function bookingUrl(slug) {
    return `${PUBLIC_BASE_URL.replace(/\/$/, '')}/agenda/${slug}`;
  }

  function supabaseHeaders(extra = {}) {
    return {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      ...extra
    };
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function seedDb() {
    const salonId = 'salon_bella';
    const db = {
      salons: [{
        id: salonId,
        name: 'Studio Bella',
        slug: 'studio-bella',
        logoUrl: '/assets/logo-mark.svg',
        whatsapp: '27999999999',
        address: 'Rua das Flores, 120 - Centro',
        openingStart: '09:00',
        openingEnd: '19:00',
        minAdvanceMinutes: 120,
        bufferMinutes: 10,
        allowSameDay: true,
        allowAnyProfessional: true,
        showPrices: true,
        bookingEnabled: true,
        color: '#C89B7B',
        status: 'ativo',
        plan: 'Premium',
        createdAt: new Date().toISOString()
      }],
      users: [
        { id: 'u_owner', salonId, name: 'Dona do Studio Bella', email: 'contato@studiobella.com', password: 'bella123', role: 'owner', mustChangePassword: false, isDemo: false },
        { id: 'u_first', salonId, name: 'Primeiro Acesso', email: 'primeiro@studiobella.com', password: 'trocar123', role: 'owner', mustChangePassword: true, isDemo: false },
        { id: 'u_demo', salonId, name: 'Conta Demonstração', email: 'demo@bellaos.com', password: 'demo123', role: 'owner', mustChangePassword: false, isDemo: false },
        { id: 'u_admin', salonId: null, name: 'Admin BellaOS', email: 'admin@bellaos.com', password: 'admin123', role: 'super_admin', mustChangePassword: false, isDemo: false }
      ],
      categories: [
        { id: 'cat_cabelo', salonId, name: 'Cabelo' },
        { id: 'cat_unhas', salonId, name: 'Unhas' },
        { id: 'cat_sobrancelhas', salonId, name: 'Sobrancelhas' },
        { id: 'cat_make', salonId, name: 'Maquiagem' },
        { id: 'cat_noivas', salonId, name: 'Noivas' },
        { id: 'cat_estetica', salonId, name: 'Estética' },
        { id: 'cat_pacotes', salonId, name: 'Pacotes' }
      ],
      services: [
        { id: 'srv_escova', salonId, categoryId: 'cat_cabelo', name: 'Escova modelada', price: 75, duration: 45, minAdvanceMinutes: 60, buffer: 10, active: true, commissionType: 'percent', commissionValue: 40, products: [{ productId: 'prod_shampoo', qty: 20 }, { productId: 'prod_mascara', qty: 15 }] },
        { id: 'srv_corte', salonId, categoryId: 'cat_cabelo', name: 'Corte feminino', price: 95, duration: 60, minAdvanceMinutes: 120, buffer: 10, active: true, commissionType: 'percent', commissionValue: 40, products: [] },
        { id: 'srv_hidratacao', salonId, categoryId: 'cat_cabelo', name: 'Hidratação premium', price: 120, duration: 70, minAdvanceMinutes: 120, buffer: 10, active: true, commissionType: 'percent', commissionValue: 38, products: [{ productId: 'prod_mascara', qty: 35 }] },
        { id: 'srv_progressiva', salonId, categoryId: 'cat_cabelo', name: 'Progressiva', price: 260, duration: 180, minAdvanceMinutes: 1440, buffer: 20, active: true, commissionType: 'percent', commissionValue: 35, products: [{ productId: 'prod_progressiva', qty: 80 }] },
        { id: 'srv_luzes', salonId, categoryId: 'cat_cabelo', name: 'Luzes / Mechas', price: 390, duration: 240, minAdvanceMinutes: 2880, buffer: 20, active: true, commissionType: 'percent', commissionValue: 35, products: [{ productId: 'prod_ox', qty: 80 }, { productId: 'prod_tonalizante', qty: 1 }] },
        { id: 'srv_mani', salonId, categoryId: 'cat_unhas', name: 'Manicure', price: 38, duration: 50, minAdvanceMinutes: 60, buffer: 5, active: true, commissionType: 'fixed', commissionValue: 16, products: [{ productId: 'prod_esmalte', qty: 1 }] },
        { id: 'srv_pedi', salonId, categoryId: 'cat_unhas', name: 'Pedicure', price: 45, duration: 55, minAdvanceMinutes: 60, buffer: 5, active: true, commissionType: 'fixed', commissionValue: 18, products: [{ productId: 'prod_esmalte', qty: 1 }] },
        { id: 'srv_sobrancelha', salonId, categoryId: 'cat_sobrancelhas', name: 'Design de sobrancelha', price: 45, duration: 30, minAdvanceMinutes: 60, buffer: 5, active: true, commissionType: 'percent', commissionValue: 45, products: [] },
        { id: 'srv_make', salonId, categoryId: 'cat_make', name: 'Maquiagem social', price: 180, duration: 90, minAdvanceMinutes: 1440, buffer: 15, active: true, commissionType: 'percent', commissionValue: 40, products: [] },
        { id: 'srv_noiva', salonId, categoryId: 'cat_noivas', name: 'Pacote noiva', price: 850, duration: 300, minAdvanceMinutes: 4320, buffer: 30, active: true, commissionType: 'percent', commissionValue: 35, products: [] }
      ],
      professionals: [
        { id: 'pro_ana', salonId, name: 'Ana Clara', phone: '27988881111', specialty: 'Cabelo e química', services: ['srv_escova','srv_corte','srv_hidratacao','srv_progressiva','srv_luzes','srv_noiva'], workDays: [1,2,3,4,5,6], start: '09:00', end: '18:00', lunchStart: '12:30', lunchEnd: '13:30', commissionDefault: 40, color: '#C89B7B', active: true },
        { id: 'pro_bia', salonId, name: 'Beatriz Lima', phone: '27988882222', specialty: 'Unhas e sobrancelhas', services: ['srv_mani','srv_pedi','srv_sobrancelha'], workDays: [1,2,3,4,5,6], start: '09:30', end: '19:00', lunchStart: '13:00', lunchEnd: '14:00', commissionDefault: 42, color: '#8B5E4E', active: true },
        { id: 'pro_lu', salonId, name: 'Luiza Rocha', phone: '27988883333', specialty: 'Maquiagem e penteado', services: ['srv_make','srv_noiva','srv_escova'], workDays: [2,3,4,5,6], start: '10:00', end: '19:00', lunchStart: '14:00', lunchEnd: '15:00', commissionDefault: 40, color: '#4F8A6B', active: true }
      ],
      clients: [
        { id: 'cli_julia', salonId, name: 'Juliana Martins', phone: '27991112222', email: 'juliana@email.com', preferredProfessionalId: 'pro_ana', notes: 'Prefere escova modelada. Couro cabeludo sensível.', formula: '7.1 + OX 20 volumes', visits: 5, totalSpent: 950, createdAt: new Date().toISOString() },
        { id: 'cli_maria', salonId, name: 'Maria Fernanda', phone: '27992223333', email: '', preferredProfessionalId: 'pro_bia', notes: 'Gosta de esmalte claro.', formula: '', visits: 3, totalSpent: 270, createdAt: new Date().toISOString() },
        { id: 'cli_larissa', salonId, name: 'Larissa Alves', phone: '27993334444', email: '', preferredProfessionalId: 'pro_lu', notes: 'Cliente para eventos e maquiagem.', formula: '', visits: 2, totalSpent: 420, createdAt: new Date().toISOString() }
      ],
      hairHistory: [
        { id: 'hist_1', salonId, clientId: 'cli_julia', date: addDaysISO(-18), service: 'Morena iluminada', formula: 'Tonalizante 7.1 + OX 20', products: 'Tonalizante 7.1, máscara pós-química', professionalId: 'pro_ana', notes: 'Pontas sensibilizadas. Evitar descoloração forte na próxima sessão.' }
      ],
      appointments: [
        { id: 'app_1', salonId, clientId: 'cli_julia', professionalId: 'pro_ana', serviceIds: ['srv_escova','srv_hidratacao'], date: todayISO(), start: '10:00', end: '12:05', status: 'confirmado', total: 195, duration: 125, notes: 'Cliente pediu escova modelada.', createdBy: 'u_owner', createdAt: new Date().toISOString() },
        { id: 'app_2', salonId, clientId: 'cli_maria', professionalId: 'pro_bia', serviceIds: ['srv_mani','srv_pedi'], date: todayISO(), start: '14:00', end: '15:50', status: 'agendado', total: 83, duration: 110, notes: '', createdBy: 'u_owner', createdAt: new Date().toISOString() },
        { id: 'app_3', salonId, clientId: 'cli_larissa', professionalId: 'pro_lu', serviceIds: ['srv_make'], date: addDaysISO(1), start: '16:00', end: '17:45', status: 'agendado', total: 180, duration: 105, notes: 'Maquiagem para formatura.', createdBy: 'u_owner', createdAt: new Date().toISOString() },
        { id: 'app_4', salonId, clientId: 'cli_julia', professionalId: 'pro_ana', serviceIds: ['srv_luzes'], date: addDaysISO(-2), start: '09:30', end: '13:50', status: 'concluido', total: 390, duration: 260, notes: '', createdBy: 'u_owner', createdAt: new Date().toISOString() }
      ],
      products: [
        { id: 'prod_shampoo', salonId, name: 'Shampoo profissional', category: 'Shampoo', unit: 'ml', qty: 1400, minQty: 500, cost: 0.08, supplier: 'Distribuidora Beauty' },
        { id: 'prod_mascara', salonId, name: 'Máscara hidratação', category: 'Máscara', unit: 'ml', qty: 420, minQty: 500, cost: 0.18, supplier: 'Distribuidora Beauty' },
        { id: 'prod_progressiva', salonId, name: 'Progressiva premium', category: 'Progressiva', unit: 'ml', qty: 820, minQty: 300, cost: 0.65, supplier: 'Hair Pro' },
        { id: 'prod_ox', salonId, name: 'OX 20 volumes', category: 'Oxidante', unit: 'ml', qty: 650, minQty: 300, cost: 0.09, supplier: 'Color Mix' },
        { id: 'prod_tonalizante', salonId, name: 'Tonalizante 7.1', category: 'Coloração', unit: 'un', qty: 2, minQty: 4, cost: 22, supplier: 'Color Mix' },
        { id: 'prod_esmalte', salonId, name: 'Esmaltes variados', category: 'Esmalte', unit: 'un', qty: 38, minQty: 15, cost: 6.5, supplier: 'Nails Center' }
      ],
      financial: [
        { id: 'fin_1', salonId, type: 'receita', date: addDaysISO(-2), description: 'Luzes / Mechas - Juliana Martins', amount: 390, payment: 'Pix', appointmentId: 'app_4' },
        { id: 'fin_2', salonId, type: 'despesa', date: addDaysISO(-3), description: 'Compra de produtos', amount: 220, payment: 'Pix' }
      ],
      logs: []
    };
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    scheduleRemoteSave(db);
    return db;
  }

  function getDb() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return seedDb();
      const parsed = JSON.parse(raw);
      const required = ['salons','users','services','professionals','clients','appointments','products','financial'];
      if (!required.every(k => Array.isArray(parsed[k]))) return seedDb();
      ['hairHistory','stockMovements','logs','categories'].forEach(k => { if (!Array.isArray(parsed[k])) parsed[k] = []; });
      return parsed;
    } catch (e) {
      return seedDb();
    }
  }

  function saveDb(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    scheduleRemoteSave(db);
  }

  function scheduleRemoteSave(db) {
    if (!USE_SUPABASE_SYNC || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_PROJECT_URL) return;
    clearTimeout(remoteSaveTimer);
    const snapshot = JSON.parse(JSON.stringify(db));
    remoteSaveTimer = setTimeout(() => saveRemoteDb(snapshot), 700);
  }

  async function saveRemoteDb(db) {
    try {
      await fetch(`${SUPABASE_REST_URL}/bellaos_state`, {
        method: 'POST',
        headers: supabaseHeaders({
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        }),
        body: JSON.stringify({
          id: SUPABASE_STATE_ID,
          payload: db,
          updated_at: new Date().toISOString()
        })
      });
    } catch (error) {
      console.warn('BellaOS Supabase sync skipped:', error);
    }
  }

  async function startRemoteSync() {
    if (remoteSyncStarted || !USE_SUPABASE_SYNC || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_PROJECT_URL) return;
    remoteSyncStarted = true;
    try {
      const response = await fetch(`${SUPABASE_REST_URL}/bellaos_state?id=eq.${encodeURIComponent(SUPABASE_STATE_ID)}&select=payload`, {
        headers: supabaseHeaders()
      });
      if (!response.ok) return;
      const rows = await response.json();
      if (rows?.[0]?.payload) {
        localStorage.setItem(DB_KEY, JSON.stringify(rows[0].payload));
        render();
      } else {
        await saveRemoteDb(getDb());
      }
    } catch (error) {
      console.warn('BellaOS Supabase load skipped:', error);
    }
  }

  function getSession() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return getDb().users.find(u => u.id === id) || null;
  }

  function setSession(userId) {
    localStorage.setItem(SESSION_KEY, userId);
  }

  function currentUser() {
    return getSession();
  }

  function currentSalon() {
    const user = currentUser();
    if (!user || !user.salonId) return null;
    return getDb().salons.find(s => s.id === user.salonId) || null;
  }

  function salonBySlug(slug) {
    return getDb().salons.find(s => s.slug === slug);
  }

  function salonData(salonId) {
    const db = getDb();
    return {
      db,
      salon: db.salons.find(s => s.id === salonId),
      categories: db.categories.filter(x => x.salonId === salonId),
      services: db.services.filter(x => x.salonId === salonId),
      professionals: db.professionals.filter(x => x.salonId === salonId),
      clients: db.clients.filter(x => x.salonId === salonId),
      appointments: db.appointments.filter(x => x.salonId === salonId),
      products: db.products.filter(x => x.salonId === salonId),
      financial: db.financial.filter(x => x.salonId === salonId),
      hairHistory: db.hairHistory.filter(x => x.salonId === salonId)
    };
  }

  function isDemo() {
    const user = currentUser();
    return !!user?.isDemo;
  }

  function canEdit() {
    return true;
  }

  function serviceName(serviceIds, services) {
    return serviceIds.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(' + ');
  }

  function serviceTotal(serviceIds, services) {
    return serviceIds.reduce((sum, id) => sum + Number(services.find(s => s.id === id)?.price || 0), 0);
  }

  function serviceDuration(serviceIds, services, salon) {
    return serviceIds.reduce((sum, id) => {
      const s = services.find(item => item.id === id);
      return sum + Number(s?.duration || 0) + Number(s?.buffer ?? salon?.bufferMinutes ?? 0);
    }, 0);
  }

  function maxAdvance(serviceIds, services, salon) {
    const serviceAdvance = serviceIds.map(id => Number(services.find(s => s.id === id)?.minAdvanceMinutes || 0));
    return Math.max(Number(salon?.minAdvanceMinutes || 0), ...serviceAdvance, 0);
  }

  function appointmentStatusBadge(status) {
    const map = {
      agendado: 'muted',
      confirmado: 'success',
      atendimento: 'dark',
      concluido: 'success',
      cancelado: 'danger',
      falta: 'danger'
    };
    return `<span class="badge ${map[status] || 'muted'}">${esc(labelStatus(status))}</span>`;
  }

  function labelStatus(status) {
    return ({ agendado: 'Agendado', confirmado: 'Confirmado', atendimento: 'Em atendimento', concluido: 'Concluído', cancelado: 'Cancelado', falta: 'Não compareceu' })[status] || status;
  }

  function updatePath(path) {
    window.history.pushState({}, '', path);
    render();
  }

  function navigate(view) {
    state.view = view;
    state.modal = null;
    window.history.pushState({}, '', '/');
    render();
  }

  function render() {
    const path = window.location.pathname;
    if (path.startsWith('/agenda/')) {
      renderPublicBooking(path.split('/').filter(Boolean)[1]);
      return;
    }

    const user = currentUser();
    if (!user) {
      renderLogin();
      return;
    }

    if (user.mustChangePassword) {
      renderPasswordChange(user);
      return;
    }

    if (user.role === 'super_admin' || path === '/admin') {
      renderAdminPanel(user);
      return;
    }

    renderSalonApp(user);
  }

  function renderLogin() {
    app.innerHTML = `
      <main class="login-screen">
        <section class="login-card">
          <div class="login-logo">
            <img class="logo-mark" src="/assets/logo-mark.svg" alt="BellaOS" />
            <div>
              <div class="logo-title">BellaOS</div>
              <div class="logo-subtitle">Gestão para salões</div>
            </div>
          </div>
          <h1>Acesse sua conta</h1>
          <p>Entre para gerenciar a agenda e o salão.</p>
          <form onsubmit="Bella.login(event)">
            <div class="field">
              <label>E-mail</label>
              <input name="email" type="email" autocomplete="email" placeholder="seuemail@salao.com.br" required />
            </div>
            <div class="field">
              <label>Senha</label>
              <input name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required />
            </div>
            <button class="btn brand full" type="submit">Entrar</button>
          </form>
        </section>
      </main>
    `;
  }

  function renderPasswordChange(user) {
    app.innerHTML = `
      <main class="login-screen">
        <section class="login-card">
          <div class="login-logo">
            <img class="logo-mark" src="/assets/logo-mark.svg" alt="BellaOS" />
            <div>
              <div class="logo-title">BellaOS</div>
              <div class="logo-subtitle">Primeiro acesso</div>
            </div>
          </div>
          <h1>Crie uma nova senha</h1>
          <p>Crie sua senha definitiva para acessar o painel.</p>
          <form onsubmit="Bella.changePassword(event)">
            <div class="field">
              <label>Nova senha</label>
              <input name="password" type="password" minlength="6" autocomplete="new-password" required />
            </div>
            <div class="field">
              <label>Confirmar senha</label>
              <input name="confirm" type="password" minlength="6" autocomplete="new-password" required />
            </div>
            <button class="btn brand full" type="submit">Salvar nova senha</button>
            <button class="btn secondary full" style="margin-top:10px" type="button" onclick="Bella.logout()">Sair</button>
          </form>
        </section>
      </main>
    `;
  }

  function renderSalonApp(user) {
    const salon = currentSalon();
    if (!salon) {
      app.innerHTML = `<main class="login-screen"><section class="login-card"><h1>Salão não encontrado</h1><button class="btn full" onclick="Bella.logout()">Sair</button></section></main>`;
      return;
    }

    const viewLabels = {
      home: 'Início', agenda: 'Agenda', clients: 'Clientes', services: 'Serviços', more: 'Mais', professionals: 'Profissionais', finance: 'Financeiro', stock: 'Estoque', commissions: 'Comissões', online: 'Agenda Online', settings: 'Configurações'
    };

    app.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="topbar-left">
            <img src="/assets/logo-mark.svg" alt="BellaOS" />
            <div>
              <div class="topbar-title">${esc(salon.name)}</div>
              <div class="topbar-subtitle">${esc(viewLabels[state.view] || 'BellaOS')}</div>
            </div>
          </div>
          <button class="icon-btn" aria-label="Sair" onclick="Bella.logout()">↗</button>
        </header>
        <main class="page">
          ${renderView(state.view, user, salon)}
        </main>
        ${renderBottomNav()}
        ${state.modal ? renderModal(state.modal) : ''}
      </div>
    `;
  }

  function renderBottomNav() {
    const items = [
      ['home', 'Início', '⌂'],
      ['agenda', 'Agenda', '□'],
      ['clients', 'Clientes', '◌'],
      ['services', 'Serviços', '◇'],
      ['more', 'Mais', '≡']
    ];
    return `<nav class="bottom-nav">${items.map(([key,label,icon]) => `
      <button class="nav-btn ${state.view === key ? 'active' : ''}" onclick="Bella.navigate('${key}')">
        <span class="nav-icon">${icon}</span><span>${label}</span>
      </button>`).join('')}</nav>`;
  }

  function renderView(view, user, salon) {
    const map = {
      home: renderHome,
      agenda: renderAgenda,
      clients: renderClients,
      services: renderServices,
      more: renderMore,
      professionals: renderProfessionals,
      finance: renderFinance,
      stock: renderStock,
      commissions: renderCommissions,
      online: renderOnline,
      settings: renderSettings
    };
    return (map[view] || renderHome)(user, salon);
  }

  function renderHome(user, salon) {
    const { services, professionals, clients, appointments, products, financial } = salonData(salon.id);
    const todays = appointments.filter(a => a.date === todayISO() && !['cancelado','falta'].includes(a.status));
    const concludedToday = appointments.filter(a => a.date === todayISO() && a.status === 'concluido');
    const incomeToday = financial.filter(f => f.date === todayISO() && f.type === 'receita').reduce((s, f) => s + Number(f.amount), 0) + concludedToday.reduce((s, a) => s + Number(a.total), 0);
    const next = todays.filter(a => timeToMin(a.start) >= (new Date().getHours() * 60 + new Date().getMinutes())).sort((a,b) => timeToMin(a.start)-timeToMin(b.start))[0] || todays.sort((a,b)=>timeToMin(a.start)-timeToMin(b.start))[0];
    const lowStock = products.filter(p => Number(p.qty) <= Number(p.minQty));

    return `
      <section class="header">
        <div class="eyebrow">BellaOS Premium</div>
        <h1>Olá, ${esc(user.name.split(' ')[0])}</h1>
        <p>Controle o salão pelo celular: agenda, clientes, profissionais, financeiro, comissões e estoque.</p>
      </section>
      <section class="grid">
        <div class="card stat"><div class="stat-label">Agendamentos hoje</div><div class="stat-number">${todays.length}</div><div class="card-sub">${concludedToday.length} concluído(s)</div></div>
        <div class="card stat good"><div class="stat-label">Faturamento</div><div class="stat-number">${money(incomeToday)}</div><div class="card-sub">Hoje</div></div>
        <div class="card stat"><div class="stat-label">Clientes</div><div class="stat-number">${clients.length}</div><div class="card-sub">Base ativa</div></div>
        <div class="card stat ${lowStock.length ? 'warn' : 'good'}"><div class="stat-label">Estoque baixo</div><div class="stat-number">${lowStock.length}</div><div class="card-sub">${lowStock[0] ? esc(lowStock[0].name) : 'Tudo em dia'}</div></div>
      </section>
      <section class="section"><h2>Próximo atendimento</h2><button class="btn small secondary" onclick="Bella.openModal('appointment')">Novo</button></section>
      ${next ? renderAppointmentItem(next, salon.id, true) : `<div class="empty">Nenhum atendimento próximo para hoje.</div>`}
      <section class="section"><h2>Ações rápidas</h2></section>
      <div class="grid">
        <button class="card" onclick="Bella.openModal('appointment')"><div class="card-title">Novo agendamento</div><div class="card-sub">Criar horário interno</div></button>
        <button class="card" onclick="Bella.navigate('online')"><div class="card-title">Compartilhar agenda</div><div class="card-sub">Link público do salão</div></button>
        <button class="card" onclick="Bella.openModal('client')"><div class="card-title">Nova cliente</div><div class="card-sub">Cadastrar ficha</div></button>
        <button class="card" onclick="Bella.navigate('stock')"><div class="card-title">Ver estoque</div><div class="card-sub">Produtos e alertas</div></button>
      </div>
    `;
  }

  function renderAgenda(user, salon) {
    const { appointments, professionals } = salonData(salon.id);
    const day = state.selectedDate;
    const list = appointments.filter(a => a.date === day).sort((a,b)=>timeToMin(a.start)-timeToMin(b.start));
    return `
      <section class="header">
        <div class="eyebrow">Agenda interna</div>
        <h1>${brDate(day)}</h1>
        <p>Controle horários, status e contato das clientes.</p>
      </section>
      <div class="card">
        <div class="field" style="margin-bottom:0">
          <label>Data</label>
          <input type="date" value="${esc(day)}" onchange="Bella.setDate(this.value)" />
        </div>
      </div>
      <section class="section"><h2>Atendimentos</h2><button class="btn small brand" onclick="Bella.openModal('appointment')">Novo</button></section>
      <div class="filters">
        ${professionals.map(p => `<button class="chip" onclick="Bella.toast('Filtro visual: ${esc(p.name)}')">${esc(p.name.split(' ')[0])}</button>`).join('')}
      </div>
      <div class="list">${list.length ? list.map(a => renderAppointmentItem(a, salon.id)).join('') : `<div class="empty">Nenhum agendamento nesta data.</div>`}</div>
    `;
  }

  function renderAppointmentItem(a, salonId, compact = false) {
    const { services, professionals, clients } = salonData(salonId);
    const client = clients.find(c => c.id === a.clientId);
    const pro = professionals.find(p => p.id === a.professionalId);
    const whats = client?.phone ? `https://wa.me/55${normalizePhone(client.phone)}?text=${encodeURIComponent(`Olá, ${client.name}! Passando para confirmar seu horário no ${currentSalon()?.name || 'salão'} dia ${brDate(a.date)} às ${a.start}.`)}` : '#';
    return `
      <article class="item">
        <div class="avatar">${initials(client?.name || 'Cliente')}</div>
        <div class="item-main">
          <div class="item-title">${esc(a.start)} · ${esc(client?.name || 'Cliente')} ${appointmentStatusBadge(a.status)} ${a.groupTotal > 1 ? `<span class="badge muted">${a.groupIndex}/${a.groupTotal}</span>` : ''}</div>
          <div class="item-meta">
            ${esc(serviceName(a.serviceIds, services))}<br>
            Profissional: ${esc(pro?.name || 'Não definida')} · ${money(a.total)} · ${a.duration} min
            ${a.groupTotal > 1 ? `<br>Atendimento combinado` : ''}
            ${a.notes ? `<br>Obs: ${esc(a.notes)}` : ''}
          </div>
          ${compact ? '' : `<div class="actions" style="margin-top:10px">
            <a class="btn small secondary" href="${whats}" target="_blank" rel="noopener">WhatsApp</a>
            <button class="btn small success" onclick="Bella.updateAppointmentStatus('${a.id}','concluido')">Concluir</button>
            <button class="btn small secondary" onclick="Bella.updateAppointmentStatus('${a.id}','confirmado')">Confirmar</button>
            <button class="btn small danger" onclick="Bella.updateAppointmentStatus('${a.id}','cancelado')">Cancelar</button>
          </div>`}
        </div>
        <div class="item-side">${esc(a.end)}</div>
      </article>
    `;
  }

  function renderClients(user, salon) {
    const { clients, professionals, appointments } = salonData(salon.id);
    const q = state.clientSearch.toLowerCase();
    const list = clients.filter(c => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q));
    return `
      <section class="header">
        <div class="eyebrow">Clientes</div>
        <h1>Ficha completa</h1>
        <p>Histórico, preferências, coloração, observações e atendimentos.</p>
      </section>
      <div class="card">
        <div class="field" style="margin-bottom:0"><label>Buscar cliente</label><input placeholder="Nome ou WhatsApp" value="${esc(state.clientSearch)}" oninput="Bella.setClientSearch(this.value)" /></div>
      </div>
      <section class="section"><h2>${list.length} cliente(s)</h2><button class="btn small brand" onclick="Bella.openModal('client')">Nova</button></section>
      <div class="list">
        ${list.map(c => {
          const pro = professionals.find(p => p.id === c.preferredProfessionalId);
          const last = appointments.filter(a => a.clientId === c.id).sort((a,b)=> b.date.localeCompare(a.date))[0];
          return `<article class="item" onclick="Bella.openClient('${c.id}')">
            <div class="avatar">${initials(c.name)}</div>
            <div class="item-main">
              <div class="item-title">${esc(c.name)}</div>
              <div class="item-meta">${esc(c.phone)} · ${c.visits || 0} visita(s)<br>Preferência: ${esc(pro?.name || 'Sem preferência')}${last ? `<br>Último: ${brDate(last.date)} · ${esc(labelStatus(last.status))}` : ''}</div>
              <div class="actions" style="margin-top:10px">
                <button class="btn small secondary" type="button" onclick="event.stopPropagation(); Bella.openClient('${c.id}')">Ficha</button>
                <button class="btn small secondary" type="button" onclick="event.stopPropagation(); Bella.openModal('client',{clientId:'${c.id}'})">Editar</button>
                <button class="btn small danger" type="button" onclick="event.stopPropagation(); Bella.deleteClient('${c.id}')">Excluir</button>
              </div>
            </div>
            <div class="item-side">${money(c.totalSpent || 0)}</div>
          </article>`;
        }).join('') || `<div class="empty">Nenhuma cliente encontrada.</div>`}
      </div>
    `;
  }

  function renderServices(user, salon) {
    const { services, categories } = salonData(salon.id);
    const names = ['Todos', ...categories.map(c => c.name)];
    const filtered = services.filter(s => state.serviceFilter === 'Todos' || categories.find(c => c.id === s.categoryId)?.name === state.serviceFilter);
    return `
      <section class="header">
        <div class="eyebrow">Serviços e pacotes</div>
        <h1>Cardápio do salão</h1>
        <p>Preço, duração, antecedência mínima, comissão e produtos usados.</p>
      </section>
      <div class="filters">${names.map(n => `<button class="chip ${state.serviceFilter === n ? 'active' : ''}" onclick="Bella.setServiceFilter('${esc(n)}')">${esc(n)}</button>`).join('')}</div>
      <section class="section"><h2>${filtered.length} item(ns)</h2><button class="btn small brand" onclick="Bella.openModal('service')">Novo</button></section>
      <div class="list">
        ${filtered.map(s => {
          const cat = categories.find(c => c.id === s.categoryId)?.name || 'Serviço';
          return `<article class="item">
            <div class="avatar">${cat.slice(0,1)}</div>
            <div class="item-main">
              <div class="item-title">${esc(s.name)} ${s.active ? '<span class="badge success">Ativo</span>' : '<span class="badge danger">Inativo</span>'}</div>
              <div class="item-meta">${esc(cat)} · ${money(s.price)} · ${s.duration} min<br>Antecedência: ${formatAdvance(s.minAdvanceMinutes)} · Comissão: ${formatCommission(s)}</div>
              <div class="actions" style="margin-top:10px">
                <button class="btn small secondary" type="button" onclick="Bella.openModal('service',{serviceId:'${s.id}'})">Editar</button>
                <button class="btn small danger" type="button" onclick="Bella.deleteService('${s.id}')">Excluir</button>
              </div>
            </div>
          </article>`;
        }).join('') || `<div class="empty">Nenhum serviço cadastrado.</div>`}
      </div>
    `;
  }

  function formatAdvance(min) {
    min = Number(min || 0);
    if (min < 60) return `${min} min`;
    if (min < 1440) return `${Math.round(min / 60)}h`;
    return `${Math.round(min / 1440)} dia(s)`;
  }

  function formatCommission(s) {
    if (s.commissionType === 'fixed') return money(s.commissionValue);
    if (s.commissionType === 'none') return 'Sem comissão';
    return `${s.commissionValue}%`;
  }

  function renderMore(user, salon) {
    const tiles = [
      ['professionals','Profissionais','Especialidades, horários e comissões'],
      ['finance','Financeiro','Receitas, despesas e lucro estimado'],
      ['stock','Estoque','Produtos, alertas e baixas'],
      ['commissions','Comissões','Valores a pagar por profissional'],
      ['online','Agenda Online','Link público com nome do salão'],
      ['settings','Configurações','Antecedência, WhatsApp e dados do salão']
    ];
    return `
      <section class="header">
        <div class="eyebrow">Módulos completos</div>
        <h1>Mais recursos</h1>
        <p>Acesse gestão avançada do BellaOS.</p>
      </section>
      <div class="grid one">
        ${tiles.map(([view,title,sub]) => `<button class="card" onclick="Bella.navigate('${view}')"><div class="card-title">${esc(title)}</div><div class="card-sub">${esc(sub)}</div></button>`).join('')}
      </div>
    `;
  }

  function renderProfessionals(user, salon) {
    const { professionals, services } = salonData(salon.id);
    return `
      <section class="header">
        <div class="eyebrow">Equipe</div>
        <h1>Profissionais</h1>
        <p>Cada profissional tem serviços, horários, folgas e comissão própria.</p>
      </section>
      <section class="section"><h2>${professionals.length} profissional(is)</h2><button class="btn small brand" onclick="Bella.openModal('professional')">Nova</button></section>
      <div class="list">
        ${professionals.map(p => `<article class="item">
          <div class="avatar">${initials(p.name)}</div>
          <div class="item-main">
            <div class="item-title">${esc(p.name)} ${p.active ? '<span class="badge success">Ativa</span>' : '<span class="badge danger">Inativa</span>'}</div>
            <div class="item-meta">${esc(p.specialty)}<br>${esc(p.start)} às ${esc(p.end)} · Comissão padrão ${p.commissionDefault}%<br>${p.services.map(id => services.find(s => s.id === id)?.name).filter(Boolean).slice(0,3).join(', ')}${p.services.length > 3 ? '...' : ''}</div>
            <div class="actions" style="margin-top:10px">
              <button class="btn small secondary" type="button" onclick="Bella.openModal('professional',{professionalId:'${p.id}'})">Editar</button>
              <button class="btn small danger" type="button" onclick="Bella.deleteProfessional('${p.id}')">Excluir</button>
            </div>
          </div>
        </article>`).join('') || `<div class="empty">Nenhuma profissional cadastrada.</div>`}
      </div>
    `;
  }

  function renderFinance(user, salon) {
    const { appointments, financial } = salonData(salon.id);
    const month = todayISO().slice(0,7);
    const concluded = appointments.filter(a => a.status === 'concluido');
    const incomeAppointments = concluded.reduce((s,a)=>s+Number(a.total),0);
    const income = financial.filter(f => f.type === 'receita').reduce((s,f)=>s+Number(f.amount),0) + incomeAppointments;
    const expense = financial.filter(f => f.type === 'despesa').reduce((s,f)=>s+Number(f.amount),0);
    const incomeMonth = financial.filter(f => f.type === 'receita' && f.date.startsWith(month)).reduce((s,f)=>s+Number(f.amount),0) + concluded.filter(a => a.date.startsWith(month)).reduce((s,a)=>s+Number(a.total),0);
    const expenseMonth = financial.filter(f => f.type === 'despesa' && f.date.startsWith(month)).reduce((s,f)=>s+Number(f.amount),0);
    return `
      <section class="header">
        <div class="eyebrow">Financeiro</div>
        <h1>Resultado do salão</h1>
        <p>Receitas, despesas, formas de pagamento, ticket médio e lucro estimado.</p>
      </section>
      <div class="grid">
        <div class="card stat good"><div class="stat-label">Receitas mês</div><div class="stat-number">${money(incomeMonth)}</div><div class="card-sub">Entradas + concluídos</div></div>
        <div class="card stat danger"><div class="stat-label">Despesas mês</div><div class="stat-number">${money(expenseMonth)}</div><div class="card-sub">Custos registrados</div></div>
        <div class="card stat"><div class="stat-label">Lucro estimado</div><div class="stat-number">${money(income - expense)}</div><div class="card-sub">Geral</div></div>
        <div class="card stat"><div class="stat-label">Ticket médio</div><div class="stat-number">${money(concluded.length ? incomeAppointments / concluded.length : 0)}</div><div class="card-sub">Atendimentos concluídos</div></div>
      </div>
      <section class="section"><h2>Lançamentos</h2><button class="btn small brand" onclick="Bella.openModal('financial')">Novo</button></section>
      <div class="list">
        ${financial.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(f => `<article class="item">
          <div class="avatar">${f.type === 'receita' ? '+' : '-'}</div>
          <div class="item-main"><div class="item-title">${esc(f.description)}</div><div class="item-meta">${brDate(f.date)} · ${esc(f.payment || '')} · ${esc(f.type)}</div></div>
          <div class="item-side">${money(f.amount)}</div>
        </article>`).join('') || `<div class="empty">Nenhum lançamento manual.</div>`}
      </div>
    `;
  }

  function renderStock(user, salon) {
    const { products } = salonData(salon.id);
    return `
      <section class="header">
        <div class="eyebrow">Estoque</div>
        <h1>Produtos e alertas</h1>
        <p>Controle colorações, OX, máscaras, progressivas, esmaltes e descartáveis.</p>
      </section>
      <section class="section"><h2>${products.length} produto(s)</h2><button class="btn small brand" onclick="Bella.openModal('product')">Novo</button></section>
      <div class="list">
        ${products.map(p => `<article class="item">
          <div class="avatar">${p.category.slice(0,1)}</div>
          <div class="item-main">
            <div class="item-title">${esc(p.name)} ${Number(p.qty) <= Number(p.minQty) ? '<span class="badge danger">Estoque baixo</span>' : '<span class="badge success">OK</span>'}</div>
            <div class="item-meta">${esc(p.category)} · ${p.qty} ${esc(p.unit)} · mínimo ${p.minQty} ${esc(p.unit)}<br>Custo: ${money(p.cost)} por ${esc(p.unit)} · ${esc(p.supplier || '')}</div>
            <div class="actions" style="margin-top:10px"><button class="btn small secondary" onclick="Bella.adjustStock('${p.id}', 1)">Entrada</button><button class="btn small secondary" onclick="Bella.adjustStock('${p.id}', -1)">Baixa</button></div>
          </div>
        </article>`).join('')}
      </div>
    `;
  }

  function renderCommissions(user, salon) {
    const { appointments, professionals, services } = salonData(salon.id);
    const concluded = appointments.filter(a => a.status === 'concluido');
    const rows = professionals.map(p => {
      const apps = concluded.filter(a => a.professionalId === p.id);
      const gross = apps.reduce((sum,a)=>sum+Number(a.total),0);
      const commission = apps.reduce((sum,a)=> sum + commissionForAppointment(a, services), 0);
      return { p, apps, gross, commission };
    });
    return `
      <section class="header">
        <div class="eyebrow">Comissões</div>
        <h1>Valores a pagar</h1>
        <p>Comissão por percentual, valor fixo ou regra específica por serviço.</p>
      </section>
      <div class="list">
        ${rows.map(r => `<article class="item">
          <div class="avatar">${initials(r.p.name)}</div>
          <div class="item-main"><div class="item-title">${esc(r.p.name)}</div><div class="item-meta">${r.apps.length} atendimento(s) concluído(s)<br>Valor bruto: ${money(r.gross)}</div></div>
          <div class="item-side"><strong>${money(r.commission)}</strong><br>Pendente</div>
        </article>`).join('')}
      </div>
    `;
  }

  function commissionForAppointment(appo, services) {
    return appo.serviceIds.reduce((sum, id) => {
      const s = services.find(x => x.id === id);
      if (!s) return sum;
      if (s.commissionType === 'fixed') return sum + Number(s.commissionValue || 0);
      if (s.commissionType === 'none') return sum;
      return sum + (Number(s.price || 0) * Number(s.commissionValue || 0) / 100);
    }, 0);
  }

  function renderOnline(user, salon) {
    const link = bookingUrl(salon.slug);
    return `
      <section class="header">
        <div class="eyebrow">Agenda online</div>
        <h1>Link do salão</h1>
        <p>A cliente agenda sozinha pelo link público com o nome do salão.</p>
      </section>
      <div class="card">
        <div class="card-title">Link público</div>
        <div class="copy-box">${esc(link)}</div>
        <div class="actions vertical" style="margin-top:14px">
          <button class="btn brand full" onclick="Bella.copyBookingLink()">Copiar link</button>
          <button class="btn secondary full" onclick="Bella.openBookingLink()">Abrir agenda</button>
          <button class="btn secondary full" onclick="Bella.shareBookingLink()">Compartilhar no WhatsApp</button>
        </div>
      </div>
      <section class="section"><h2>Regras de agendamento</h2></section>
      <div class="grid one">
        <div class="card"><div class="card-title">Antecedência mínima global</div><div class="card-sub">${formatAdvance(salon.minAdvanceMinutes)} antes do horário escolhido.</div></div>
        <div class="card"><div class="card-title">Agendamento no mesmo dia</div><div class="card-sub">${salon.allowSameDay ? 'Permitido respeitando a antecedência.' : 'Bloqueado para a cliente.'}</div></div>
        <div class="card"><div class="card-title">Mostrar preços</div><div class="card-sub">${salon.showPrices ? 'A cliente vê os valores.' : 'A cliente não vê os valores.'}</div></div>
      </div>
    `;
  }

  function renderSettings(user, salon) {
    return `
      <section class="header">
        <div class="eyebrow">Configurações</div>
        <h1>Dados do salão</h1>
        <p>Altere nome, slug, WhatsApp, endereço e regras de agendamento.</p>
      </section>
      <form class="card" onsubmit="Bella.saveSettings(event)">
        <div class="field"><label>Nome do salão</label><input name="name" value="${esc(salon.name)}" required /></div>
        <div class="field"><label>Slug do link</label><input name="slug" value="${esc(salon.slug)}" required /></div>
        <div class="field"><label>WhatsApp</label><input name="whatsapp" value="${esc(salon.whatsapp)}" required /></div>
        <div class="field"><label>Endereço</label><input name="address" value="${esc(salon.address)}" /></div>
        <div class="field-row">
          <div class="field"><label>Abre</label><input name="openingStart" type="time" value="${esc(salon.openingStart)}" /></div>
          <div class="field"><label>Fecha</label><input name="openingEnd" type="time" value="${esc(salon.openingEnd)}" /></div>
        </div>
        <div class="field"><label>Antecedência mínima</label><select name="minAdvanceMinutes">${[30,60,120,240,360,720,1440,2880,4320].map(m => `<option value="${m}" ${Number(salon.minAdvanceMinutes) === m ? 'selected' : ''}>${formatAdvance(m)}</option>`).join('')}</select></div>
        <div class="switch-row"><div><span>Permitir agendamento no mesmo dia</span><small>Respeitando a antecedência mínima.</small></div><input class="checkbox" name="allowSameDay" type="checkbox" ${salon.allowSameDay ? 'checked' : ''}></div>
        <div class="switch-row"><div><span>Mostrar preços na agenda pública</span><small>Ideal para reduzir perguntas no WhatsApp.</small></div><input class="checkbox" name="showPrices" type="checkbox" ${salon.showPrices ? 'checked' : ''}></div>
        <div class="switch-row"><div><span>Agenda pública ativa</span><small>Quando desativada, ninguém consegue marcar pelo link.</small></div><input class="checkbox" name="bookingEnabled" type="checkbox" ${salon.bookingEnabled ? 'checked' : ''}></div>
        <button class="btn brand full" type="submit">Salvar configurações</button>
      </form>
    `;
  }

  function renderModal(type) {
    const content = {
      appointment: modalAppointment,
      client: modalClient,
      service: modalService,
      professional: modalProfessional,
      financial: modalFinancial,
      product: modalProduct,
      clientDetail: modalClientDetail
    }[type.name || type]?.(type) || '';
    return `<div class="modal-backdrop" onclick="Bella.closeModal(event)"><section class="modal" onclick="event.stopPropagation()">${content}</section></div>`;
  }

  function modalHeader(title) {
    return `<div class="modal-header"><h2>${esc(title)}</h2><button class="icon-btn" onclick="Bella.closeModal()">×</button></div>`;
  }

  function modalAppointment() {
    const salon = currentSalon();
    const { clients, professionals, services } = salonData(salon.id);
    const draft = ensureAppointmentDraft(salon.id);
    const activePros = professionals.filter(p => p.active);
    const selectedPro = activePros.find(p => p.id === draft.draftProfessionalId) || activePros[0];
    if (selectedPro && draft.draftProfessionalId !== selectedPro.id) draft.draftProfessionalId = selectedPro.id;
    const availableServices = getActiveServicesForProfessional(salon.id, draft.draftProfessionalId);
    if (availableServices.length && !availableServices.some(s => s.id === draft.draftServiceId)) draft.draftServiceId = availableServices[0].id;
    if (!availableServices.length) draft.draftServiceId = '';
    const slots = getMultiAvailableSlots(salon.id, draft.items, draft.date);
    const total = multiServiceTotal(draft.items, services);
    const duration = multiServiceDuration(draft.items, services, salon);
    return `${modalHeader('Novo atendimento')}
      <form onsubmit="Bella.saveAppointment(event)">
        <div class="field"><label>Cliente</label><select name="clientId" required>${clients.map(c => `<option value="${c.id}">${esc(c.name)} · ${esc(c.phone)}</option>`).join('')}</select></div>

        <div class="card" style="margin-bottom:14px">
          <div class="card-title">Adicionar serviço ao atendimento</div>
          <div class="card-sub" style="margin-bottom:12px">Escolha a profissional e veja apenas os serviços que ela realiza. Você pode adicionar serviços com profissionais diferentes.</div>
          <div class="field"><label>Profissional</label><select onchange="Bella.setAppointmentItemDraft('professionalId', this.value)">
            ${activePros.length ? activePros.map(p => `<option value="${p.id}" ${draft.draftProfessionalId === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.specialty)}</option>`).join('') : `<option value="">Cadastre uma profissional ativa</option>`}
          </select></div>
          <div class="field"><label>Serviço</label><select onchange="Bella.setAppointmentItemDraft('serviceId', this.value)" ${availableServices.length ? '' : 'disabled'}>
            ${availableServices.length ? availableServices.map(s => `<option value="${s.id}" ${draft.draftServiceId === s.id ? 'selected' : ''}>${esc(s.name)} · ${money(s.price)} · ${s.duration} min</option>`).join('') : `<option value="">Nenhum serviço disponível</option>`}
          </select></div>
          <button class="btn secondary full" type="button" onclick="Bella.addAppointmentItem()" ${(!draft.draftProfessionalId || !draft.draftServiceId) ? 'disabled' : ''}>Adicionar serviço</button>
        </div>

        <div class="field"><label>Serviços escolhidos</label>
          <div class="list">
            ${draft.items.length ? draft.items.map((item, index) => renderSelectedServiceItem(item, index, services, professionals, 'appointment')).join('') : `<div class="empty">Nenhum serviço adicionado ainda.</div>`}
          </div>
        </div>

        <div class="field"><label>Data</label><input name="date" type="date" min="${todayISO()}" value="${esc(draft.date)}" required onchange="Bella.setAppointmentDraft('date', this.value)" /></div>
        <div class="field"><label>Horário inicial disponível</label>
          <div class="slots">${slots.length ? slots.map(t => `<button type="button" class="slot ${draft.time === t ? 'active' : ''}" onclick="Bella.setAppointmentDraft('time','${t}')">${t}</button>`).join('') : `<button type="button" class="slot" disabled>Sem horários</button>`}</div>
          <input type="hidden" name="start" value="${esc(draft.time)}" required />
          <small>${draft.items.length ? 'O sistema agenda cada serviço em sequência, na agenda da profissional escolhida.' : 'Adicione pelo menos um serviço para ver os horários.'}</small>
        </div>
        <div class="summary-box">
          <strong>${draft.items.length ? money(total) : 'Monte o atendimento'}</strong>
          <small>${draft.items.length ? `${draft.items.length} serviço(s) · duração estimada ${duration} min` : 'O resumo aparecerá aqui.'}</small>
        </div>
        <div class="field" style="margin-top:14px"><label>Observações</label><textarea name="notes" placeholder="Preferências, sinal pago, fórmula, etc."></textarea></div>
        <button class="btn brand full" type="submit" ${(!draft.time || !draft.items.length) ? 'disabled' : ''}>Salvar atendimento</button>
      </form>`;
  }

  function modalClient(payload = {}) {
    const salon = currentSalon();
    const { clients, professionals } = salonData(salon.id);
    const c = clients.find(x => x.id === payload.clientId);
    const isEdit = Boolean(c);
    return `${modalHeader(isEdit ? 'Editar cliente' : 'Nova cliente')}
      <form onsubmit="Bella.saveClient(event, '${c?.id || ''}')">
        <div class="field"><label>Nome</label><input name="name" value="${esc(c?.name || '')}" required /></div>
        <div class="field"><label>WhatsApp</label><input name="phone" inputmode="tel" value="${esc(c?.phone || '')}" required /></div>
        <div class="field"><label>E-mail</label><input name="email" type="email" value="${esc(c?.email || '')}" /></div>
        <div class="field"><label>Profissional preferida</label><select name="preferredProfessionalId"><option value="">Sem preferência</option>${professionals.map(p => `<option value="${p.id}" ${c?.preferredProfessionalId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Fórmula de coloração</label><input name="formula" value="${esc(c?.formula || '')}" placeholder="Ex: 7.1 + OX 20 volumes" /></div>
        <div class="field"><label>Observações</label><textarea name="notes">${esc(c?.notes || '')}</textarea></div>
        <button class="btn brand full" type="submit">${isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
        ${isEdit ? `<button class="btn danger full" style="margin-top:10px" type="button" onclick="Bella.deleteClient('${c.id}')">Excluir cliente</button>` : ''}
      </form>`;
  }

  function modalService(payload = {}) {
    const salon = currentSalon();
    const { services, categories } = salonData(salon.id);
    const svc = services.find(x => x.id === payload.serviceId);
    const isEdit = Boolean(svc);
    const advances = [30,60,120,240,360,720,1440,2880,4320];
    return `${modalHeader(isEdit ? 'Editar serviço' : 'Novo serviço')}
      <form onsubmit="Bella.saveService(event, '${svc?.id || ''}')">
        <div class="field"><label>Nome</label><input name="name" value="${esc(svc?.name || '')}" required /></div>
        <div class="field"><label>Categoria</label><select name="categoryId">${categories.map(c => `<option value="${c.id}" ${svc?.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field-row"><div class="field"><label>Preço</label><input name="price" type="number" step="0.01" value="${esc(svc?.price ?? '')}" required /></div><div class="field"><label>Duração min</label><input name="duration" type="number" value="${esc(svc?.duration ?? '')}" required /></div></div>
        <div class="field"><label>Antecedência mínima</label><select name="minAdvanceMinutes">${advances.map(m => `<option value="${m}" ${Number(svc?.minAdvanceMinutes || 60) === m ? 'selected' : ''}>${formatAdvance(m)}</option>`).join('')}</select></div>
        <div class="field-row"><div class="field"><label>Comissão tipo</label><select name="commissionType"><option value="percent" ${svc?.commissionType === 'percent' || !svc ? 'selected' : ''}>Percentual</option><option value="fixed" ${svc?.commissionType === 'fixed' ? 'selected' : ''}>Valor fixo</option><option value="none" ${svc?.commissionType === 'none' ? 'selected' : ''}>Sem comissão</option></select></div><div class="field"><label>Comissão</label><input name="commissionValue" type="number" step="0.01" value="${esc(svc?.commissionValue ?? 40)}" /></div></div>
        <div class="switch-row"><div><span>Serviço ativo</span><small>Serviços inativos não aparecem na agenda pública.</small></div><input class="checkbox" name="active" type="checkbox" ${svc?.active !== false ? 'checked' : ''}></div>
        <button class="btn brand full" type="submit">${isEdit ? 'Salvar alterações' : 'Cadastrar serviço'}</button>
        ${isEdit ? `<button class="btn danger full" style="margin-top:10px" type="button" onclick="Bella.deleteService('${svc.id}')">Excluir serviço</button>` : ''}
      </form>`;
  }

  function modalProfessional(payload = {}) {
    const salon = currentSalon();
    const { professionals, services } = salonData(salon.id);
    const p = professionals.find(x => x.id === payload.professionalId);
    const isEdit = Boolean(p);
    return `${modalHeader(isEdit ? 'Editar profissional' : 'Nova profissional')}
      <form onsubmit="Bella.saveProfessional(event, '${p?.id || ''}')">
        <div class="field"><label>Nome</label><input name="name" value="${esc(p?.name || '')}" required /></div>
        <div class="field"><label>WhatsApp</label><input name="phone" inputmode="tel" value="${esc(p?.phone || '')}" /></div>
        <div class="field"><label>Especialidade</label><input name="specialty" value="${esc(p?.specialty || '')}" placeholder="Cabelo, unhas, maquiagem..." /></div>
        <div class="field"><label>Serviços realizados</label><div class="service-picker">${services.filter(s=>s.active || p?.services?.includes(s.id)).map(s => `<label class="service-option"><input type="checkbox" name="services" value="${s.id}" ${p?.services?.includes(s.id) ? 'checked' : ''}><div><strong>${esc(s.name)}</strong><div class="card-sub">${money(s.price)} · ${s.duration} min</div></div></label>`).join('')}</div></div>
        <div class="field-row"><div class="field"><label>Início</label><input name="start" type="time" value="${esc(p?.start || '09:00')}" /></div><div class="field"><label>Fim</label><input name="end" type="time" value="${esc(p?.end || '18:00')}" /></div></div>
        <div class="field"><label>Comissão padrão %</label><input name="commissionDefault" type="number" value="${esc(p?.commissionDefault ?? 40)}" /></div>
        <div class="switch-row"><div><span>Profissional ativa</span><small>Profissionais inativas não recebem novos agendamentos online.</small></div><input class="checkbox" name="active" type="checkbox" ${p?.active !== false ? 'checked' : ''}></div>
        <button class="btn brand full" type="submit">${isEdit ? 'Salvar alterações' : 'Cadastrar profissional'}</button>
        ${isEdit ? `<button class="btn danger full" style="margin-top:10px" type="button" onclick="Bella.deleteProfessional('${p.id}')">Excluir profissional</button>` : ''}
      </form>`;
  }

  function modalFinancial() {
    return `${modalHeader('Novo lançamento')}
      <form onsubmit="Bella.saveFinancial(event)">
        <div class="field"><label>Tipo</label><select name="type"><option value="receita">Receita</option><option value="despesa">Despesa</option></select></div>
        <div class="field"><label>Descrição</label><input name="description" required /></div>
        <div class="field-row"><div class="field"><label>Valor</label><input name="amount" type="number" step="0.01" required /></div><div class="field"><label>Data</label><input name="date" type="date" value="${todayISO()}" required /></div></div>
        <div class="field"><label>Pagamento</label><select name="payment"><option>Pix</option><option>Dinheiro</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>Parcelado</option><option>Cortesia</option><option>Pendente</option></select></div>
        <button class="btn brand full" type="submit">Salvar lançamento</button>
      </form>`;
  }

  function modalProduct() {
    return `${modalHeader('Novo produto')}
      <form onsubmit="Bella.saveProduct(event)">
        <div class="field"><label>Nome</label><input name="name" required /></div>
        <div class="field"><label>Categoria</label><select name="category"><option>Shampoo</option><option>Condicionador</option><option>Máscara</option><option>Coloração</option><option>Oxidante</option><option>Progressiva</option><option>Esmalte</option><option>Descartáveis</option><option>Maquiagem</option><option>Outros</option></select></div>
        <div class="field-row"><div class="field"><label>Quantidade</label><input name="qty" type="number" step="0.01" required /></div><div class="field"><label>Unidade</label><input name="unit" value="un" required /></div></div>
        <div class="field-row"><div class="field"><label>Estoque mínimo</label><input name="minQty" type="number" step="0.01" required /></div><div class="field"><label>Custo</label><input name="cost" type="number" step="0.01" /></div></div>
        <div class="field"><label>Fornecedor</label><input name="supplier" /></div>
        <button class="btn brand full" type="submit">Cadastrar produto</button>
      </form>`;
  }

  function modalClientDetail(payload) {
    const salon = currentSalon();
    const { clients, professionals, appointments, services, hairHistory } = salonData(salon.id);
    const c = clients.find(x => x.id === payload.clientId);
    if (!c) return modalHeader('Cliente não encontrada');
    const pro = professionals.find(p => p.id === c.preferredProfessionalId);
    const apps = appointments.filter(a => a.clientId === c.id).sort((a,b)=>b.date.localeCompare(a.date));
    const hist = hairHistory.filter(h => h.clientId === c.id).sort((a,b)=>b.date.localeCompare(a.date));
    return `${modalHeader(c.name)}
      <div class="card tight">
        <div class="card-title">Ficha da cliente</div>
        <div class="card-sub">WhatsApp: ${esc(c.phone)}<br>Preferência: ${esc(pro?.name || 'Sem preferência')}<br>Total gasto: ${money(c.totalSpent || 0)} · ${c.visits || 0} visita(s)</div>
        <div class="actions" style="margin-top:12px">
          <button class="btn small secondary" type="button" onclick="Bella.openModal('client',{clientId:'${c.id}'})">Editar</button>
          <button class="btn small danger" type="button" onclick="Bella.deleteClient('${c.id}')">Excluir</button>
        </div>
      </div>
      <section class="section"><h2>Observações</h2></section>
      <div class="card"><div class="card-sub">${esc(c.notes || 'Sem observações.')}${c.formula ? `<br><br><strong>Fórmula:</strong> ${esc(c.formula)}` : ''}</div></div>
      <section class="section"><h2>Histórico capilar</h2><button class="btn small secondary" onclick="Bella.addHairHistoryPrompt('${c.id}')">Adicionar</button></section>
      <div class="list">${hist.map(h => `<article class="item"><div class="avatar">H</div><div class="item-main"><div class="item-title">${brDate(h.date)} · ${esc(h.service)}</div><div class="item-meta">${esc(h.formula)}<br>${esc(h.notes || '')}</div></div></article>`).join('') || `<div class="empty">Nenhum histórico capilar cadastrado.</div>`}</div>
      <section class="section"><h2>Atendimentos</h2></section>
      <div class="list">${apps.map(a => `<article class="item"><div class="avatar">${a.start}</div><div class="item-main"><div class="item-title">${brDate(a.date)} ${appointmentStatusBadge(a.status)}</div><div class="item-meta">${esc(serviceName(a.serviceIds, services))}<br>${money(a.total)}</div></div></article>`).join('') || `<div class="empty">Nenhum atendimento ainda.</div>`}</div>`;
  }

  function renderPublicBooking(slug) {
    const salon = salonBySlug(slug);
    if (!salon) {
      app.innerHTML = `<main class="booking-shell"><section class="public-hero"><h1>Agenda não encontrada</h1><p>Confira se o link está correto.</p><button class="btn full" onclick="Bella.goLogin()">Voltar</button></section></main>`;
      return;
    }
    const { services, professionals } = salonData(salon.id);
    ensurePublicBookingState(salon.id);
    const b = state.publicBooking;
    const activePros = professionals.filter(p => p.active);
    const availableServices = getActiveServicesForProfessional(salon.id, b.draftProfessionalId);
    const slots = getMultiAvailableSlots(salon.id, b.items, b.date);
    const total = multiServiceTotal(b.items, services);
    const duration = multiServiceDuration(b.items, services, salon);
    const enabled = salon.bookingEnabled && salon.status === 'ativo';
    app.innerHTML = `
      <main class="booking-shell">
        <section class="public-hero">
          <div class="public-hero-logo"><img src="${esc(salon.logoUrl || '/assets/logo-mark.svg')}" alt="${esc(salon.name)}"><div><div class="logo-title public-brand">${esc(salon.name)}</div><div class="logo-subtitle">Agenda online</div></div></div>
          <h1>Agende seu horário</h1>
          <p>${esc(salon.address || '')}<br>Escolha os serviços, profissionais, data e horário disponível.</p>
        </section>
        ${enabled ? '' : `<div class="card danger"><div class="card-title">Agenda indisponível</div><div class="card-sub">Este salão pausou os agendamentos online.</div></div>`}

        <section class="step">
          <div class="section"><h2>1. Monte seu atendimento</h2></div>
          <div class="card">
            <div class="field"><label>Profissional</label><select onchange="Bella.setPublicItemDraft('professionalId', this.value)">
              ${activePros.length ? activePros.map(p => `<option value="${p.id}" ${b.draftProfessionalId === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.specialty)}</option>`).join('') : `<option value="">Nenhuma profissional disponível</option>`}
            </select><small>Os serviços mudam de acordo com a profissional escolhida.</small></div>
            <div class="field"><label>Serviço</label><select onchange="Bella.setPublicItemDraft('serviceId', this.value)" ${availableServices.length ? '' : 'disabled'}>
              ${availableServices.length ? availableServices.map(s => `<option value="${s.id}" ${b.draftServiceId === s.id ? 'selected' : ''}>${esc(s.name)}${salon.showPrices ? ' · ' + money(s.price) : ''} · ${s.duration} min</option>`).join('') : `<option value="">Nenhum serviço disponível</option>`}
            </select></div>
            <button class="btn secondary full" type="button" onclick="Bella.addPublicItem()" ${(!b.draftProfessionalId || !b.draftServiceId || !enabled) ? 'disabled' : ''}>Adicionar serviço</button>
          </div>
        </section>

        <section class="step">
          <div class="section"><h2>2. Serviços escolhidos</h2><small>${b.items.length} item(ns)</small></div>
          <div class="list">
            ${b.items.length ? b.items.map((item, index) => renderSelectedServiceItem(item, index, services, professionals, 'public')).join('') : `<div class="empty">Adicione um ou mais serviços para continuar.</div>`}
          </div>
        </section>

        <section class="step">
          <div class="section"><h2>3. Data e horário</h2></div>
          <div class="card">
            <div class="field"><label>Data</label><input type="date" min="${todayISO()}" value="${esc(b.date)}" onchange="Bella.setPublic('date', this.value)"></div>
            <div class="slots">${slots.length ? slots.map(t => `<button class="slot ${b.time === t ? 'active' : ''}" onclick="Bella.setPublic('time','${t}')">${t}</button>`).join('') : `<button class="slot" disabled>Sem horários</button>`}</div>
            <small>${b.items.length ? 'O horário é o início do primeiro serviço. Os próximos são encaixados em sequência.' : 'Adicione serviços para ver horários.'}</small>
          </div>
        </section>
        <section class="step">
          <div class="section"><h2>4. Seus dados</h2></div>
          <div class="card">
            <div class="field"><label>Nome</label><input value="${esc(b.clientName)}" oninput="Bella.setPublic('clientName', this.value)" placeholder="Seu nome" /></div>
            <div class="field"><label>WhatsApp</label><input value="${esc(b.clientPhone)}" oninput="Bella.setPublic('clientPhone', this.value)" inputmode="tel" placeholder="(27) 99999-9999" /></div>
            <div class="field"><label>Observação</label><textarea oninput="Bella.setPublic('notes', this.value)" placeholder="Opcional">${esc(b.notes)}</textarea></div>
          </div>
        </section>
        <div class="summary-box">
          <strong>${b.items.length ? money(total) : 'Monte seu atendimento'}</strong>
          <small>${b.items.length ? `${b.items.length} serviço(s) · duração estimada ${duration} min` : 'O resumo aparecerá aqui.'}</small>
        </div>
        <button class="btn brand full" style="margin-top:14px" onclick="Bella.confirmPublicBooking('${salon.id}')" ${!enabled ? 'disabled' : ''}>Confirmar agendamento</button>
      </main>
    `;
  }

  function getPossibleProfessionals(salonId, serviceIds) {
    const { professionals } = salonData(salonId);
    if (!serviceIds.length) return professionals.filter(p => p.active);
    return professionals.filter(p => p.active && serviceIds.every(id => (p.services || []).includes(id)));
  }

  function getActiveServicesForProfessional(salonId, professionalId) {
    const { services, professionals } = salonData(salonId);
    const activeServices = services.filter(s => s.active);
    if (!professionalId || professionalId === 'any') return activeServices;
    const pro = professionals.find(p => p.id === professionalId && p.active);
    if (!pro) return [];
    return activeServices.filter(s => (pro.services || []).includes(s.id));
  }

  function ensurePublicBookingState(salonId) {
    const { professionals } = salonData(salonId);
    const activePros = professionals.filter(p => p.active);
    const today = todayISO();
    const b = state.publicBooking;
    if (!Array.isArray(b.items)) b.items = [];
    if (b.selectedServices?.length && !b.items.length) {
      const proId = b.professionalId && b.professionalId !== 'any' ? b.professionalId : activePros[0]?.id;
      b.items = (b.selectedServices || []).map(serviceId => ({ id: uid('bi'), professionalId: proId, serviceId })).filter(x => x.professionalId && x.serviceId);
    }
    if (!b.date || b.date < today) b.date = today;
    b.items = sanitizeServiceItems(salonId, b.items);
    if (!b.draftProfessionalId || !activePros.some(p => p.id === b.draftProfessionalId)) b.draftProfessionalId = activePros[0]?.id || '';
    const available = getActiveServicesForProfessional(salonId, b.draftProfessionalId);
    if (!available.some(s => s.id === b.draftServiceId)) b.draftServiceId = available[0]?.id || '';
    const slots = getMultiAvailableSlots(salonId, b.items, b.date);
    if (!slots.includes(b.time)) b.time = '';
    return b;
  }

  function ensureAppointmentDraft(salonId) {
    const { professionals } = salonData(salonId);
    const activePros = professionals.filter(p => p.active);
    const today = todayISO();
    const d = state.appointmentDraft;
    if (!Array.isArray(d.items)) d.items = [];
    if (d.selectedServices?.length && !d.items.length) {
      const proId = d.professionalId || activePros[0]?.id;
      d.items = (d.selectedServices || []).map(serviceId => ({ id: uid('ai'), professionalId: proId, serviceId })).filter(x => x.professionalId && x.serviceId);
    }
    if (!d.date || d.date < today) d.date = state.selectedDate && state.selectedDate >= today ? state.selectedDate : today;
    d.items = sanitizeServiceItems(salonId, d.items);
    if (!d.draftProfessionalId || !activePros.some(p => p.id === d.draftProfessionalId)) d.draftProfessionalId = activePros[0]?.id || '';
    const available = getActiveServicesForProfessional(salonId, d.draftProfessionalId);
    if (!available.some(s => s.id === d.draftServiceId)) d.draftServiceId = available[0]?.id || '';
    const slots = getMultiAvailableSlots(salonId, d.items, d.date);
    if (!slots.includes(d.time)) d.time = '';
    return d;
  }

  function sanitizeServiceItems(salonId, items) {
    const { professionals, services } = salonData(salonId);
    return (items || []).filter(item => {
      const pro = professionals.find(p => p.id === item.professionalId && p.active);
      const service = services.find(s => s.id === item.serviceId && s.active);
      return pro && service && (pro.services || []).includes(service.id);
    }).map(item => ({ id: item.id || uid('item'), professionalId: item.professionalId, serviceId: item.serviceId }));
  }

  function renderSelectedServiceItem(item, index, services, professionals, scope) {
    const service = services.find(s => s.id === item.serviceId);
    const pro = professionals.find(p => p.id === item.professionalId);
    const removeFn = scope === 'public' ? `Bella.removePublicItem(${index})` : `Bella.removeAppointmentItem(${index})`;
    return `<article class="item">
      <div class="avatar">${index + 1}</div>
      <div class="item-main">
        <div class="item-title">${esc(service?.name || 'Serviço')}</div>
        <div class="item-meta">${esc(pro?.name || 'Profissional')} · ${money(service?.price || 0)} · ${Number(service?.duration || 0)} min</div>
      </div>
      <button class="btn small secondary" type="button" onclick="${removeFn}">Remover</button>
    </article>`;
  }

  function itemDuration(item, services, salon) {
    const service = services.find(s => s.id === item.serviceId);
    if (!service) return 0;
    return Number(service.duration || 0) + Number(service.buffer ?? salon?.bufferMinutes ?? 0);
  }

  function multiServiceDuration(items, services, salon) {
    return (items || []).reduce((sum, item) => sum + itemDuration(item, services, salon), 0);
  }

  function multiServiceTotal(items, services) {
    return (items || []).reduce((sum, item) => sum + Number(services.find(s => s.id === item.serviceId)?.price || 0), 0);
  }

  function multiServiceAdvance(items, services, salon) {
    const values = (items || []).map(item => Number(services.find(s => s.id === item.serviceId)?.minAdvanceMinutes || 0));
    return Math.max(Number(salon?.minAdvanceMinutes || 0), ...values, 0);
  }

  function itemSummary(items, services, professionals, start = '') {
    const salon = currentSalon() || {};
    let offset = start ? timeToMin(start) : 0;
    return (items || []).map(item => {
      const service = services.find(s => s.id === item.serviceId);
      const pro = professionals.find(p => p.id === item.professionalId);
      const dur = Number(service?.duration || 0) + Number(service?.buffer ?? salon?.bufferMinutes ?? 0);
      const time = start ? `${minToTime(offset)} ` : '';
      offset += dur;
      return `${time}${service?.name || 'Serviço'} com ${pro?.name || 'profissional'}`;
    }).join(' · ');
  }

  function isProfessionalSegmentAvailable({ salon, professional, date, startMin, endMin, appointments }) {
    if (!professional?.active) return false;
    const day = new Date(date + 'T00:00:00').getDay();
    if (!(professional.workDays || []).includes(day)) return false;
    if (startMin < Math.max(timeToMin(salon.openingStart), timeToMin(professional.start))) return false;
    if (endMin > Math.min(timeToMin(salon.openingEnd), timeToMin(professional.end))) return false;
    if (professional.lunchStart && professional.lunchEnd) {
      const lunchStart = timeToMin(professional.lunchStart);
      const lunchEnd = timeToMin(professional.lunchEnd);
      if (startMin < lunchEnd && endMin > lunchStart) return false;
    }
    return !appointments.some(a => a.date === date && a.professionalId === professional.id && !['cancelado','falta'].includes(a.status) && startMin < timeToMin(a.end) && endMin > timeToMin(a.start));
  }

  function getMultiAvailableSlots(salonId, items, date) {
    const { salon, professionals, services, appointments } = salonData(salonId);
    items = sanitizeServiceItems(salonId, items || []);
    if (!items.length || !date) return [];
    if (date < todayISO()) return [];
    if (!salon.allowSameDay && date === todayISO()) return [];
    const totalDuration = multiServiceDuration(items, services, salon);
    const advance = multiServiceAdvance(items, services, salon);
    const minDate = new Date(Date.now() + advance * 60000);
    const slots = [];
    const salonStart = timeToMin(salon.openingStart);
    const salonEnd = timeToMin(salon.openingEnd);
    for (let m = salonStart; m + totalDuration <= salonEnd; m += 30) {
      const t = minToTime(m);
      const startDate = new Date(`${date}T${t}:00`);
      if (startDate < minDate) continue;
      let cursor = m;
      let ok = true;
      for (const item of items) {
        const service = services.find(s => s.id === item.serviceId);
        const professional = professionals.find(p => p.id === item.professionalId);
        const dur = Number(service?.duration || 0) + Number(service?.buffer ?? salon?.bufferMinutes ?? 0);
        if (!dur || !isProfessionalSegmentAvailable({ salon, professional, date, startMin: cursor, endMin: cursor + dur, appointments })) {
          ok = false;
          break;
        }
        cursor += dur;
      }
      if (ok) slots.push(t);
    }
    return slots;
  }

  function getAvailableSlots(salonId, serviceIds, professionalId, date) {
    const items = (serviceIds || []).map(serviceId => ({ id: uid('slot'), professionalId, serviceId }));
    return getMultiAvailableSlots(salonId, items, date);
  }

  function renderAdminPanel(user) {
    const db = getDb();
    const salons = db.salons;
    const totalAppointments = db.appointments.length;
    const active = salons.filter(s => s.status === 'ativo').length;
    app.innerHTML = `
      <main class="admin-shell">
        <header class="section"><div><div class="eyebrow">Painel administrativo</div><h1 style="margin:.2em 0">BellaOS</h1><p class="card-sub">Gerencie salões, planos, status, demonstrações e métricas gerais.</p></div><button class="btn secondary" onclick="Bella.logout()">Sair</button></header>
        <div class="admin-grid">
          <div class="admin-card"><div class="stat-label">Salões ativos</div><div class="stat-number">${active}</div></div>
          <div class="admin-card"><div class="stat-label">Agendamentos</div><div class="stat-number">${totalAppointments}</div></div>
          <div class="admin-card"><div class="stat-label">Plano principal</div><div class="stat-number">Premium</div></div>
        </div>
        <section class="section"><h2>Salões cadastrados</h2><button class="btn small brand" onclick="Bella.openAdminCreateSalon()">Novo salão</button></section>
        <div class="list">
          ${salons.map(s => `<article class="item"><div class="avatar">${initials(s.name)}</div><div class="item-main"><div class="item-title">${esc(s.name)} <span class="badge ${s.status === 'ativo' ? 'success' : 'danger'}">${esc(s.status)}</span></div><div class="item-meta">/${esc(s.slug)} · ${esc(s.plan)} · ${esc(s.whatsapp)}</div><div class="actions" style="margin-top:10px"><button class="btn small secondary" onclick="Bella.toggleSalonStatus('${s.id}')">${s.status === 'ativo' ? 'Bloquear' : 'Ativar'}</button><button class="btn small secondary" onclick="Bella.copyText('${bookingUrl(s.slug)}')">Copiar agenda</button></div></div></article>`).join('')}
        </div>
      </main>
    `;
  }

  function login(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim().toLowerCase();
    const password = String(form.get('password'));
    const db = getDb();
    const user = db.users.find(u => u.email.toLowerCase() === email && u.password === password);
    if (!user) return toast('E-mail ou senha inválidos.');
    setSession(user.id);
    toast(user.mustChangePassword ? 'Crie uma nova senha para continuar.' : 'Bem-vinda ao BellaOS.');
    render();
  }

  function changePassword(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    const confirm = String(form.get('confirm'));
    if (password !== confirm) return toast('As senhas não conferem.');
    const user = currentUser();
    const db = getDb();
    const dbUser = db.users.find(u => u.id === user.id);
    dbUser.password = password;
    dbUser.mustChangePassword = false;
    saveDb(db);
    toast('Senha alterada com sucesso.');
    render();
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    state.view = 'home';
    window.history.pushState({}, '', '/');
    render();
  }

  function setDate(date) { state.selectedDate = date || todayISO(); render(); }
  function setClientSearch(value) { state.clientSearch = value; render(); }
  function setServiceFilter(value) { state.serviceFilter = value; render(); }
  function openModal(name, payload = {}) {
    const next = typeof name === 'object' ? name : { name, ...payload };
    if (next.name === 'appointment') {
      const today = todayISO();
      state.appointmentDraft = {
        items: [],
        draftProfessionalId: '',
        draftServiceId: '',
        date: state.selectedDate && state.selectedDate >= today ? state.selectedDate : today,
        time: ''
      };
    }
    state.modal = next;
    render();
  }
  function closeModal(event) { if (event && event.target !== event.currentTarget) return; state.modal = null; render(); }
  function openClient(clientId) { state.modal = { name: 'clientDetail', clientId }; render(); }
  function goLogin() { window.history.pushState({}, '', '/'); render(); }

  function updateAppointmentStatus(id, status) {
    if (!canEdit()) return;
    const db = getDb();
    const a = db.appointments.find(x => x.id === id);
    if (!a) return;
    a.status = status;
    if (status === 'concluido') {
      if (!db.financial.some(f => f.appointmentId === id)) {
        const { clients, services, products } = salonData(a.salonId);
        const client = clients.find(c => c.id === a.clientId);
        db.financial.push({ id: uid('fin'), salonId: a.salonId, type: 'receita', date: a.date, description: `${serviceName(a.serviceIds, services)} - ${client?.name || 'Cliente'}`, amount: a.total, payment: 'Pix', appointmentId: id });
        const dbClient = db.clients.find(c => c.id === a.clientId);
        if (dbClient) { dbClient.visits = Number(dbClient.visits || 0) + 1; dbClient.totalSpent = Number(dbClient.totalSpent || 0) + Number(a.total || 0); }
        a.serviceIds.forEach(serviceId => {
          const service = db.services.find(s => s.id === serviceId);
          (service?.products || []).forEach(use => {
            const product = db.products.find(p => p.id === use.productId);
            if (product) product.qty = Math.max(0, Number(product.qty) - Number(use.qty || 0));
          });
        });
      }
    }
    saveDb(db);
    toast(`Atendimento marcado como ${labelStatus(status)}.`);
    render();
  }

  function saveAppointment(event) {
    event.preventDefault();
    if (!canEdit()) return;
    const salon = currentSalon();
    const data = new FormData(event.currentTarget);
    const draft = ensureAppointmentDraft(salon.id);
    const items = sanitizeServiceItems(salon.id, draft.items);
    if (!items.length) return toast('Adicione pelo menos um serviço.');
    const date = String(data.get('date') || draft.date || '');
    const start = String(data.get('start') || draft.time || '');
    if (!start) return toast('Selecione um horário disponível.');
    const availableSlots = getMultiAvailableSlots(salon.id, items, date);
    if (!availableSlots.includes(start)) return toast('Este horário não está disponível ou já passou.');
    const db = getDb();
    const { services, professionals } = salonData(salon.id);
    const clientId = String(data.get('clientId'));
    const groupId = uid('grp');
    const notes = String(data.get('notes') || '');
    let cursor = timeToMin(start);
    items.forEach((item, index) => {
      const service = services.find(s => s.id === item.serviceId);
      const duration = itemDuration(item, services, salon);
      const appStart = minToTime(cursor);
      const appEnd = minToTime(cursor + duration);
      db.appointments.push({
        id: uid('app'),
        groupId,
        groupIndex: index + 1,
        groupTotal: items.length,
        salonId: salon.id,
        clientId,
        professionalId: item.professionalId,
        serviceIds: [item.serviceId],
        date,
        start: appStart,
        end: appEnd,
        status: 'agendado',
        total: Number(service?.price || 0),
        duration,
        notes: `${notes}${items.length > 1 ? (notes ? '\n' : '') + 'Atendimento combinado: ' + itemSummary(items, services, professionals, start) : ''}`,
        createdBy: currentUser().id,
        createdAt: new Date().toISOString()
      });
      cursor += duration;
    });
    saveDb(db);
    state.modal = null;
    state.selectedDate = date;
    state.appointmentDraft = { items: [], draftProfessionalId: '', draftServiceId: '', date: todayISO(), time: '' };
    toast(items.length > 1 ? 'Atendimento com múltiplos serviços criado.' : 'Agendamento criado.');
    render();
  }

  function saveClient(event, clientId = '') {
    event.preventDefault();
    if (!canEdit()) return;
    const salon = currentSalon();
    const data = new FormData(event.currentTarget);
    const payload = {
      salonId: salon.id,
      name: String(data.get('name')).trim(),
      phone: String(data.get('phone')).trim(),
      email: String(data.get('email') || '').trim(),
      preferredProfessionalId: String(data.get('preferredProfessionalId') || ''),
      notes: String(data.get('notes') || ''),
      formula: String(data.get('formula') || '')
    };
    if (!payload.name || !payload.phone) return toast('Informe nome e WhatsApp.');
    const db = getDb();
    const existing = db.clients.find(c => c.id === clientId && c.salonId === salon.id);
    if (existing) Object.assign(existing, payload);
    else db.clients.push({ id: uid('cli'), ...payload, visits: 0, totalSpent: 0, createdAt: new Date().toISOString() });
    saveDb(db);
    state.modal = null;
    toast(existing ? 'Cliente atualizada.' : 'Cliente cadastrada.');
    render();
  }

  function saveService(event, serviceId = '') {
    event.preventDefault();
    if (!canEdit()) return;
    const salon = currentSalon();
    const data = new FormData(event.currentTarget);
    const payload = {
      salonId: salon.id,
      categoryId: String(data.get('categoryId')),
      name: String(data.get('name')).trim(),
      price: Number(data.get('price')),
      duration: Number(data.get('duration')),
      minAdvanceMinutes: Number(data.get('minAdvanceMinutes')),
      buffer: salon.bufferMinutes,
      active: data.has('active'),
      commissionType: String(data.get('commissionType')),
      commissionValue: Number(data.get('commissionValue') || 0)
    };
    if (!payload.name || !payload.price || !payload.duration) return toast('Preencha nome, preço e duração.');
    const db = getDb();
    const existing = db.services.find(s => s.id === serviceId && s.salonId === salon.id);
    if (existing) Object.assign(existing, payload, { products: existing.products || [] });
    else db.services.push({ id: uid('srv'), ...payload, products: [] });
    saveDb(db);
    state.modal = null;
    toast(existing ? 'Serviço atualizado.' : 'Serviço cadastrado.');
    render();
  }

  function saveProfessional(event, professionalId = '') {
    event.preventDefault();
    if (!canEdit()) return;
    const salon = currentSalon();
    const data = new FormData(event.currentTarget);
    const services = data.getAll('services');
    if (!services.length) return toast('Selecione pelo menos um serviço.');
    const payload = {
      salonId: salon.id,
      name: String(data.get('name')).trim(),
      phone: String(data.get('phone') || '').trim(),
      specialty: String(data.get('specialty') || '').trim(),
      services,
      start: String(data.get('start')),
      end: String(data.get('end')),
      commissionDefault: Number(data.get('commissionDefault') || 0),
      active: data.has('active')
    };
    if (!payload.name) return toast('Informe o nome da profissional.');
    const db = getDb();
    const existing = db.professionals.find(p => p.id === professionalId && p.salonId === salon.id);
    if (existing) Object.assign(existing, payload, {
      workDays: existing.workDays || [1,2,3,4,5,6],
      lunchStart: existing.lunchStart || '12:30',
      lunchEnd: existing.lunchEnd || '13:30',
      color: existing.color || '#C89B7B'
    });
    else db.professionals.push({ id: uid('pro'), ...payload, workDays: [1,2,3,4,5,6], lunchStart: '12:30', lunchEnd: '13:30', color: '#C89B7B' });
    saveDb(db);
    state.modal = null;
    toast(existing ? 'Profissional atualizada.' : 'Profissional cadastrada.');
    render();
  }

  function deleteClient(clientId) {
    if (!canEdit()) return;
    const db = getDb();
    const client = db.clients.find(c => c.id === clientId && c.salonId === currentSalon()?.id);
    if (!client) return;
    const relatedAppointmentIds = db.appointments.filter(a => a.clientId === clientId).map(a => a.id);
    const message = relatedAppointmentIds.length
      ? `Excluir ${client.name}? A ficha, histórico capilar e ${relatedAppointmentIds.length} agendamento(s) vinculados também serão removidos.`
      : `Excluir ${client.name}?`;
    if (!confirm(message)) return;
    db.clients = db.clients.filter(c => c.id !== clientId);
    db.hairHistory = db.hairHistory.filter(h => h.clientId !== clientId);
    db.appointments = db.appointments.filter(a => a.clientId !== clientId);
    db.financial = db.financial.filter(f => !relatedAppointmentIds.includes(f.appointmentId));
    saveDb(db);
    state.modal = null;
    toast('Cliente excluída.');
    render();
  }

  function deleteService(serviceId) {
    if (!canEdit()) return;
    const db = getDb();
    const salon = currentSalon();
    const service = db.services.find(s => s.id === serviceId && s.salonId === salon?.id);
    if (!service) return;
    if (!confirm(`Excluir o serviço "${service.name}"? Ele será removido das profissionais e dos agendamentos vinculados.`)) return;
    db.services = db.services.filter(s => s.id !== serviceId);
    db.professionals.forEach(p => { p.services = (p.services || []).filter(id => id !== serviceId); });
    const appointmentsToRemove = [];
    db.appointments.forEach(a => {
      if (!a.serviceIds?.includes(serviceId)) return;
      a.serviceIds = a.serviceIds.filter(id => id !== serviceId);
      if (!a.serviceIds.length) {
        appointmentsToRemove.push(a.id);
        return;
      }
      const availableServices = db.services.filter(s => s.salonId === a.salonId);
      a.total = a.serviceIds.reduce((sum, id) => sum + Number(availableServices.find(s => s.id === id)?.price || 0), 0);
      a.duration = a.serviceIds.reduce((sum, id) => sum + Number(availableServices.find(s => s.id === id)?.duration || 0) + Number(availableServices.find(s => s.id === id)?.buffer || salon?.bufferMinutes || 0), 0);
      a.end = minToTime(timeToMin(a.start) + Number(a.duration || 0));
    });
    if (appointmentsToRemove.length) {
      db.appointments = db.appointments.filter(a => !appointmentsToRemove.includes(a.id));
      db.financial = db.financial.filter(f => !appointmentsToRemove.includes(f.appointmentId));
    }
    saveDb(db);
    state.modal = null;
    toast('Serviço excluído.');
    render();
  }

  function deleteProfessional(professionalId) {
    if (!canEdit()) return;
    const db = getDb();
    const pro = db.professionals.find(p => p.id === professionalId && p.salonId === currentSalon()?.id);
    if (!pro) return;
    const related = db.appointments.filter(a => a.professionalId === professionalId).length;
    const message = related
      ? `Excluir ${pro.name}? Os agendamentos antigos serão mantidos, mas ficarão sem profissional definida.`
      : `Excluir ${pro.name}?`;
    if (!confirm(message)) return;
    db.professionals = db.professionals.filter(p => p.id !== professionalId);
    db.clients.forEach(c => { if (c.preferredProfessionalId === professionalId) c.preferredProfessionalId = ''; });
    db.appointments.forEach(a => { if (a.professionalId === professionalId) a.professionalId = ''; });
    db.hairHistory.forEach(h => { if (h.professionalId === professionalId) h.professionalId = ''; });
    saveDb(db);
    state.modal = null;
    toast('Profissional excluída.');
    render();
  }

  function saveFinancial(event) {
    event.preventDefault();
    if (!canEdit()) return;
    const salon = currentSalon();
    const data = new FormData(event.currentTarget);
    const db = getDb();
    db.financial.push({ id: uid('fin'), salonId: salon.id, type: String(data.get('type')), date: String(data.get('date')), description: String(data.get('description')), amount: Number(data.get('amount')), payment: String(data.get('payment')) });
    saveDb(db);
    state.modal = null;
    toast('Lançamento salvo.');
    render();
  }

  function saveProduct(event) {
    event.preventDefault();
    if (!canEdit()) return;
    const salon = currentSalon();
    const data = new FormData(event.currentTarget);
    const db = getDb();
    db.products.push({ id: uid('prod'), salonId: salon.id, name: String(data.get('name')), category: String(data.get('category')), qty: Number(data.get('qty')), unit: String(data.get('unit')), minQty: Number(data.get('minQty')), cost: Number(data.get('cost') || 0), supplier: String(data.get('supplier') || '') });
    saveDb(db);
    state.modal = null;
    toast('Produto cadastrado.');
    render();
  }

  function adjustStock(productId, direction) {
    if (!canEdit()) return;
    const amount = Number(prompt(direction > 0 ? 'Quantidade de entrada:' : 'Quantidade de baixa:', '1'));
    if (!amount || amount <= 0) return;
    const db = getDb();
    const p = db.products.find(x => x.id === productId);
    if (!p) return;
    p.qty = direction > 0 ? Number(p.qty) + amount : Math.max(0, Number(p.qty) - amount);
    saveDb(db);
    toast(direction > 0 ? 'Entrada registrada.' : 'Baixa registrada.');
    render();
  }

  function saveSettings(event) {
    event.preventDefault();
    if (!canEdit()) return;
    const data = new FormData(event.currentTarget);
    const user = currentUser();
    const db = getDb();
    const salon = db.salons.find(s => s.id === user.salonId);
    const newSlug = slugify(data.get('slug'));
    const slugTaken = db.salons.some(s => s.id !== salon.id && s.slug === newSlug);
    if (slugTaken) return toast('Este slug já está em uso.');
    Object.assign(salon, {
      name: String(data.get('name')),
      slug: newSlug,
      whatsapp: String(data.get('whatsapp')),
      address: String(data.get('address') || ''),
      openingStart: String(data.get('openingStart')),
      openingEnd: String(data.get('openingEnd')),
      minAdvanceMinutes: Number(data.get('minAdvanceMinutes')),
      allowSameDay: data.has('allowSameDay'),
      showPrices: data.has('showPrices'),
      bookingEnabled: data.has('bookingEnabled')
    });
    saveDb(db);
    toast('Configurações salvas.');
    render();
  }

  function copyBookingLink() {
    const salon = currentSalon();
    copyText(bookingUrl(salon.slug));
  }
  function openBookingLink() { const salon = currentSalon(); window.open(bookingUrl(salon.slug), '_blank'); }
  function shareBookingLink() {
    const salon = currentSalon();
    const link = bookingUrl(salon.slug);
    window.open(`https://wa.me/?text=${encodeURIComponent(`Agende seu horário no ${salon.name}: ${link}`)}`, '_blank');
  }
  function copyText(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    toast('Link copiado.');
  }

  function setPublicItemDraft(field, value) {
    const salon = salonBySlug(location.pathname.split('/agenda/')[1] || '') || currentSalon();
    if (!salon) return;
    ensurePublicBookingState(salon.id);
    if (field === 'professionalId') {
      state.publicBooking.draftProfessionalId = value;
      const available = getActiveServicesForProfessional(salon.id, value);
      state.publicBooking.draftServiceId = available[0]?.id || '';
    }
    if (field === 'serviceId') state.publicBooking.draftServiceId = value;
    render();
  }

  function addPublicItem() {
    const salon = salonBySlug(location.pathname.split('/agenda/')[1] || '') || currentSalon();
    if (!salon) return;
    const b = ensurePublicBookingState(salon.id);
    if (!b.draftProfessionalId || !b.draftServiceId) return toast('Escolha profissional e serviço.');
    const valid = getActiveServicesForProfessional(salon.id, b.draftProfessionalId).some(s => s.id === b.draftServiceId);
    if (!valid) return toast('Este serviço não pertence à profissional escolhida.');
    b.items.push({ id: uid('bi'), professionalId: b.draftProfessionalId, serviceId: b.draftServiceId });
    b.time = '';
    render();
  }

  function removePublicItem(index) {
    state.publicBooking.items.splice(index, 1);
    state.publicBooking.time = '';
    render();
  }

  function setAppointmentItemDraft(field, value) {
    const salon = currentSalon();
    if (!salon) return;
    ensureAppointmentDraft(salon.id);
    if (field === 'professionalId') {
      state.appointmentDraft.draftProfessionalId = value;
      const available = getActiveServicesForProfessional(salon.id, value);
      state.appointmentDraft.draftServiceId = available[0]?.id || '';
    }
    if (field === 'serviceId') state.appointmentDraft.draftServiceId = value;
    render();
  }

  function addAppointmentItem() {
    const salon = currentSalon();
    if (!salon) return;
    const d = ensureAppointmentDraft(salon.id);
    if (!d.draftProfessionalId || !d.draftServiceId) return toast('Escolha profissional e serviço.');
    const valid = getActiveServicesForProfessional(salon.id, d.draftProfessionalId).some(s => s.id === d.draftServiceId);
    if (!valid) return toast('Este serviço não pertence à profissional escolhida.');
    d.items.push({ id: uid('ai'), professionalId: d.draftProfessionalId, serviceId: d.draftServiceId });
    d.time = '';
    render();
  }

  function removeAppointmentItem(index) {
    state.appointmentDraft.items.splice(index, 1);
    state.appointmentDraft.time = '';
    render();
  }

  function togglePublicService(serviceId) {
    const salon = salonBySlug(location.pathname.split('/agenda/')[1] || '') || currentSalon();
    if (!salon) return;
    ensurePublicBookingState(salon.id);
    state.publicBooking.draftServiceId = serviceId;
    addPublicItem();
  }

  function setPublic(field, value) {
    const salon = salonBySlug(location.pathname.split('/agenda/')[1] || '') || currentSalon();
    if (field === 'date' && value < todayISO()) value = todayISO();
    state.publicBooking[field] = value;
    if (field === 'date') state.publicBooking.time = '';
    if (salon) ensurePublicBookingState(salon.id);
    render();
  }

  function setAppointmentDraft(field, value) {
    const salon = currentSalon();
    if (!salon) return;
    if (field === 'date' && value < todayISO()) value = todayISO();
    state.appointmentDraft[field] = value;
    if (field === 'date') state.appointmentDraft.time = '';
    ensureAppointmentDraft(salon.id);
    render();
  }

  function toggleAppointmentService(serviceId) {
    const salon = currentSalon();
    if (!salon) return;
    ensureAppointmentDraft(salon.id);
    state.appointmentDraft.draftServiceId = serviceId;
    addAppointmentItem();
  }

  function confirmPublicBooking(salonId) {
    const { salon, services, professionals } = salonData(salonId);
    const b = ensurePublicBookingState(salonId);
    const items = sanitizeServiceItems(salonId, b.items);
    if (!items.length) return toast('Adicione pelo menos um serviço.');
    if (!b.date || !b.time) return toast('Escolha uma data e horário.');
    if (b.date < todayISO()) return toast('Escolha uma data atual ou futura.');
    if (!b.clientName.trim() || normalizePhone(b.clientPhone).length < 10) return toast('Informe nome e WhatsApp válidos.');
    const slots = getMultiAvailableSlots(salonId, items, b.date);
    if (!slots.includes(b.time)) return toast('Este horário não está mais disponível.');
    const db = getDb();
    let client = db.clients.find(c => c.salonId === salonId && normalizePhone(c.phone) === normalizePhone(b.clientPhone));
    if (!client) {
      client = { id: uid('cli'), salonId, name: b.clientName.trim(), phone: b.clientPhone.trim(), email: '', preferredProfessionalId: items[0].professionalId, notes: '', formula: '', visits: 0, totalSpent: 0, createdAt: new Date().toISOString() };
      db.clients.push(client);
    }
    const groupId = uid('grp');
    let cursor = timeToMin(b.time);
    const summary = itemSummary(items, services, professionals, b.time);
    items.forEach((item, index) => {
      const service = services.find(s => s.id === item.serviceId);
      const duration = itemDuration(item, services, salon);
      const start = minToTime(cursor);
      const end = minToTime(cursor + duration);
      db.appointments.push({
        id: uid('app'),
        groupId,
        groupIndex: index + 1,
        groupTotal: items.length,
        salonId,
        clientId: client.id,
        professionalId: item.professionalId,
        serviceIds: [item.serviceId],
        date: b.date,
        start,
        end,
        status: 'agendado',
        total: Number(service?.price || 0),
        duration,
        notes: `${b.notes || 'Agendado pela cliente no link público.'}${items.length > 1 ? '\nAtendimento combinado: ' + summary : ''}`,
        createdBy: 'public',
        createdAt: new Date().toISOString()
      });
      cursor += duration;
    });
    saveDb(db);
    const msg = `Olá, ${client.name}! Seu horário no ${salon.name} foi solicitado para ${brDate(b.date)}. Serviços: ${summary}. Valor total: ${money(multiServiceTotal(items, services))}.`;
    state.publicBooking = { items: [], draftProfessionalId: '', draftServiceId: '', date: todayISO(), time: '', clientName: '', clientPhone: '', notes: '' };
    render();
    setTimeout(() => {
      toast('Agendamento confirmado.');
      const open = confirm('Agendamento confirmado! Deseja enviar a confirmação pelo WhatsApp?');
      if (open) window.open(`https://wa.me/55${normalizePhone(client.phone)}?text=${encodeURIComponent(msg)}`, '_blank');
    }, 120);
  }

  function addHairHistoryPrompt(clientId) {
    if (!canEdit()) return;
    const service = prompt('Serviço realizado:', 'Coloração');
    if (!service) return;
    const formula = prompt('Fórmula usada:', '7.1 + OX 20 volumes') || '';
    const notes = prompt('Observações:', '') || '';
    const salon = currentSalon();
    const db = getDb();
    db.hairHistory.push({ id: uid('hist'), salonId: salon.id, clientId, date: todayISO(), service, formula, products: '', professionalId: '', notes });
    saveDb(db);
    toast('Histórico capilar adicionado.');
    render();
  }

  function toggleSalonStatus(salonId) {
    const user = currentUser();
    if (!user || user.role !== 'super_admin') return;
    const db = getDb();
    const salon = db.salons.find(s => s.id === salonId);
    salon.status = salon.status === 'ativo' ? 'bloqueado' : 'ativo';
    saveDb(db);
    toast(`Salão ${salon.status}.`);
    render();
  }

  function openAdminCreateSalon() {
    const user = currentUser();
    if (!user || user.role !== 'super_admin') return;
    const name = prompt('Nome do salão:');
    if (!name) return;
    const email = prompt('E-mail do usuário principal:');
    if (!email) return;
    const db = getDb();
    const salonId = uid('salon');
    const slug = slugify(name);
    db.salons.push({ id: salonId, name, slug, logoUrl: '/assets/logo-mark.svg', whatsapp: '', address: '', openingStart: '09:00', openingEnd: '19:00', minAdvanceMinutes: 120, bufferMinutes: 10, allowSameDay: true, allowAnyProfessional: true, showPrices: true, bookingEnabled: true, color: '#C89B7B', status: 'ativo', plan: 'Essencial', createdAt: new Date().toISOString() });
    db.users.push({ id: uid('u'), salonId, name: 'Usuária Principal', email, password: 'bella123', role: 'owner', mustChangePassword: true, isDemo: false });
    db.categories.push(...['Cabelo','Unhas','Sobrancelhas','Maquiagem','Noivas','Estética','Pacotes'].map(n => ({ id: uid('cat'), salonId, name: n })));
    saveDb(db);
    toast('Salão criado com senha temporária bella123.');
    render();
  }

  window.Bella = {
    login, changePassword, logout, navigate, openModal, closeModal, setDate, setClientSearch, setServiceFilter,
    updateAppointmentStatus, saveAppointment, saveClient, saveService, saveProfessional, deleteClient, deleteService, deleteProfessional, saveFinancial, saveProduct,
    adjustStock, saveSettings, copyBookingLink, openBookingLink, shareBookingLink, copyText, togglePublicService, setPublicItemDraft, addPublicItem, removePublicItem,
    setAppointmentItemDraft, addAppointmentItem, removeAppointmentItem,
    setPublic, setAppointmentDraft, toggleAppointmentService, confirmPublicBooking, openClient, addHairHistoryPrompt, toast, goLogin, toggleSalonStatus, openAdminCreateSalon
  };

  window.addEventListener('popstate', render);
  startRemoteSync();
  render();
})();
