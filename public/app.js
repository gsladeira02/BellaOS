(() => {
  const DB_KEY = 'bellaos.db.v1';
  const SESSION_KEY = 'bellaos.session.v1';
  const PUBLIC_BASE_URL = 'https://bella-os.vercel.app';
  const SUPABASE_PROJECT_URL = 'https://omhrigszheellguyyihz.supabase.co';
  const SUPABASE_REST_URL = `${SUPABASE_PROJECT_URL}/rest/v1`;
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Urza4wG2be2xxgMzxJrCEQ_ya_uV0z-';
  const SUPABASE_STATE_ID = 'bellaos_app';
  const USE_SUPABASE_SYNC = true;
  const BELLAOS_PLAN_PRICE_CENTS = 6990;
  const BELLAOS_PLAN_NAME = 'BellaOS Completo';

  const BELLAOS_PLANS = [
    { id: 'mensal', name: 'Mensal', label: 'Mensal', priceText: 'R$ 69,90', displayText: 'R$ 69,90/m\u00eas', recurrenceText: 'Renova a cada 1 m\u00eas', installments: 1, installmentCents: 6990, amountCents: 6990, cycleMonths: 1 },
    { id: 'trimestral', name: 'Trimestral', label: 'Trimestral', priceText: '3x de R$ 64,90', displayText: '3x de R$ 64,90', recurrenceText: 'Renova a cada 3 meses', installments: 3, installmentCents: 6490, amountCents: 19470, cycleMonths: 3 },
    { id: 'semestral', name: 'Semestral', label: 'Semestral', priceText: '6x de R$ 59,90', displayText: '6x de R$ 59,90', recurrenceText: 'Renova a cada 6 meses', installments: 6, installmentCents: 5990, amountCents: 35940, cycleMonths: 6 },
    { id: 'anual', name: 'Anual', label: 'Anual', priceText: '12x de R$ 39,90', displayText: '12x de R$ 39,90', recurrenceText: 'Renova a cada 12 meses', installments: 12, installmentCents: 3990, amountCents: 47880, cycleMonths: 12 }
  ];
  const DEFAULT_INFINITEPAY_HANDLE = 'sistemasos';
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


  function getPlan(planId = 'mensal') {
    return BELLAOS_PLANS.find(p => p.id === planId) || BELLAOS_PLANS[0];
  }

  function addMonthsISOFrom(dateISO, months) {
    const [y, m, d] = String(dateISO || todayISO()).split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    date.setMonth(date.getMonth() + Number(months || 0));
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function addDaysToISO(dateISO, days) {
    const [y, m, d] = String(dateISO || todayISO()).split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    date.setDate(date.getDate() + Number(days || 0));
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function subscriptionLockInfo(salon) {
    if (!salon) return { locked: false };
    const status = salon.subscriptionStatus || 'teste';
    const dueDate = salon.subscriptionDueDate || salon.subscriptionCurrentPeriodEnd || '';
    const paidStatuses = ['ativo', 'teste'];
    if (['cancelado', 'bloqueado'].includes(status)) {
      return { locked: true, dueDate, graceDate: dueDate ? addDaysToISO(dueDate, 3) : '', reason: 'Assinatura cancelada ou bloqueada.' };
    }
    if (status === 'pendente' && !salon.subscriptionPaidAt) {
      return { locked: true, dueDate: dueDate || todayISO(), graceDate: dueDate ? addDaysToISO(dueDate, 3) : '', reason: 'Pagamento pendente.' };
    }
    if (!dueDate) return { locked: false, dueDate: '', graceDate: '' };
    const graceDate = addDaysToISO(dueDate, 3);
    const today = todayISO();
    const locked = today > graceDate && !paidStatuses.includes(status);
    return { locked, dueDate, graceDate, reason: locked ? 'Pagamento vencido h\u00e1 mais de 3 dias.' : '' };
  }

  function activateSalonSubscription(salonId, planId, orderNsu = '') {
    const db = getDb();
    const salon = db.salons.find(s => s.id === salonId);
    if (!salon) return { ok: false, reason: 'Sal\u00e3o n\u00e3o encontrado.' };

    const receivedOrder = String(orderNsu || '').trim();
    const currentOrder = String(salon.subscriptionOrderNsu || '').trim();

    if (receivedOrder && currentOrder && receivedOrder !== currentOrder) {
      return {
        ok: false,
        outdated: true,
        reason: 'Este link de pagamento foi substitu\u00eddo por um checkout mais recente.'
      };
    }

    const plan = getPlan(planId || salon.subscriptionPlanId || 'mensal');
    const start = todayISO();
    salon.plan = BELLAOS_PLAN_NAME;
    salon.subscriptionPlanId = plan.id;
    salon.subscriptionPlanName = plan.name;
    salon.subscriptionStatus = 'ativo';
    salon.subscriptionPrice = plan.amountCents / 100;
    salon.subscriptionCycleMonths = plan.cycleMonths;
    salon.subscriptionInstallments = plan.installments;
    salon.subscriptionInstallmentCents = plan.installmentCents;
    salon.subscriptionStartedAt = start;
    salon.subscriptionDueDate = addMonthsISOFrom(start, plan.cycleMonths);
    salon.subscriptionGraceUntil = addDaysToISO(salon.subscriptionDueDate, 3);
    salon.subscriptionOrderNsu = receivedOrder || currentOrder || '';
    salon.subscriptionPaidAt = new Date().toISOString();
    salon.subscriptionUpdatedAt = new Date().toISOString();
    saveDb(db);
    return { ok: true, plan, dueDate: salon.subscriptionDueDate };
  }

  function planCardsHtml(inputName = 'planId', selected = 'mensal') {
    return `<div class="plan-options">${BELLAOS_PLANS.map(plan => `
      <label class="plan-option ${selected === plan.id ? 'selected' : ''}">
        <input type="radio" name="${inputName}" value="${plan.id}" ${selected === plan.id ? 'checked' : ''}>
        <span class="plan-option-name">${esc(plan.label)}</span>
        <strong>${esc(plan.priceText)}</strong>
        <small>${esc(plan.recurrenceText)}</small>
      </label>`).join('')}</div>`;
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


  const WEEK_DAYS = [
    { value: 0, label: 'Domingo', short: 'Dom' },
    { value: 1, label: 'Segunda', short: 'Seg' },
    { value: 2, label: 'Ter\u00e7a', short: 'Ter' },
    { value: 3, label: 'Quarta', short: 'Qua' },
    { value: 4, label: 'Quinta', short: 'Qui' },
    { value: 5, label: 'Sexta', short: 'Sex' },
    { value: 6, label: 'S\u00e1bado', short: 'S\u00e1b' }
  ];

  function defaultWeeklySchedule(professional = {}) {
    const workDays = Array.isArray(professional.workDays) ? professional.workDays : [1,2,3,4,5,6];
    return WEEK_DAYS.reduce((acc, day) => {
      acc[day.value] = {
        active: workDays.includes(day.value),
        start: professional.start || '09:00',
        end: professional.end || '18:00',
        breakStart: professional.lunchStart || '12:30',
        breakEnd: professional.lunchEnd || '13:30'
      };
      return acc;
    }, {});
  }

  function normalizedWeeklySchedule(professional = {}) {
    const fallback = defaultWeeklySchedule(professional);
    const saved = professional.weeklySchedule || professional.schedule || {};
    return WEEK_DAYS.reduce((acc, day) => {
      const row = saved[String(day.value)] || saved[day.value] || fallback[day.value];
      acc[day.value] = {
        active: Boolean(row?.active),
        start: row?.start || fallback[day.value].start || '09:00',
        end: row?.end || fallback[day.value].end || '18:00',
        breakStart: row?.breakStart ?? row?.lunchStart ?? fallback[day.value].breakStart ?? '',
        breakEnd: row?.breakEnd ?? row?.lunchEnd ?? fallback[day.value].breakEnd ?? ''
      };
      return acc;
    }, {});
  }

  function firstActiveSchedule(weeklySchedule) {
    return WEEK_DAYS.map(d => weeklySchedule[d.value]).find(row => row?.active) || { start: '09:00', end: '18:00', breakStart: '12:30', breakEnd: '13:30' };
  }

  function scheduleFromForm(data) {
    return WEEK_DAYS.reduce((acc, day) => {
      acc[day.value] = {
        active: data.has(`dayActive_${day.value}`),
        start: String(data.get(`dayStart_${day.value}`) || '09:00'),
        end: String(data.get(`dayEnd_${day.value}`) || '18:00'),
        breakStart: String(data.get(`dayBreakStart_${day.value}`) || ''),
        breakEnd: String(data.get(`dayBreakEnd_${day.value}`) || '')
      };
      return acc;
    }, {});
  }

  function validateWeeklySchedule(weeklySchedule) {
    const activeDays = WEEK_DAYS.filter(day => weeklySchedule[day.value]?.active);
    if (!activeDays.length) return 'Selecione pelo menos um dia de trabalho.';
    for (const day of activeDays) {
      const row = weeklySchedule[day.value];
      const start = timeToMin(row.start);
      const end = timeToMin(row.end);
      if (start >= end) return `Revise o hor\u00e1rio de ${day.label}: in\u00edcio precisa ser antes do fim.`;
      if (row.breakStart && row.breakEnd) {
        const breakStart = timeToMin(row.breakStart);
        const breakEnd = timeToMin(row.breakEnd);
        if (breakStart >= breakEnd) return `Revise o intervalo de ${day.label}.`;
        if (breakStart < start || breakEnd > end) return `O intervalo de ${day.label} precisa ficar dentro do hor\u00e1rio de trabalho.`;
      }
    }
    return '';
  }

  function dateException(salonId, date, scope = 'salon', professionalId = '') {
    const db = getDb();
    return (db.scheduleExceptions || []).find(x =>
      x.salonId === salonId &&
      x.date === date &&
      x.scope === scope &&
      (scope === 'salon' || x.professionalId === professionalId)
    ) || null;
  }

  function exceptionToSchedule(exception) {
    if (!exception || exception.closed) return null;
    return {
      active: true,
      start: exception.start || '09:00',
      end: exception.end || '18:00',
      breakStart: exception.breakStart || '',
      breakEnd: exception.breakEnd || ''
    };
  }

  function salonHoursForDate(salon, date) {
    const exception = dateException(salon.id, date, 'salon');
    if (exception?.closed) return null;
    if (exception) return exceptionToSchedule(exception);
    return {
      active: true,
      start: salon.openingStart || '09:00',
      end: salon.openingEnd || '19:00',
      breakStart: '',
      breakEnd: ''
    };
  }

  function scheduleForDate(professional, date, salonId = professional?.salonId) {
    if (!professional?.active) return null;
    const salonException = salonId ? dateException(salonId, date, 'salon') : null;
    if (salonException?.closed) return null;
    const professionalException = salonId ? dateException(salonId, date, 'professional', professional.id) : null;
    if (professionalException?.closed) return null;
    if (professionalException) return exceptionToSchedule(professionalException);
    const day = new Date(date + 'T00:00:00').getDay();
    const schedule = normalizedWeeklySchedule(professional)[day];
    return schedule?.active ? schedule : null;
  }

  function scheduleSummary(professional) {
    const weekly = normalizedWeeklySchedule(professional);
    const activeDays = WEEK_DAYS.filter(day => weekly[day.value]?.active);
    if (!activeDays.length) return 'Sem dias ativos';
    const labels = activeDays.map(day => day.short).join(', ');
    const hours = new Set(activeDays.map(day => `${weekly[day.value].start}-${weekly[day.value].end}`));
    const breaks = new Set(activeDays.map(day => `${weekly[day.value].breakStart || ''}-${weekly[day.value].breakEnd || ''}`));
    if (hours.size === 1 && breaks.size === 1) {
      const row = weekly[activeDays[0].value];
      const interval = row.breakStart && row.breakEnd ? ` \u00b7 Intervalo ${row.breakStart} \u00e0s ${row.breakEnd}` : ' \u00b7 Sem intervalo';
      return `${labels} \u00b7 ${row.start} \u00e0s ${row.end}${interval}`;
    }
    return `${labels} \u00b7 hor\u00e1rios por dia configurados`;
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
        plan: 'BellaOS Completo',
        subscriptionStatus: 'ativo',
        subscriptionPlanId: 'mensal',
        subscriptionPlanName: 'Mensal',
        subscriptionPrice: 69.90,
        subscriptionCycleMonths: 1,
        subscriptionInstallments: 1,
        subscriptionInstallmentCents: 6990,
        subscriptionDueDate: addMonthsISOFrom(todayISO(), 1),
        subscriptionGraceUntil: addDaysToISO(addMonthsISOFrom(todayISO(), 1), 3),
        infinitePayHandle: '',
        setupCompleted: false,
        setupStep: 1,
        createdAt: new Date().toISOString()
      }],
      units: [
        { id: 'unit_studio_bella', salonId, name: 'Studio Bella - Centro', address: 'Rua das Flores, 120 - Centro', phone: '27999999999', active: true, createdAt: new Date().toISOString() }
      ],
      users: [
        { id: 'u_owner', salonId, name: 'Dona do Studio Bella', email: 'contato@studiobella.com', password: 'bella123', role: 'owner', mustChangePassword: false, isDemo: false },
        { id: 'u_first', salonId, name: 'Primeiro Acesso', email: 'primeiro@studiobella.com', password: 'trocar123', role: 'owner', mustChangePassword: true, isDemo: false },
        { id: 'u_demo', salonId, name: 'Conta Demonstra\u00e7\u00e3o', email: 'demo@bellaos.com', password: 'demo123', role: 'owner', mustChangePassword: false, isDemo: false },
        { id: 'u_admin', salonId: null, name: 'Admin BellaOS', email: 'admin@bellaos.com', password: 'admin123', role: 'super_admin', mustChangePassword: false, isDemo: false }
      ],
      categories: [
        { id: 'cat_cabelo', salonId, name: 'Cabelo' },
        { id: 'cat_unhas', salonId, name: 'Unhas' },
        { id: 'cat_sobrancelhas', salonId, name: 'Sobrancelhas' },
        { id: 'cat_make', salonId, name: 'Maquiagem' },
        { id: 'cat_penteados', salonId, name: 'Penteados' },
        { id: 'cat_noivas', salonId, name: 'Noivas' },
        { id: 'cat_estetica', salonId, name: 'Est\u00e9tica' },
        { id: 'cat_pacotes', salonId, name: 'Pacotes' }
      ],
      services: [
        { id: 'srv_escova', salonId, categoryId: 'cat_cabelo', name: 'Escova modelada', price: 75, duration: 45, minAdvanceMinutes: 60, buffer: 10, active: true, commissionType: 'percent', commissionValue: 40, products: [{ productId: 'prod_shampoo', qty: 20 }, { productId: 'prod_mascara', qty: 15 }] },
        { id: 'srv_corte', salonId, categoryId: 'cat_cabelo', name: 'Corte feminino', price: 95, duration: 60, minAdvanceMinutes: 120, buffer: 10, active: true, commissionType: 'percent', commissionValue: 40, products: [] },
        { id: 'srv_hidratacao', salonId, categoryId: 'cat_cabelo', name: 'Hidrata\u00e7\u00e3o premium', price: 120, duration: 70, minAdvanceMinutes: 120, buffer: 10, active: true, commissionType: 'percent', commissionValue: 38, products: [{ productId: 'prod_mascara', qty: 35 }] },
        { id: 'srv_progressiva', salonId, categoryId: 'cat_cabelo', name: 'Progressiva', price: 260, duration: 180, minAdvanceMinutes: 1440, buffer: 20, active: true, commissionType: 'percent', commissionValue: 35, products: [{ productId: 'prod_progressiva', qty: 80 }] },
        { id: 'srv_luzes', salonId, categoryId: 'cat_cabelo', name: 'Luzes / Mechas', price: 390, duration: 240, minAdvanceMinutes: 2880, buffer: 20, active: true, commissionType: 'percent', commissionValue: 35, products: [{ productId: 'prod_ox', qty: 80 }, { productId: 'prod_tonalizante', qty: 1 }] },
        { id: 'srv_mani', salonId, categoryId: 'cat_unhas', name: 'Manicure', price: 38, duration: 50, minAdvanceMinutes: 60, buffer: 5, active: true, commissionType: 'fixed', commissionValue: 16, products: [{ productId: 'prod_esmalte', qty: 1 }] },
        { id: 'srv_pedi', salonId, categoryId: 'cat_unhas', name: 'Pedicure', price: 45, duration: 55, minAdvanceMinutes: 60, buffer: 5, active: true, commissionType: 'fixed', commissionValue: 18, products: [{ productId: 'prod_esmalte', qty: 1 }] },
        { id: 'srv_sobrancelha', salonId, categoryId: 'cat_sobrancelhas', name: 'Design de sobrancelha', price: 45, duration: 30, minAdvanceMinutes: 60, buffer: 5, active: true, commissionType: 'percent', commissionValue: 45, products: [] },
        { id: 'srv_make', salonId, categoryId: 'cat_make', name: 'Maquiagem social', price: 180, duration: 90, minAdvanceMinutes: 1440, buffer: 15, active: true, commissionType: 'percent', commissionValue: 40, products: [] },
        { id: 'srv_penteado', salonId, categoryId: 'cat_penteados', name: 'Penteado social', price: 160, duration: 75, minAdvanceMinutes: 1440, buffer: 15, active: true, commissionType: 'percent', commissionValue: 40, products: [] },
        { id: 'srv_noiva', salonId, categoryId: 'cat_noivas', name: 'Pacote noiva', price: 850, duration: 300, minAdvanceMinutes: 4320, buffer: 30, active: true, commissionType: 'percent', commissionValue: 35, products: [] }
      ],
      professionals: [
        { id: 'pro_ana', salonId, unitId: 'unit_studio_bella', name: 'Ana Clara', phone: '27988881111', specialty: 'Cabelo e qu\u00edmica', services: ['srv_escova','srv_corte','srv_hidratacao','srv_progressiva','srv_luzes','srv_noiva'], workDays: [1,2,3,4,5,6], start: '09:00', end: '18:00', lunchStart: '12:30', lunchEnd: '13:30', commissionDefault: 40, color: '#C89B7B', active: true },
        { id: 'pro_bia', salonId, unitId: 'unit_studio_bella', name: 'Beatriz Lima', phone: '27988882222', specialty: 'Unhas e sobrancelhas', services: ['srv_mani','srv_pedi','srv_sobrancelha'], workDays: [1,2,3,4,5,6], start: '09:30', end: '19:00', lunchStart: '13:00', lunchEnd: '14:00', commissionDefault: 42, color: '#8B5E4E', active: true },
        { id: 'pro_lu', salonId, unitId: 'unit_studio_bella', name: 'Luiza Rocha', phone: '27988883333', specialty: 'Maquiagem e penteado', services: ['srv_make','srv_penteado','srv_noiva','srv_escova'], workDays: [2,3,4,5,6], start: '10:00', end: '19:00', lunchStart: '14:00', lunchEnd: '15:00', commissionDefault: 40, color: '#4F8A6B', active: true }
      ],
      clients: [
        { id: 'cli_julia', salonId, name: 'Juliana Martins', phone: '27991112222', email: 'juliana@email.com', preferredProfessionalId: 'pro_ana', notes: 'Prefere escova modelada. Couro cabeludo sens\u00edvel.', formula: '7.1 + OX 20 volumes', visits: 5, totalSpent: 950, createdAt: new Date().toISOString() },
        { id: 'cli_maria', salonId, name: 'Maria Fernanda', phone: '27992223333', email: '', preferredProfessionalId: 'pro_bia', notes: 'Gosta de esmalte claro.', formula: '', visits: 3, totalSpent: 270, createdAt: new Date().toISOString() },
        { id: 'cli_larissa', salonId, name: 'Larissa Alves', phone: '27993334444', email: '', preferredProfessionalId: 'pro_lu', notes: 'Cliente para eventos e maquiagem.', formula: '', visits: 2, totalSpent: 420, createdAt: new Date().toISOString() }
      ],
      hairHistory: [
        { id: 'hist_1', salonId, clientId: 'cli_julia', date: addDaysISO(-18), service: 'Morena iluminada', formula: 'Tonalizante 7.1 + OX 20', products: 'Tonalizante 7.1, m\u00e1scara p\u00f3s-qu\u00edmica', professionalId: 'pro_ana', notes: 'Pontas sensibilizadas. Evitar descolora\u00e7\u00e3o forte na pr\u00f3xima sess\u00e3o.' }
      ],
      appointments: [
        { id: 'app_1', salonId, clientId: 'cli_julia', professionalId: 'pro_ana', serviceIds: ['srv_escova','srv_hidratacao'], date: todayISO(), start: '10:00', end: '12:05', status: 'confirmado', total: 195, duration: 125, notes: 'Cliente pediu escova modelada.', createdBy: 'u_owner', createdAt: new Date().toISOString() },
        { id: 'app_2', salonId, clientId: 'cli_maria', professionalId: 'pro_bia', serviceIds: ['srv_mani','srv_pedi'], date: todayISO(), start: '14:00', end: '15:50', status: 'agendado', total: 83, duration: 110, notes: '', createdBy: 'u_owner', createdAt: new Date().toISOString() },
        { id: 'app_3', salonId, clientId: 'cli_larissa', professionalId: 'pro_lu', serviceIds: ['srv_make'], date: addDaysISO(1), start: '16:00', end: '17:45', status: 'agendado', total: 180, duration: 105, notes: 'Maquiagem para formatura.', createdBy: 'u_owner', createdAt: new Date().toISOString() },
        { id: 'app_4', salonId, clientId: 'cli_julia', professionalId: 'pro_ana', serviceIds: ['srv_luzes'], date: addDaysISO(-2), start: '09:30', end: '13:50', status: 'concluido', total: 390, duration: 260, notes: '', createdBy: 'u_owner', createdAt: new Date().toISOString() }
      ],
      products: [
        { id: 'prod_shampoo', salonId, name: 'Shampoo profissional', category: 'Shampoo', unit: 'ml', qty: 1400, minQty: 500, cost: 0.08, supplier: 'Distribuidora Beauty' },
        { id: 'prod_mascara', salonId, name: 'M\u00e1scara hidrata\u00e7\u00e3o', category: 'M\u00e1scara', unit: 'ml', qty: 420, minQty: 500, cost: 0.18, supplier: 'Distribuidora Beauty' },
        { id: 'prod_progressiva', salonId, name: 'Progressiva premium', category: 'Progressiva', unit: 'ml', qty: 820, minQty: 300, cost: 0.65, supplier: 'Hair Pro' },
        { id: 'prod_ox', salonId, name: 'OX 20 volumes', category: 'Oxidante', unit: 'ml', qty: 650, minQty: 300, cost: 0.09, supplier: 'Color Mix' },
        { id: 'prod_tonalizante', salonId, name: 'Tonalizante 7.1', category: 'Colora\u00e7\u00e3o', unit: 'un', qty: 2, minQty: 4, cost: 22, supplier: 'Color Mix' },
        { id: 'prod_esmalte', salonId, name: 'Esmaltes variados', category: 'Esmalte', unit: 'un', qty: 38, minQty: 15, cost: 6.5, supplier: 'Nails Center' }
      ],
      financial: [
        { id: 'fin_1', salonId, type: 'receita', date: addDaysISO(-2), description: 'Luzes / Mechas - Juliana Martins', amount: 390, payment: 'Pix', appointmentId: 'app_4' },
        { id: 'fin_2', salonId, type: 'despesa', date: addDaysISO(-3), description: 'Compra de produtos', amount: 220, payment: 'Pix' }
      ],
      logs: [],
      scheduleExceptions: [
        { id: 'exc_demo', salonId, date: addDaysISO(7), scope: 'salon', professionalId: '', closed: false, start: '09:00', end: '13:00', breakStart: '', breakEnd: '', reason: 'Funcionamento especial pela manh\u00e3' }
      ]
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
      ['hairHistory','stockMovements','logs','categories','scheduleExceptions','units'].forEach(k => { if (!Array.isArray(parsed[k])) parsed[k] = []; });
      parsed.salons.forEach(salon => {
        if (salon.setupCompleted === undefined) salon.setupCompleted = false;
        if (!salon.setupStep) salon.setupStep = 1;
        const hasUnit = parsed.units.some(u => u.salonId === salon.id);
        if (!hasUnit) parsed.units.push({ id: uid('unit'), salonId: salon.id, name: salon.name || 'Unidade principal', address: salon.address || '', phone: salon.whatsapp || '', active: true, createdAt: new Date().toISOString() });
      });
      parsed.professionals.forEach(p => { if (!p.weeklySchedule) p.weeklySchedule = normalizedWeeklySchedule(p); });
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
      units: (db.units || []).filter(x => x.salonId === salonId),
      professionals: db.professionals.filter(x => x.salonId === salonId),
      clients: db.clients.filter(x => x.salonId === salonId),
      appointments: db.appointments.filter(x => x.salonId === salonId),
      products: db.products.filter(x => x.salonId === salonId),
      financial: db.financial.filter(x => x.salonId === salonId),
      hairHistory: db.hairHistory.filter(x => x.salonId === salonId),
      scheduleExceptions: (db.scheduleExceptions || []).filter(x => x.salonId === salonId)
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
    return ({ agendado: 'Agendado', confirmado: 'Confirmado', atendimento: 'Em atendimento', concluido: 'Conclu\u00eddo', cancelado: 'Cancelado', falta: 'N\u00e3o compareceu' })[status] || status;
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
    if (path.startsWith('/pagamento-concluido')) {
      renderPaymentSuccess();
      return;
    }
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

    const salon = currentSalon();
    const lock = subscriptionLockInfo(salon);
    if (lock.locked) {
      renderSubscriptionBlocked(user, salon, lock);
      return;
    }

    if (salon && !salon.setupCompleted) {
      renderOnboarding(user, salon);
      return;
    }

    renderSalonApp(user);
  }


  function renderPaymentSuccess() {
    const params = new URLSearchParams(window.location.search);
    const orderNsu = params.get('order_nsu') || '';
    const receiptUrl = params.get('receipt_url') || '';
    let title = 'Obrigada!';
    let activatedText = 'Em instantes sua assinatura ser\u00e1 atualizada no BellaOS.';
    let outdated = false;
    try {
      const internal = JSON.parse(localStorage.getItem('bellaos.last_internal_checkout') || '{}');
      const publicCheckout = JSON.parse(localStorage.getItem('bellaos.last_public_checkout') || '{}');
      const user = currentUser();
      const salonId = user?.salonId || internal?.salonId || publicCheckout?.salonId;
      const planId = internal?.planId || publicCheckout?.planId || 'mensal';
      const userId = user?.id || publicCheckout?.userId || '';
      const receivedOrder = orderNsu || internal?.orderNsu || publicCheckout?.orderNsu || '';
      if (salonId) {
        const result = activateSalonSubscription(salonId, planId, receivedOrder);
        if (result.outdated) {
          outdated = true;
          title = 'Checkout substitu\u00eddo';
          activatedText = 'Este link de pagamento n\u00e3o \u00e9 mais o pedido atual da assinatura. Gere um novo checkout na tela de regulariza\u00e7\u00e3o.';
        } else if (result.ok) {
          if (userId) setSession(userId);
          activatedText = `Assinatura ${result.plan.name} ativada. Pr\u00f3ximo vencimento em ${brDate(result.dueDate)}.`;
        }
      }
    } catch (error) {
      console.warn(error);
    }
    app.innerHTML = `
      <main class="booking-shell">
        <section class="public-hero">
          <div class="public-hero-logo"><img src="/assets/logo-mark.svg" alt="BellaOS"><div><div class="public-brand">${outdated ? 'Pagamento n\u00e3o aplicado' : 'Pagamento recebido'}</div><p>BellaOS Completo</p></div></div>
          <h1>${title}</h1>
          <p>${outdated ? activatedText : `Seu pagamento foi conclu\u00eddo na InfinitePay. ${activatedText}`}</p>
        </section>
        <div class="card">
          <div class="card-title">Resumo</div>
          <div class="card-sub">${orderNsu ? `Pedido: ${esc(orderNsu)}` : 'Pedido enviado para confirma\u00e7\u00e3o.'}</div>
          <div class="actions vertical" style="margin-top:14px">
            ${receiptUrl ? `<a class="btn secondary full" href="${esc(receiptUrl)}" target="_blank" rel="noopener">Ver comprovante</a>` : ''}
            <button class="btn brand full" onclick="Bella.goLogin()">${outdated ? 'Voltar e gerar novo checkout' : 'Continuar no BellaOS'}</button>
          </div>
        </div>
      </main>
    `;
  }

  function renderSubscriptionBlocked(user, salon, lock) {
    const selected = salon.subscriptionPlanId || 'mensal';
    const handle = salon.infinitePayHandle || DEFAULT_INFINITEPAY_HANDLE || '';
    app.innerHTML = `
      <main class="login-screen">
        <section class="login-card auth-card">
          <div class="login-logo">
            <img class="logo-mark" src="/assets/logo-mark.svg" alt="BellaOS" />
            <div>
              <div class="logo-title">BellaOS</div>
              <div class="logo-subtitle">Assinatura vencida</div>
            </div>
          </div>
          <h1>Acesso pausado</h1>
          <p>O pagamento do sal\u00e3o venceu em ${esc(brDate(lock.dueDate))}. O acesso fica liberado somente at\u00e9 3 dias ap\u00f3s o vencimento. Para continuar usando, escolha um plano e regularize a assinatura.</p>
          ${planCardsHtml('blockedPlanId', selected)}
          <div class="actions vertical" style="margin-top:14px">
            <button class="btn brand full" onclick="Bella.startSubscriptionPayment(document.querySelector('input[name=blockedPlanId]:checked')?.value || '${esc(selected)}')" ${handle ? '' : 'disabled'}>Regularizar assinatura</button>
            <button class="btn secondary full" onclick="Bella.logout()">Sair</button>
          </div>
          ${handle ? '' : `<div class="empty" style="margin-top:12px">InfiniteTag n\u00e3o configurada. Fale com o suporte do BellaOS.</div>`}
        </section>
      </main>
    `;
  }

  
  function renderLogin() {
    app.innerHTML = `
      <main class="login-screen auth-landing">
        <section class="login-card auth-card">
          <div class="login-logo">
            <img class="logo-mark" src="/assets/logo-mark.svg" alt="BellaOS" />
            <div>
              <div class="logo-title">BellaOS</div>
              <div class="logo-subtitle">Gest\u00e3o premium para sal\u00f5es</div>
            </div>
          </div>

          <div class="auth-hero-copy">
            <span class="mini-badge">Planos flex\u00edveis</span>
            <h1>Seu sal\u00e3o organizado pelo celular</h1>
            <p>Agenda online, clientes, servi\u00e7os, profissionais, financeiro, comiss\u00f5es, estoque e relat\u00f3rios em um sistema simples para o dia a dia do sal\u00e3o.</p>
          </div>

          <div class="auth-pricing-card">
            <div>
              <div class="card-title">BellaOS Completo</div>
              <div class="card-sub">Escolha a recorr\u00eancia da assinatura.</div>
            </div>
            ${planCardsHtml('planId', 'mensal')}
            <div class="auth-feature-list">
              <span>Agenda online</span>
              <span>Clientes</span>
              <span>Servi\u00e7os</span>
              <span>Profissionais</span>
              <span>Financeiro</span>
              <span>Comiss\u00f5es</span>
              <span>Estoque</span>
              <span>Relat\u00f3rios</span>
            </div>

            <form class="signup-box" onsubmit="Bella.startPublicSubscriptionPayment(event)">
              <div class="signup-section-title">Dados do administrador</div>
              <div class="field">
                <label>Nome completo do administrador</label>
                <input name="adminName" placeholder="Ex: Maria Clara Santos" autocomplete="name" required />
              </div>
              <div class="field two-cols">
                <div>
                  <label>CPF</label>
                  <input name="adminCpf" inputmode="numeric" placeholder="000.000.000-00" autocomplete="off" required />
                </div>
                <div>
                  <label>Data de nascimento</label>
                  <input name="adminBirthDate" type="date" required />
                </div>
              </div>
              <div class="field two-cols">
                <div>
                  <label>Celular do administrador</label>
                  <input name="adminPhone" inputmode="tel" placeholder="(27) 99999-9999" autocomplete="tel" required />
                </div>
                <div>
                  <label>E-mail do administrador</label>
                  <input name="adminEmail" type="email" placeholder="contato@salao.com.br" autocomplete="email" required />
                </div>
              </div>

              <div class="field two-cols">
                <div>
                  <label>Crie uma senha</label>
                  <input name="password" type="password" minlength="6" autocomplete="new-password" placeholder="M\u00ednimo 6 caracteres" required />
                </div>
                <div>
                  <label>Confirmar senha</label>
                  <input name="confirmPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Repita a senha" required />
                </div>
              </div>

              <div class="signup-section-title">Dados do sal\u00e3o</div>
              <div class="field">
                <label>Nome do sal\u00e3o</label>
                <input name="salonName" placeholder="Ex: Studio Bella" required />
              </div>
              <div class="field two-cols">
                <div>
                  <label>CNPJ do sal\u00e3o <small>opcional</small></label>
                  <input name="salonCnpj" inputmode="numeric" placeholder="00.000.000/0000-00" autocomplete="off" />
                </div>
                <div>
                  <label>Celular do sal\u00e3o</label>
                  <input name="salonPhone" inputmode="tel" placeholder="(27) 99999-9999" required />
                </div>
              </div>

              <button class="btn brand full" type="submit">Continuar para pagamento</button>
              <div class="helper-text">Crie sua senha agora. Depois do pagamento, voc\u00ea entra com este e-mail e senha. O acesso permanece liberado at\u00e9 3 dias ap\u00f3s o vencimento.</div>
            </form>
          </div>
        </section>

        <section class="login-card auth-login-card">
          <div class="section-kicker">J\u00e1 sou cliente</div>
          <h2>Acesse sua conta</h2>
          <p>Entre para gerenciar a agenda e o sal\u00e3o.</p>
          <form onsubmit="Bella.login(event)">
            <div class="field">
              <label>E-mail</label>
              <input name="email" type="email" autocomplete="email" placeholder="seuemail@salao.com.br" required />
            </div>
            <div class="field">
              <label>Senha</label>
              <input name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required />
            </div>
            <button class="btn secondary full" type="submit">Entrar no BellaOS</button>
          </form>
        </section>
      </main>
    `;
  }


  function setupProgress(step) {
    const labels = ['Unidades', 'Servi\u00e7os', 'Profissionais', 'Hor\u00e1rios'];
    return `<div class="setup-progress">${labels.map((label, idx) => {
      const n = idx + 1;
      return `<div class="setup-dot ${step === n ? 'active' : ''} ${step > n ? 'done' : ''}"><strong>${n}</strong><span>${label}</span></div>`;
    }).join('')}</div>`;
  }

  function renderOnboarding(user, salon) {
    const step = Number(salon.setupStep || 1);
    app.innerHTML = `
      <main class="login-screen setup-screen">
        <section class="login-card setup-card">
          <div class="login-logo">
            <img class="logo-mark" src="/assets/logo-mark.svg" alt="BellaOS" />
            <div>
              <div class="logo-title">BellaOS</div>
              <div class="logo-subtitle">Configura\u00e7\u00e3o inicial</div>
            </div>
          </div>
          ${setupProgress(step)}
          ${renderOnboardingStep(step, user, salon)}
        </section>
      </main>
    `;
  }

  function renderOnboardingStep(step, user, salon) {
    const data = salonData(salon.id);
    if (step === 1) return renderSetupUnits(salon, data);
    if (step === 2) return renderSetupServices(salon, data);
    if (step === 3) return renderSetupProfessionals(salon, data);
    return renderSetupSchedules(salon, data);
  }

  function renderSetupUnits(salon, data) {
    return `
      <section class="header setup-header">
        <div class="eyebrow">Passo 1 de 4</div>
        <h1>Cadastre as unidades</h1>
        <p>Comece informando cada unidade do sal\u00e3o. Cada uma pode ter endere\u00e7o e telefone pr\u00f3prios.</p>
      </section>
      <form class="setup-form" onsubmit="Bella.saveSetupUnit(event)">
        <div class="field"><label>Nome da unidade</label><input name="name" placeholder="Ex: Studio Bella - Centro" required /></div>
        <div class="field"><label>Endere\u00e7o</label><input name="address" placeholder="Rua, n\u00famero, bairro e cidade" required /></div>
        <div class="field"><label>Telefone/WhatsApp da unidade</label><input name="phone" inputmode="tel" placeholder="(27) 99999-9999" required /></div>
        <button class="btn brand full" type="submit">Adicionar unidade</button>
      </form>
      <div class="setup-list">
        ${data.units.map(u => `<div class="setup-item"><strong>${esc(u.name)}</strong><span>${esc(u.address)}<br>${esc(u.phone)}</span><button class="btn small danger" onclick="Bella.deleteSetupUnit('${u.id}')">Excluir</button></div>`).join('') || `<div class="empty">Nenhuma unidade cadastrada ainda.</div>`}
      </div>
      <div class="actions vertical">
        <button class="btn brand full" onclick="Bella.nextSetupStep()" ${data.units.length ? '' : 'disabled'}>Continuar para servi\u00e7os</button>
      </div>
    `;
  }

  function renderSetupServices(salon, data) {
    return `
      <section class="header setup-header">
        <div class="eyebrow">Passo 2 de 4</div>
        <h1>Cadastre os servi\u00e7os</h1>
        <p>Informe o que o sal\u00e3o oferece. Depois voc\u00ea vai selecionar quais servi\u00e7os cada profissional realiza.</p>
      </section>
      <form class="setup-form" onsubmit="Bella.saveSetupService(event)">
        <div class="field"><label>Nome do servi\u00e7o</label><input name="name" placeholder="Ex: Escova, Manicure, Maquiagem" required /></div>
        <div class="field-row">
          <div class="field"><label>Categoria</label><input name="category" placeholder="Cabelo, Unhas, Maquiagem..." required /></div>
          <div class="field"><label>Pre\u00e7o</label><input name="price" inputmode="decimal" placeholder="69,90" required /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Dura\u00e7\u00e3o em minutos</label><input name="duration" type="number" min="5" step="5" value="60" required /></div>
          <div class="field"><label>Anteced\u00eancia m\u00ednima</label><select name="minAdvanceMinutes">${[30,60,120,240,720,1440,2880,4320].map(m => `<option value="${m}">${formatAdvance(m)}</option>`).join('')}</select></div>
        </div>
        <button class="btn brand full" type="submit">Adicionar servi\u00e7o</button>
      </form>
      <div class="setup-list">
        ${data.services.map(s => `<div class="setup-item"><strong>${esc(s.name)}</strong><span>${money(s.price)} \u00b7 ${s.duration} min</span><button class="btn small danger" onclick="Bella.deleteSetupService('${s.id}')">Excluir</button></div>`).join('') || `<div class="empty">Nenhum servi\u00e7o cadastrado ainda.</div>`}
      </div>
      <div class="actions vertical">
        <button class="btn brand full" onclick="Bella.nextSetupStep()" ${data.services.length ? '' : 'disabled'}>Continuar para profissionais</button>
        <button class="btn secondary full" onclick="Bella.prevSetupStep()">Voltar</button>
      </div>
    `;
  }

  function renderSetupProfessionals(salon, data) {
    return `
      <section class="header setup-header">
        <div class="eyebrow">Passo 3 de 4</div>
        <h1>Cadastre profissionais</h1>
        <p>Selecione a unidade e os servi\u00e7os que cada profissional realiza.</p>
      </section>
      <form class="setup-form" onsubmit="Bella.saveSetupProfessional(event)">
        <div class="field"><label>Nome da profissional</label><input name="name" placeholder="Ex: Ana Clara" required /></div>
        <div class="field"><label>Telefone</label><input name="phone" inputmode="tel" placeholder="(27) 99999-9999" /></div>
        <div class="field"><label>Unidade</label><select name="unitId" required>${data.units.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Especialidade</label><input name="specialty" placeholder="Ex: Cabelo, unhas, maquiagem" /></div>
        <div class="field"><label>Servi\u00e7os que realiza</label><div class="check-grid">${data.services.map(s => `<label><input type="checkbox" name="services" value="${s.id}"> ${esc(s.name)}</label>`).join('')}</div></div>
        <button class="btn brand full" type="submit">Adicionar profissional</button>
      </form>
      <div class="setup-list">
        ${data.professionals.map(p => {
          const unit = data.units.find(u => u.id === p.unitId);
          const serviceNames = (p.services || []).map(id => data.services.find(s => s.id === id)?.name).filter(Boolean).join(', ');
          return `<div class="setup-item"><strong>${esc(p.name)}</strong><span>${esc(unit?.name || 'Unidade n\u00e3o definida')}<br>${esc(serviceNames || 'Sem servi\u00e7os')}</span><button class="btn small danger" onclick="Bella.deleteSetupProfessional('${p.id}')">Excluir</button></div>`;
        }).join('') || `<div class="empty">Nenhuma profissional cadastrada ainda.</div>`}
      </div>
      <div class="actions vertical">
        <button class="btn brand full" onclick="Bella.nextSetupStep()" ${data.professionals.length ? '' : 'disabled'}>Continuar para hor\u00e1rios</button>
        <button class="btn secondary full" onclick="Bella.prevSetupStep()">Voltar</button>
      </div>
    `;
  }

  function renderSetupSchedules(salon, data) {
    return `
      <section class="header setup-header">
        <div class="eyebrow">Passo 4 de 4</div>
        <h1>Defina os hor\u00e1rios</h1>
        <p>Escolha os dias de trabalho, hor\u00e1rio de entrada, sa\u00edda e intervalo de cada profissional.</p>
      </section>
      <div class="setup-list">
        ${data.professionals.map(p => `
          <form class="setup-item setup-schedule" onsubmit="Bella.saveSetupSchedule(event, '${p.id}')">
            <strong>${esc(p.name)}</strong>
            <span>${esc(data.units.find(u => u.id === p.unitId)?.name || '')}</span>
            <div class="check-grid days">
              ${WEEK_DAYS.map(day => `<label><input type="checkbox" name="workDays" value="${day.value}" ${(p.workDays || [1,2,3,4,5,6]).includes(day.value) ? 'checked' : ''}> ${day.short}</label>`).join('')}
            </div>
            <div class="field-row">
              <div class="field"><label>Entrada</label><input type="time" name="start" value="${esc(p.start || '09:00')}" required></div>
              <div class="field"><label>Sa\u00edda</label><input type="time" name="end" value="${esc(p.end || '18:00')}" required></div>
            </div>
            <div class="field-row">
              <div class="field"><label>In\u00edcio intervalo</label><input type="time" name="lunchStart" value="${esc(p.lunchStart || '12:30')}"></div>
              <div class="field"><label>Fim intervalo</label><input type="time" name="lunchEnd" value="${esc(p.lunchEnd || '13:30')}"></div>
            </div>
            <button class="btn secondary full" type="submit">Salvar hor\u00e1rio</button>
          </form>`).join('')}
      </div>
      <div class="actions vertical">
        <button class="btn brand full" onclick="Bella.finishSetup()">Finalizar configura\u00e7\u00e3o</button>
        <button class="btn secondary full" onclick="Bella.prevSetupStep()">Voltar</button>
      </div>
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
      app.innerHTML = `<main class="login-screen"><section class="login-card"><h1>Sal\u00e3o n\u00e3o encontrado</h1><button class="btn full" onclick="Bella.logout()">Sair</button></section></main>`;
      return;
    }

    const viewLabels = {
      home: 'In\u00edcio', agenda: 'Agenda', clients: 'Clientes', services: 'Servi\u00e7os', more: 'Mais', professionals: 'Profissionais', finance: 'Financeiro', stock: 'Estoque', commissions: 'Comiss\u00f5es', online: 'Agenda Online', subscription: 'Assinatura', settings: 'Configura\u00e7\u00f5es'
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
          <button class="icon-btn" aria-label="Sair" onclick="Bella.logout()">\u2197</button>
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
      ['home', 'In\u00edcio', '\u2302'],
      ['agenda', 'Agenda', '\u25a1'],
      ['clients', 'Clientes', '\u25cc'],
      ['services', 'Servi\u00e7os', '\u25c7'],
      ['more', 'Mais', '\u2261']
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
      subscription: renderSubscription,
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
        <h1>Ol\u00e1, ${esc(user.name.split(' ')[0])}</h1>
        <p>Controle o sal\u00e3o pelo celular: agenda, clientes, profissionais, financeiro, comiss\u00f5es e estoque.</p>
      </section>
      <section class="grid">
        <div class="card stat"><div class="stat-label">Agendamentos hoje</div><div class="stat-number">${todays.length}</div><div class="card-sub">${concludedToday.length} conclu\u00eddo(s)</div></div>
        <div class="card stat good"><div class="stat-label">Faturamento</div><div class="stat-number">${money(incomeToday)}</div><div class="card-sub">Hoje</div></div>
        <div class="card stat"><div class="stat-label">Clientes</div><div class="stat-number">${clients.length}</div><div class="card-sub">Base ativa</div></div>
        <div class="card stat ${lowStock.length ? 'warn' : 'good'}"><div class="stat-label">Estoque baixo</div><div class="stat-number">${lowStock.length}</div><div class="card-sub">${lowStock[0] ? esc(lowStock[0].name) : 'Tudo em dia'}</div></div>
      </section>
      <section class="section"><h2>Pr\u00f3ximo atendimento</h2><button class="btn small secondary" onclick="Bella.openModal('appointment')">Novo</button></section>
      ${next ? renderAppointmentItem(next, salon.id, true) : `<div class="empty">Nenhum atendimento pr\u00f3ximo para hoje.</div>`}
      <section class="section"><h2>A\u00e7\u00f5es r\u00e1pidas</h2></section>
      <div class="grid">
        <button class="card" onclick="Bella.openModal('appointment')"><div class="card-title">Novo agendamento</div><div class="card-sub">Criar hor\u00e1rio interno</div></button>
        <button class="card" onclick="Bella.navigate('online')"><div class="card-title">Compartilhar agenda</div><div class="card-sub">Link p\u00fablico do sal\u00e3o</div></button>
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
        <p>Controle hor\u00e1rios, status e contato das clientes.</p>
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
    const whats = client?.phone ? `https://wa.me/55${normalizePhone(client.phone)}?text=${encodeURIComponent(`Ol\u00e1, ${client.name}! Passando para confirmar seu hor\u00e1rio no ${currentSalon()?.name || 'sal\u00e3o'} dia ${brDate(a.date)} \u00e0s ${a.start}.`)}` : '#';
    return `
      <article class="item">
        <div class="avatar">${initials(client?.name || 'Cliente')}</div>
        <div class="item-main">
          <div class="item-title">${esc(a.start)} \u00b7 ${esc(client?.name || 'Cliente')} ${appointmentStatusBadge(a.status)} ${a.groupTotal > 1 ? `<span class="badge muted">${a.groupIndex}/${a.groupTotal}</span>` : ''}</div>
          <div class="item-meta">
            ${esc(serviceName(a.serviceIds, services))}<br>
            Profissional: ${esc(pro?.name || 'N\u00e3o definida')} \u00b7 ${money(a.total)} \u00b7 ${a.duration} min
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
        <p>Hist\u00f3rico, prefer\u00eancias, colora\u00e7\u00e3o, observa\u00e7\u00f5es e atendimentos.</p>
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
              <div class="item-meta">${esc(c.phone)} \u00b7 ${c.visits || 0} visita(s)<br>Prefer\u00eancia: ${esc(pro?.name || 'Sem prefer\u00eancia')}${last ? `<br>\u00daltimo: ${brDate(last.date)} \u00b7 ${esc(labelStatus(last.status))}` : ''}</div>
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
        <div class="eyebrow">Servi\u00e7os e pacotes</div>
        <h1>Card\u00e1pio do sal\u00e3o</h1>
        <p>Pre\u00e7o, dura\u00e7\u00e3o, anteced\u00eancia m\u00ednima, comiss\u00e3o e produtos usados.</p>
      </section>
      <div class="filters">${names.map(n => `<button class="chip ${state.serviceFilter === n ? 'active' : ''}" onclick="Bella.setServiceFilter('${esc(n)}')">${esc(n)}</button>`).join('')}</div>
      <section class="section"><h2>${filtered.length} item(ns)</h2><button class="btn small brand" onclick="Bella.openModal('service')">Novo</button></section>
      <div class="list">
        ${filtered.map(s => {
          const cat = categories.find(c => c.id === s.categoryId)?.name || 'Servi\u00e7o';
          return `<article class="item">
            <div class="avatar">${cat.slice(0,1)}</div>
            <div class="item-main">
              <div class="item-title">${esc(s.name)} ${s.active ? '<span class="badge success">Ativo</span>' : '<span class="badge danger">Inativo</span>'}</div>
              <div class="item-meta">${esc(cat)} \u00b7 ${money(s.price)} \u00b7 ${s.duration} min<br>Anteced\u00eancia: ${formatAdvance(s.minAdvanceMinutes)} \u00b7 Comiss\u00e3o: ${formatCommission(s)}</div>
              <div class="actions" style="margin-top:10px">
                <button class="btn small secondary" type="button" onclick="Bella.openModal('service',{serviceId:'${s.id}'})">Editar</button>
                <button class="btn small danger" type="button" onclick="Bella.deleteService('${s.id}')">Excluir</button>
              </div>
            </div>
          </article>`;
        }).join('') || `<div class="empty">Nenhum servi\u00e7o cadastrado.</div>`}
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
    if (s.commissionType === 'none') return 'Sem comiss\u00e3o';
    return `${s.commissionValue}%`;
  }

  function renderMore(user, salon) {
    const tiles = [
      ['professionals','Profissionais','Especialidades, hor\u00e1rios e comiss\u00f5es'],
      ['finance','Financeiro','Receitas, despesas e lucro estimado'],
      ['stock','Estoque','Produtos, alertas e baixas'],
      ['commissions','Comiss\u00f5es','Valores a pagar por profissional'],
      ['online','Agenda Online','Link p\u00fablico com nome do sal\u00e3o'],
      ['subscription','Assinatura','Pagamento do plano pelo InfinitePay'],
      ['settings','Configura\u00e7\u00f5es','Anteced\u00eancia, WhatsApp e dados do sal\u00e3o']
    ];
    return `
      <section class="header">
        <div class="eyebrow">M\u00f3dulos completos</div>
        <h1>Mais recursos</h1>
        <p>Acesse gest\u00e3o avan\u00e7ada do BellaOS.</p>
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
        <p>Cada profissional tem servi\u00e7os, hor\u00e1rios, folgas e comiss\u00e3o pr\u00f3pria.</p>
      </section>
      <section class="section"><h2>${professionals.length} profissional(is)</h2><button class="btn small brand" onclick="Bella.openModal('professional')">Nova</button></section>
      <div class="list">
        ${professionals.map(p => `<article class="item">
          <div class="avatar">${initials(p.name)}</div>
          <div class="item-main">
            <div class="item-title">${esc(p.name)} ${p.active ? '<span class="badge success">Ativa</span>' : '<span class="badge danger">Inativa</span>'}</div>
            <div class="item-meta">${esc(p.specialty)}<br>${esc(scheduleSummary(p))} \u00b7 Comiss\u00e3o padr\u00e3o ${p.commissionDefault}%<br>${p.services.map(id => services.find(s => s.id === id)?.name).filter(Boolean).slice(0,3).join(', ')}${p.services.length > 3 ? '...' : ''}</div>
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
        <h1>Resultado do sal\u00e3o</h1>
        <p>Receitas, despesas, formas de pagamento, ticket m\u00e9dio e lucro estimado.</p>
      </section>
      <div class="grid">
        <div class="card stat good"><div class="stat-label">Receitas m\u00eas</div><div class="stat-number">${money(incomeMonth)}</div><div class="card-sub">Entradas + conclu\u00eddos</div></div>
        <div class="card stat danger"><div class="stat-label">Despesas m\u00eas</div><div class="stat-number">${money(expenseMonth)}</div><div class="card-sub">Custos registrados</div></div>
        <div class="card stat"><div class="stat-label">Lucro estimado</div><div class="stat-number">${money(income - expense)}</div><div class="card-sub">Geral</div></div>
        <div class="card stat"><div class="stat-label">Ticket m\u00e9dio</div><div class="stat-number">${money(concluded.length ? incomeAppointments / concluded.length : 0)}</div><div class="card-sub">Atendimentos conclu\u00eddos</div></div>
      </div>
      <section class="section"><h2>Lan\u00e7amentos</h2><button class="btn small brand" onclick="Bella.openModal('financial')">Novo</button></section>
      <div class="list">
        ${financial.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(f => `<article class="item">
          <div class="avatar">${f.type === 'receita' ? '+' : '-'}</div>
          <div class="item-main"><div class="item-title">${esc(f.description)}</div><div class="item-meta">${brDate(f.date)} \u00b7 ${esc(f.payment || '')} \u00b7 ${esc(f.type)}</div></div>
          <div class="item-side">${money(f.amount)}</div>
        </article>`).join('') || `<div class="empty">Nenhum lan\u00e7amento manual.</div>`}
      </div>
    `;
  }

  function renderStock(user, salon) {
    const { products } = salonData(salon.id);
    return `
      <section class="header">
        <div class="eyebrow">Estoque</div>
        <h1>Produtos e alertas</h1>
        <p>Controle colora\u00e7\u00f5es, OX, m\u00e1scaras, progressivas, esmaltes e descart\u00e1veis.</p>
      </section>
      <section class="section"><h2>${products.length} produto(s)</h2><button class="btn small brand" onclick="Bella.openModal('product')">Novo</button></section>
      <div class="list">
        ${products.map(p => `<article class="item">
          <div class="avatar">${p.category.slice(0,1)}</div>
          <div class="item-main">
            <div class="item-title">${esc(p.name)} ${Number(p.qty) <= Number(p.minQty) ? '<span class="badge danger">Estoque baixo</span>' : '<span class="badge success">OK</span>'}</div>
            <div class="item-meta">${esc(p.category)} \u00b7 ${p.qty} ${esc(p.unit)} \u00b7 m\u00ednimo ${p.minQty} ${esc(p.unit)}<br>Custo: ${money(p.cost)} por ${esc(p.unit)} \u00b7 ${esc(p.supplier || '')}</div>
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
        <div class="eyebrow">Comiss\u00f5es</div>
        <h1>Valores a pagar</h1>
        <p>Comiss\u00e3o por percentual, valor fixo ou regra espec\u00edfica por servi\u00e7o.</p>
      </section>
      <div class="list">
        ${rows.map(r => `<article class="item">
          <div class="avatar">${initials(r.p.name)}</div>
          <div class="item-main"><div class="item-title">${esc(r.p.name)}</div><div class="item-meta">${r.apps.length} atendimento(s) conclu\u00eddo(s)<br>Valor bruto: ${money(r.gross)}</div></div>
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
        <h1>Link do sal\u00e3o</h1>
        <p>A cliente agenda sozinha pelo link p\u00fablico com o nome do sal\u00e3o.</p>
      </section>
      <div class="card">
        <div class="card-title">Link p\u00fablico</div>
        <div class="copy-box">${esc(link)}</div>
        <div class="actions vertical" style="margin-top:14px">
          <button class="btn brand full" onclick="Bella.copyBookingLink()">Copiar link</button>
          <button class="btn secondary full" onclick="Bella.openBookingLink()">Abrir agenda</button>
          <button class="btn secondary full" onclick="Bella.shareBookingLink()">Compartilhar no WhatsApp</button>
        </div>
      </div>
      <section class="section"><h2>Regras de agendamento</h2></section>
      <div class="grid one">
        <div class="card"><div class="card-title">Anteced\u00eancia m\u00ednima global</div><div class="card-sub">${formatAdvance(salon.minAdvanceMinutes)} antes do hor\u00e1rio escolhido.</div></div>
        <div class="card"><div class="card-title">Agendamento no mesmo dia</div><div class="card-sub">${salon.allowSameDay ? 'Permitido respeitando a anteced\u00eancia.' : 'Bloqueado para a cliente.'}</div></div>
        <div class="card"><div class="card-title">Mostrar pre\u00e7os</div><div class="card-sub">${salon.showPrices ? 'A cliente v\u00ea os valores.' : 'A cliente n\u00e3o v\u00ea os valores.'}</div></div>
      </div>
    `;
  }


  function renderSubscription(user, salon) {
    const statusMap = {
      ativo: ['success', 'Ativa'],
      teste: ['muted', 'Em teste'],
      pendente: ['warn', 'Pagamento pendente'],
      vencido: ['danger', 'Pagamento vencido'],
      cancelado: ['danger', 'Cancelada'],
      bloqueado: ['danger', 'Bloqueada']
    };
    const [badge, label] = statusMap[salon.subscriptionStatus || 'teste'] || statusMap.teste;
    const handle = salon.infinitePayHandle || DEFAULT_INFINITEPAY_HANDLE || '';
    const currentPlan = getPlan(salon.subscriptionPlanId || 'mensal');
    const lastOrder = salon.subscriptionOrderNsu ? `<div class="card-sub">\u00daltimo pedido: ${esc(salon.subscriptionOrderNsu)}</div>` : '';
    const due = salon.subscriptionDueDate ? `<div class="card-sub">Vencimento: ${esc(brDate(salon.subscriptionDueDate))} \u00b7 toler\u00e2ncia at\u00e9 ${esc(brDate(salon.subscriptionGraceUntil || addDaysToISO(salon.subscriptionDueDate, 3)))}</div>` : '';
    return `
      <section class="header">
        <div class="eyebrow">Assinatura</div>
        <h1>BellaOS Completo</h1>
        <p>Escolha a recorr\u00eancia da assinatura. O acesso permanece liberado somente at\u00e9 3 dias ap\u00f3s o vencimento se o pagamento n\u00e3o for identificado.</p>
      </section>

      <div class="card plan-card">
        <div class="plan-head">
          <div>
            <div class="card-title">Plano atual</div>
            <div class="card-sub">${esc(currentPlan.name)} \u00b7 ${esc(currentPlan.displayText)} \u00b7 ${esc(currentPlan.recurrenceText)}</div>
          </div>
          <span class="badge ${badge}">${label}</span>
        </div>
        ${due}
        ${lastOrder}
      </div>

      <div class="card">
        <div class="card-title">Escolher plano</div>
        <div class="card-sub">A cobran\u00e7a e o pr\u00f3ximo vencimento seguem a recorr\u00eancia do plano escolhido.</div>
        ${planCardsHtml('subscriptionPlanId', currentPlan.id)}
        ${handle ? `<div class="copy-box" style="margin-top:12px">InfiniteTag: ${esc(handle)}</div>` : `<div class="empty" style="margin-top:12px">Cadastre sua InfiniteTag em Configura\u00e7\u00f5es para gerar o link de pagamento.</div>`}
        <div class="actions vertical" style="margin-top:14px">
          <button class="btn brand full" onclick="Bella.startSubscriptionPayment(document.querySelector('input[name=subscriptionPlanId]:checked')?.value || '${esc(currentPlan.id)}')" ${handle ? '' : 'disabled'}>Gerar pagamento do plano escolhido</button>
          <button class="btn secondary full" onclick="Bella.navigate('settings')">Configurar InfinitePay</button>
        </div>
      </div>

      <div class="card subtle-card">
        <div class="card-title">Como funciona</div>
        <div class="steps-list">
          <div><strong>1</strong><span>O BellaOS gera o pagamento conforme o plano escolhido.</span></div>
          <div><strong>2</strong><span>Depois de pago, o pr\u00f3ximo vencimento \u00e9 calculado pelo ciclo: mensal, trimestral, semestral ou anual.</span></div>
          <div><strong>3</strong><span>Se vencer e n\u00e3o for pago, o login funciona somente por mais 3 dias.</span></div>
        </div>
      </div>
    `;
  }

  function renderSettings(user, salon) {
    const { scheduleExceptions, professionals } = salonData(salon.id);
    const exceptions = scheduleExceptions.slice().sort((a,b) => a.date.localeCompare(b.date));
    return `
      <section class="header">
        <div class="eyebrow">Configura\u00e7\u00f5es</div>
        <h1>Dados do sal\u00e3o</h1>
        <p>Altere nome, slug, WhatsApp, endere\u00e7o, InfinitePay e regras de agendamento.</p>
      </section>
      <form class="card" onsubmit="Bella.saveSettings(event)">
        <div class="field"><label>Nome do sal\u00e3o</label><input name="name" value="${esc(salon.name)}" required /></div>
        <div class="field"><label>Slug do link</label><input name="slug" value="${esc(salon.slug)}" required /></div>
        <div class="field"><label>WhatsApp</label><input name="whatsapp" value="${esc(salon.whatsapp)}" required /></div>
        <div class="field"><label>Endere\u00e7o</label><input name="address" value="${esc(salon.address)}" /></div>
        <div class="field-row">
          <div class="field"><label>Abre</label><input name="openingStart" type="time" value="${esc(salon.openingStart)}" /></div>
          <div class="field"><label>Fecha</label><input name="openingEnd" type="time" value="${esc(salon.openingEnd)}" /></div>
        </div>
        <div class="field"><label>Anteced\u00eancia m\u00ednima</label><select name="minAdvanceMinutes">${[30,60,120,240,360,720,1440,2880,4320].map(m => `<option value="${m}" ${Number(salon.minAdvanceMinutes) === m ? 'selected' : ''}>${formatAdvance(m)}</option>`).join('')}</select></div>
        <div class="switch-row"><div><span>Permitir agendamento no mesmo dia</span><small>Respeitando a anteced\u00eancia m\u00ednima.</small></div><input class="checkbox" name="allowSameDay" type="checkbox" ${salon.allowSameDay ? 'checked' : ''}></div>
        <div class="switch-row"><div><span>Mostrar pre\u00e7os na agenda p\u00fablica</span><small>Ideal para reduzir perguntas no WhatsApp.</small></div><input class="checkbox" name="showPrices" type="checkbox" ${salon.showPrices ? 'checked' : ''}></div>
        <div class="switch-row"><div><span>Agenda p\u00fablica ativa</span><small>Quando desativada, ningu\u00e9m consegue marcar pelo link.</small></div><input class="checkbox" name="bookingEnabled" type="checkbox" ${salon.bookingEnabled ? 'checked' : ''}></div>
        <div class="field"><label>InfiniteTag InfinitePay</label><input name="infinitePayHandle" value="${esc(salon.infinitePayHandle || '')}" placeholder="ex: sua_infinite_tag" /><small>Use a InfiniteTag sem o s\u00edmbolo $ para gerar links de pagamento da assinatura.</small></div>
        <button class="btn brand full" type="submit">Salvar configura\u00e7\u00f5es</button>
      </form>

      <section class="section"><h2>Exce\u00e7\u00f5es de agenda</h2><button class="btn small secondary" onclick="Bella.openModal('scheduleException')">Adicionar</button></section>
      <div class="list">
        ${exceptions.length ? exceptions.map(e => {
          const pro = professionals.find(p => p.id === e.professionalId);
          const scope = e.scope === 'professional' ? `Profissional: ${esc(pro?.name || 'n\u00e3o encontrada')}` : 'Sal\u00e3o inteiro';
          const status = e.closed ? 'Fechado' : `${esc(e.start)} \u00e0s ${esc(e.end)}${e.breakStart && e.breakEnd ? ` \u00b7 intervalo ${esc(e.breakStart)} \u00e0s ${esc(e.breakEnd)}` : ''}`;
          return `<article class="item"><div class="avatar">${brDate(e.date).slice(0,5)}</div><div class="item-main"><div class="item-title">${brDate(e.date)} \u00b7 ${scope}</div><div class="item-meta">${status}${e.reason ? `<br>${esc(e.reason)}` : ''}</div></div><button class="btn small secondary" onclick="Bella.openModal('scheduleException',{exceptionId:'${e.id}'})">Editar</button></article>`;
        }).join('') : `<div class="empty">Nenhuma exce\u00e7\u00e3o cadastrada. Use para feriados, eventos ou dias com funcionamento especial.</div>`}
      </div>
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
      scheduleException: modalScheduleException,
      clientDetail: modalClientDetail
    }[type.name || type]?.(type) || '';
    return `<div class="modal-backdrop" onclick="Bella.closeModal(event)"><section class="modal" onclick="event.stopPropagation()">${content}</section></div>`;
  }

  function modalHeader(title) {
    return `<div class="modal-header"><h2>${esc(title)}</h2><button class="icon-btn" onclick="Bella.closeModal()">\u00d7</button></div>`;
  }

  function modalAppointment() {
    const salon = currentSalon();
    const { clients, professionals, services } = salonData(salon.id);
    const draft = ensureAppointmentDraft(salon.id);
    const activeProfessionals = professionals.filter(p => p.active);
    const availableServices = getActiveServicesForProfessional(salon.id, draft.draftProfessionalId);
    const slots = getMultiAvailableSlots(salon.id, draft.items, draft.date);
    const total = multiServiceTotal(draft.items, services);
    const duration = multiServiceDuration(draft.items, services, salon);
    return `${modalHeader('Novo atendimento')}
      <form onsubmit="Bella.saveAppointment(event)">
        <div class="field"><label>Cliente</label><select name="clientId" required>${clients.map(c => `<option value="${c.id}">${esc(c.name)} \u00b7 ${esc(c.phone)}</option>`).join('')}</select></div>

        <div class="card" style="margin-bottom:14px">
          <div class="card-title">Adicionar servi\u00e7o ao atendimento</div>
          <div class="card-sub" style="margin-bottom:12px">Escolha os servi\u00e7os. O BellaOS testa a melhor sequ\u00eancia de acordo com a agenda de cada profissional; maquiagem e penteado ficam no final.</div>
          <div class="field"><label>Profissional</label><select onchange="Bella.setAppointmentItemDraft('professionalId', this.value)" ${activeProfessionals.length ? '' : 'disabled'}>
            ${activeProfessionals.length ? activeProfessionals.map(p => `<option value="${p.id}" ${draft.draftProfessionalId === p.id ? 'selected' : ''}>${esc(p.name)} \u00b7 ${esc(p.specialty)}</option>`).join('') : `<option value="">Nenhuma profissional ativa</option>`}
          </select><small>Escolha a profissional para ver apenas os servi\u00e7os que ela realiza.</small></div>
          <div class="field"><label>Servi\u00e7o dispon\u00edvel para esta profissional</label><select onchange="Bella.setAppointmentItemDraft('serviceId', this.value)" ${availableServices.length ? '' : 'disabled'}>
            ${availableServices.length ? availableServices.map(s => `<option value="${s.id}" ${draft.draftServiceId === s.id ? 'selected' : ''}>${esc(s.name)} \u00b7 ${money(s.price)} \u00b7 ${s.duration} min</option>`).join('') : `<option value="">Nenhum servi\u00e7o no escopo desta profissional</option>`}
          </select></div>
          <button class="btn secondary full" type="button" onclick="Bella.addAppointmentItem()" ${(!draft.draftProfessionalId || !draft.draftServiceId || !availableServices.length) ? 'disabled' : ''}>Adicionar servi\u00e7o</button>
        </div>

        <div class="field"><label>Servi\u00e7os escolhidos</label><small>Ordem autom\u00e1tica do atendimento. O sistema ajusta a sequ\u00eancia conforme a disponibilidade das profissionais e deixa maquiagem e penteado no final.</small>
          <div class="list">
            ${draft.items.length ? draft.items.map((item, index) => renderSelectedServiceItem(item, index, services, professionals, 'appointment')).join('') : `<div class="empty">Nenhum servi\u00e7o adicionado ainda.</div>`}
          </div>
        </div>

        <div class="field"><label>Data</label><input name="date" type="date" min="${todayISO()}" value="${esc(draft.date)}" required onchange="Bella.setAppointmentDraft('date', this.value)" /></div>
        <div class="field"><label>Hor\u00e1rio de in\u00edcio</label>
          <div class="slots">${slots.length ? slots.map(t => `<button type="button" class="slot ${draft.time === t ? 'active' : ''}" onclick="Bella.setAppointmentDraft('time','${t}')">${t}</button>`).join('') : `<button type="button" class="slot" disabled>Sem hor\u00e1rios</button>`}</div>
          <input type="hidden" name="start" value="${esc(draft.time)}" required />
          <small>${draft.items.length ? 'Voc\u00ea escolhe o hor\u00e1rio de in\u00edcio. O sistema procura a melhor ordem e encaixa cada servi\u00e7o no hor\u00e1rio da profissional respons\u00e1vel.' : 'Adicione pelo menos um servi\u00e7o para ver os hor\u00e1rios.'}</small>
        </div>
        <div class="summary-box">
          <strong>${draft.items.length ? money(total) : 'Monte o atendimento'}</strong>
          <small>${draft.items.length ? `${draft.items.length} servi\u00e7o(s) \u00b7 dura\u00e7\u00e3o estimada ${duration} min` : 'O resumo aparecer\u00e1 aqui.'}</small>
        </div>
        <div class="field" style="margin-top:14px"><label>Observa\u00e7\u00f5es</label><textarea name="notes" placeholder="Prefer\u00eancias, sinal pago, f\u00f3rmula, etc."></textarea></div>
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
        <div class="field"><label>Profissional preferida</label><select name="preferredProfessionalId"><option value="">Sem prefer\u00eancia</option>${professionals.map(p => `<option value="${p.id}" ${c?.preferredProfessionalId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>F\u00f3rmula de colora\u00e7\u00e3o</label><input name="formula" value="${esc(c?.formula || '')}" placeholder="Ex: 7.1 + OX 20 volumes" /></div>
        <div class="field"><label>Observa\u00e7\u00f5es</label><textarea name="notes">${esc(c?.notes || '')}</textarea></div>
        <button class="btn brand full" type="submit">${isEdit ? 'Salvar altera\u00e7\u00f5es' : 'Cadastrar cliente'}</button>
        ${isEdit ? `<button class="btn danger full" style="margin-top:10px" type="button" onclick="Bella.deleteClient('${c.id}')">Excluir cliente</button>` : ''}
      </form>`;
  }

  function modalService(payload = {}) {
    const salon = currentSalon();
    const { services, categories } = salonData(salon.id);
    const svc = services.find(x => x.id === payload.serviceId);
    const isEdit = Boolean(svc);
    const advances = [30,60,120,240,360,720,1440,2880,4320];
    return `${modalHeader(isEdit ? 'Editar servi\u00e7o' : 'Novo servi\u00e7o')}
      <form onsubmit="Bella.saveService(event, '${svc?.id || ''}')">
        <div class="field"><label>Nome</label><input name="name" value="${esc(svc?.name || '')}" required /></div>
        <div class="field"><label>Categoria</label><select name="categoryId">${categories.map(c => `<option value="${c.id}" ${svc?.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field-row"><div class="field"><label>Pre\u00e7o</label><input name="price" type="number" step="0.01" value="${esc(svc?.price ?? '')}" required /></div><div class="field"><label>Dura\u00e7\u00e3o min</label><input name="duration" type="number" value="${esc(svc?.duration ?? '')}" required /></div></div>
        <div class="field"><label>Anteced\u00eancia m\u00ednima</label><select name="minAdvanceMinutes">${advances.map(m => `<option value="${m}" ${Number(svc?.minAdvanceMinutes || 60) === m ? 'selected' : ''}>${formatAdvance(m)}</option>`).join('')}</select></div>
        <div class="field-row"><div class="field"><label>Comiss\u00e3o tipo</label><select name="commissionType"><option value="percent" ${svc?.commissionType === 'percent' || !svc ? 'selected' : ''}>Percentual</option><option value="fixed" ${svc?.commissionType === 'fixed' ? 'selected' : ''}>Valor fixo</option><option value="none" ${svc?.commissionType === 'none' ? 'selected' : ''}>Sem comiss\u00e3o</option></select></div><div class="field"><label>Comiss\u00e3o</label><input name="commissionValue" type="number" step="0.01" value="${esc(svc?.commissionValue ?? 40)}" /></div></div>
        <div class="switch-row"><div><span>Servi\u00e7o ativo</span><small>Servi\u00e7os inativos n\u00e3o aparecem na agenda p\u00fablica.</small></div><input class="checkbox" name="active" type="checkbox" ${svc?.active !== false ? 'checked' : ''}></div>
        <button class="btn brand full" type="submit">${isEdit ? 'Salvar altera\u00e7\u00f5es' : 'Cadastrar servi\u00e7o'}</button>
        ${isEdit ? `<button class="btn danger full" style="margin-top:10px" type="button" onclick="Bella.deleteService('${svc.id}')">Excluir servi\u00e7o</button>` : ''}
      </form>`;
  }

  function modalProfessional(payload = {}) {
    const salon = currentSalon();
    const { professionals, services } = salonData(salon.id);
    const p = professionals.find(x => x.id === payload.professionalId);
    const isEdit = Boolean(p);
    const weekly = normalizedWeeklySchedule(p || {});
    const scheduleRows = WEEK_DAYS.map(day => {
      const row = weekly[day.value];
      return `<div class="week-row">
        <label class="week-day"><input type="checkbox" name="dayActive_${day.value}" ${row.active ? 'checked' : ''}><span>${day.short}</span></label>
        <div class="week-times">
          <div class="field mini"><label>Entrada</label><input name="dayStart_${day.value}" type="time" value="${esc(row.start)}" /></div>
          <div class="field mini"><label>Sa\u00edda</label><input name="dayEnd_${day.value}" type="time" value="${esc(row.end)}" /></div>
          <div class="field mini"><label>Intervalo in\u00edcio</label><input name="dayBreakStart_${day.value}" type="time" value="${esc(row.breakStart || '')}" /></div>
          <div class="field mini"><label>Intervalo fim</label><input name="dayBreakEnd_${day.value}" type="time" value="${esc(row.breakEnd || '')}" /></div>
        </div>
      </div>`;
    }).join('');
    return `${modalHeader(isEdit ? 'Editar profissional' : 'Nova profissional')}
      <form onsubmit="Bella.saveProfessional(event, '${p?.id || ''}')">
        <div class="field"><label>Nome</label><input name="name" value="${esc(p?.name || '')}" required /></div>
        <div class="field"><label>WhatsApp</label><input name="phone" inputmode="tel" value="${esc(p?.phone || '')}" /></div>
        <div class="field"><label>Especialidade</label><input name="specialty" value="${esc(p?.specialty || '')}" placeholder="Cabelo, unhas, maquiagem..." /></div>
        <div class="field"><label>Servi\u00e7os realizados</label><div class="service-picker">${services.filter(s=>s.active || p?.services?.includes(s.id)).map(s => `<label class="service-option"><input type="checkbox" name="services" value="${s.id}" ${p?.services?.includes(s.id) ? 'checked' : ''}><div><strong>${esc(s.name)}</strong><div class="card-sub">${money(s.price)} \u00b7 ${s.duration} min</div></div></label>`).join('')}</div></div>
        <div class="field"><label>Hor\u00e1rios por dia da semana</label><p class="hint">Ative os dias de atendimento e defina entrada, sa\u00edda e intervalo de cada dia.</p><div class="week-schedule">${scheduleRows}</div></div>
        <div class="field"><label>Comiss\u00e3o padr\u00e3o %</label><input name="commissionDefault" type="number" value="${esc(p?.commissionDefault ?? 40)}" /></div>
        <div class="switch-row"><div><span>Profissional ativa</span><small>Profissionais inativas n\u00e3o recebem novos agendamentos online.</small></div><input class="checkbox" name="active" type="checkbox" ${p?.active !== false ? 'checked' : ''}></div>
        <button class="btn brand full" type="submit">${isEdit ? 'Salvar altera\u00e7\u00f5es' : 'Cadastrar profissional'}</button>
        ${isEdit ? `<button class="btn danger full" style="margin-top:10px" type="button" onclick="Bella.deleteProfessional('${p.id}')">Excluir profissional</button>` : ''}
      </form>`;
  }

  function modalScheduleException(payload = {}) {
    const salon = currentSalon();
    const { professionals, scheduleExceptions } = salonData(salon.id);
    const e = scheduleExceptions.find(x => x.id === payload.exceptionId);
    const isEdit = Boolean(e);
    const scope = e?.scope || 'salon';
    return `${modalHeader(isEdit ? 'Editar exce\u00e7\u00e3o de agenda' : 'Nova exce\u00e7\u00e3o de agenda')}
      <form onsubmit="Bella.saveScheduleException(event, '${e?.id || ''}')">
        <div class="field"><label>Data</label><input name="date" type="date" value="${esc(e?.date || todayISO())}" required /></div>
        <div class="field"><label>Aplicar em</label><select name="scope" onchange="Bella.toggleExceptionScope(this.value)">
          <option value="salon" ${scope === 'salon' ? 'selected' : ''}>Sal\u00e3o inteiro</option>
          <option value="professional" ${scope === 'professional' ? 'selected' : ''}>Uma profissional espec\u00edfica</option>
        </select></div>
        <div class="field exception-professional" style="${scope === 'professional' ? '' : 'display:none'}"><label>Profissional</label><select name="professionalId">
          ${professionals.map(p => `<option value="${p.id}" ${e?.professionalId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select></div>
        <div class="switch-row"><div><span>Fechar neste dia</span><small>Se ativar, nenhum hor\u00e1rio ser\u00e1 exibido para esta data.</small></div><input class="checkbox" name="closed" type="checkbox" ${e?.closed ? 'checked' : ''}></div>
        <div class="field-row">
          <div class="field"><label>Abre</label><input name="start" type="time" value="${esc(e?.start || '09:00')}" /></div>
          <div class="field"><label>Fecha</label><input name="end" type="time" value="${esc(e?.end || '13:00')}" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Intervalo in\u00edcio</label><input name="breakStart" type="time" value="${esc(e?.breakStart || '')}" /></div>
          <div class="field"><label>Intervalo fim</label><input name="breakEnd" type="time" value="${esc(e?.breakEnd || '')}" /></div>
        </div>
        <div class="field"><label>Motivo/observa\u00e7\u00e3o</label><input name="reason" value="${esc(e?.reason || '')}" placeholder="Ex: feriado, evento, manuten\u00e7\u00e3o..." /></div>
        <button class="btn brand full" type="submit">Salvar exce\u00e7\u00e3o</button>
        ${isEdit ? `<button class="btn danger full" style="margin-top:10px" type="button" onclick="Bella.deleteScheduleException('${e.id}')">Excluir exce\u00e7\u00e3o</button>` : ''}
      </form>`;
  }

  function modalFinancial() {
    return `${modalHeader('Novo lan\u00e7amento')}
      <form onsubmit="Bella.saveFinancial(event)">
        <div class="field"><label>Tipo</label><select name="type"><option value="receita">Receita</option><option value="despesa">Despesa</option></select></div>
        <div class="field"><label>Descri\u00e7\u00e3o</label><input name="description" required /></div>
        <div class="field-row"><div class="field"><label>Valor</label><input name="amount" type="number" step="0.01" required /></div><div class="field"><label>Data</label><input name="date" type="date" value="${todayISO()}" required /></div></div>
        <div class="field"><label>Pagamento</label><select name="payment"><option>Pix</option><option>Dinheiro</option><option>Cart\u00e3o de d\u00e9bito</option><option>Cart\u00e3o de cr\u00e9dito</option><option>Parcelado</option><option>Cortesia</option><option>Pendente</option></select></div>
        <button class="btn brand full" type="submit">Salvar lan\u00e7amento</button>
      </form>`;
  }

  function modalProduct() {
    return `${modalHeader('Novo produto')}
      <form onsubmit="Bella.saveProduct(event)">
        <div class="field"><label>Nome</label><input name="name" required /></div>
        <div class="field"><label>Categoria</label><select name="category"><option>Shampoo</option><option>Condicionador</option><option>M\u00e1scara</option><option>Colora\u00e7\u00e3o</option><option>Oxidante</option><option>Progressiva</option><option>Esmalte</option><option>Descart\u00e1veis</option><option>Maquiagem</option><option>Outros</option></select></div>
        <div class="field-row"><div class="field"><label>Quantidade</label><input name="qty" type="number" step="0.01" required /></div><div class="field"><label>Unidade</label><input name="unit" value="un" required /></div></div>
        <div class="field-row"><div class="field"><label>Estoque m\u00ednimo</label><input name="minQty" type="number" step="0.01" required /></div><div class="field"><label>Custo</label><input name="cost" type="number" step="0.01" /></div></div>
        <div class="field"><label>Fornecedor</label><input name="supplier" /></div>
        <button class="btn brand full" type="submit">Cadastrar produto</button>
      </form>`;
  }

  function modalClientDetail(payload) {
    const salon = currentSalon();
    const { clients, professionals, appointments, services, hairHistory } = salonData(salon.id);
    const c = clients.find(x => x.id === payload.clientId);
    if (!c) return modalHeader('Cliente n\u00e3o encontrada');
    const pro = professionals.find(p => p.id === c.preferredProfessionalId);
    const apps = appointments.filter(a => a.clientId === c.id).sort((a,b)=>b.date.localeCompare(a.date));
    const hist = hairHistory.filter(h => h.clientId === c.id).sort((a,b)=>b.date.localeCompare(a.date));
    return `${modalHeader(c.name)}
      <div class="card tight">
        <div class="card-title">Ficha da cliente</div>
        <div class="card-sub">WhatsApp: ${esc(c.phone)}<br>Prefer\u00eancia: ${esc(pro?.name || 'Sem prefer\u00eancia')}<br>Total gasto: ${money(c.totalSpent || 0)} \u00b7 ${c.visits || 0} visita(s)</div>
        <div class="actions" style="margin-top:12px">
          <button class="btn small secondary" type="button" onclick="Bella.openModal('client',{clientId:'${c.id}'})">Editar</button>
          <button class="btn small danger" type="button" onclick="Bella.deleteClient('${c.id}')">Excluir</button>
        </div>
      </div>
      <section class="section"><h2>Observa\u00e7\u00f5es</h2></section>
      <div class="card"><div class="card-sub">${esc(c.notes || 'Sem observa\u00e7\u00f5es.')}${c.formula ? `<br><br><strong>F\u00f3rmula:</strong> ${esc(c.formula)}` : ''}</div></div>
      <section class="section"><h2>Hist\u00f3rico capilar</h2><button class="btn small secondary" onclick="Bella.addHairHistoryPrompt('${c.id}')">Adicionar</button></section>
      <div class="list">${hist.map(h => `<article class="item"><div class="avatar">H</div><div class="item-main"><div class="item-title">${brDate(h.date)} \u00b7 ${esc(h.service)}</div><div class="item-meta">${esc(h.formula)}<br>${esc(h.notes || '')}</div></div></article>`).join('') || `<div class="empty">Nenhum hist\u00f3rico capilar cadastrado.</div>`}</div>
      <section class="section"><h2>Atendimentos</h2></section>
      <div class="list">${apps.map(a => `<article class="item"><div class="avatar">${a.start}</div><div class="item-main"><div class="item-title">${brDate(a.date)} ${appointmentStatusBadge(a.status)}</div><div class="item-meta">${esc(serviceName(a.serviceIds, services))}<br>${money(a.total)}</div></div></article>`).join('') || `<div class="empty">Nenhum atendimento ainda.</div>`}</div>`;
  }

  function renderPublicBooking(slug) {
    const salon = salonBySlug(slug);
    if (!salon) {
      app.innerHTML = `<main class="booking-shell"><section class="public-hero"><h1>Agenda n\u00e3o encontrada</h1><p>Confira se o link est\u00e1 correto.</p><button class="btn full" onclick="Bella.goLogin()">Voltar</button></section></main>`;
      return;
    }
    const { services, professionals } = salonData(salon.id);
    ensurePublicBookingState(salon.id);
    const b = state.publicBooking;
    const activeProfessionals = professionals.filter(p => p.active);
    const availableServices = getActiveServicesForProfessional(salon.id, b.draftProfessionalId);
    const slots = getMultiAvailableSlots(salon.id, b.items, b.date);
    const total = multiServiceTotal(b.items, services);
    const duration = multiServiceDuration(b.items, services, salon);
    const enabled = salon.bookingEnabled && salon.status === 'ativo';
    app.innerHTML = `
      <main class="booking-shell">
        <section class="public-hero">
          <div class="public-hero-logo"><img src="${esc(salon.logoUrl || '/assets/logo-mark.svg')}" alt="${esc(salon.name)}"><div><div class="logo-title public-brand">${esc(salon.name)}</div><div class="logo-subtitle">Agenda online</div></div></div>
          <h1>Agende seu hor\u00e1rio</h1>
          <p>${esc(salon.address || '')}<br>Selecione os servi\u00e7os, escolha o hor\u00e1rio de in\u00edcio e o sistema organiza a ordem automaticamente.</p>
        </section>
        ${enabled ? '' : `<div class="card danger"><div class="card-title">Agenda indispon\u00edvel</div><div class="card-sub">Este sal\u00e3o pausou os agendamentos online.</div></div>`}

        <section class="step">
          <div class="section"><h2>1. Escolha os servi\u00e7os</h2></div>
          <div class="card">
            <div class="field"><label>Profissional</label><select onchange="Bella.setPublicItemDraft('professionalId', this.value)" ${activeProfessionals.length ? '' : 'disabled'}>
              ${activeProfessionals.length ? activeProfessionals.map(p => `<option value="${p.id}" ${b.draftProfessionalId === p.id ? 'selected' : ''}>${esc(p.name)} \u00b7 ${esc(p.specialty)}</option>`).join('') : `<option value="">Nenhuma profissional ativa</option>`}
            </select><small>Escolha a profissional para ver apenas os servi\u00e7os que ela realiza.</small></div>
            <div class="field"><label>Servi\u00e7o dispon\u00edvel para esta profissional</label><select onchange="Bella.setPublicItemDraft('serviceId', this.value)" ${availableServices.length ? '' : 'disabled'}>
              ${availableServices.length ? availableServices.map(s => `<option value="${s.id}" ${b.draftServiceId === s.id ? 'selected' : ''}>${esc(s.name)}${salon.showPrices ? ' \u00b7 ' + money(s.price) : ''} \u00b7 ${s.duration} min</option>`).join('') : `<option value="">Nenhum servi\u00e7o no escopo desta profissional</option>`}
            </select></div>
            <button class="btn secondary full" type="button" onclick="Bella.addPublicItem()" ${(!b.draftProfessionalId || !b.draftServiceId || !availableServices.length || !enabled) ? 'disabled' : ''}>Adicionar servi\u00e7o</button>
          </div>
        </section>

        <section class="step">
          <div class="section"><h2>2. Servi\u00e7os escolhidos</h2><small>${b.items.length} item(ns)</small></div>
          <div class="list">
            ${b.items.length ? b.items.map((item, index) => renderSelectedServiceItem(item, index, services, professionals, 'public')).join('') : `<div class="empty">Adicione um ou mais servi\u00e7os para continuar.</div>`}
          </div>
          ${b.items.length ? `<div class="card-sub" style="margin-top:10px">Ordem autom\u00e1tica: maquiagem e penteado ficam no final do atendimento.</div>` : ''}
        </section>

        <section class="step">
          <div class="section"><h2>3. Data e hor\u00e1rio de in\u00edcio</h2></div>
          <div class="card">
            <div class="field"><label>Data</label><input type="date" min="${todayISO()}" value="${esc(b.date)}" onchange="Bella.setPublic('date', this.value)"></div>
            <div class="slots">${slots.length ? slots.map(t => `<button class="slot ${b.time === t ? 'active' : ''}" onclick="Bella.setPublic('time','${t}')">${t}</button>`).join('') : `<button class="slot" disabled>Sem hor\u00e1rios</button>`}</div>
            <small>${b.items.length ? 'Este \u00e9 o hor\u00e1rio em que voc\u00ea come\u00e7a. O BellaOS define a sequ\u00eancia dos servi\u00e7os e encaixa cada profissional.' : 'Adicione servi\u00e7os para ver hor\u00e1rios.'}</small>
          </div>
        </section>
        <section class="step">
          <div class="section"><h2>4. Seus dados</h2></div>
          <div class="card">
            <div class="field"><label>Nome</label><input value="${esc(b.clientName)}" oninput="Bella.setPublic('clientName', this.value)" placeholder="Seu nome" /></div>
            <div class="field"><label>WhatsApp</label><input value="${esc(b.clientPhone)}" oninput="Bella.setPublic('clientPhone', this.value)" inputmode="tel" placeholder="(27) 99999-9999" /></div>
            <div class="field"><label>Observa\u00e7\u00e3o</label><textarea oninput="Bella.setPublic('notes', this.value)" placeholder="Opcional">${esc(b.notes)}</textarea></div>
          </div>
        </section>
        <div class="summary-box">
          <strong>${b.items.length ? money(total) : 'Monte seu atendimento'}</strong>
          <small>${b.items.length ? `${b.items.length} servi\u00e7o(s) \u00b7 dura\u00e7\u00e3o estimada ${duration} min` : 'O resumo aparecer\u00e1 aqui.'}</small>
        </div>
        <button class="btn brand full" style="margin-top:14px" onclick="Bella.confirmPublicBooking('${salon.id}')" ${!enabled ? 'disabled' : ''}>Confirmar agendamento</button>
      </main>
    `;
  }

  function getActiveProfessionals(salonId) {
    const { professionals } = salonData(salonId);
    return professionals.filter(p => p.active);
  }

  function getPossibleProfessionals(salonId, serviceIds) {
    const professionals = getActiveProfessionals(salonId);
    if (!serviceIds.length) return professionals;
    return professionals.filter(p => serviceIds.every(id => (p.services || []).includes(id)));
  }

  function getActiveServices(salonId) {
    const { services } = salonData(salonId);
    return services.filter(s => s.active);
  }

  function getProfessionalsForService(salonId, serviceId) {
    const { professionals } = salonData(salonId);
    return professionals.filter(p => p.active && (!serviceId || (p.services || []).includes(serviceId)));
  }

  function getActiveServicesForProfessional(salonId, professionalId) {
    const { services, professionals } = salonData(salonId);
    const activeServices = services.filter(s => s.active);
    if (!professionalId || professionalId === 'any') return activeServices;
    const pro = professionals.find(p => p.id === professionalId && p.active);
    if (!pro) return [];
    return activeServices.filter(s => (pro.services || []).includes(s.id));
  }

  function normalizedText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function isFinalStageService(service, categories) {
    const category = categories.find(c => c.id === service?.categoryId)?.name || '';
    const text = normalizedText(`${service?.name || ''} ${category}`);
    return text.includes('maquiagem') || text.includes('make') || text.includes('penteado') || text.includes('noiva');
  }

  function orderServiceItems(salonId, items) {
    const { services, categories } = salonData(salonId);
    return (items || [])
      .map((item, originalIndex) => ({ ...item, originalIndex }))
      .sort((a, b) => {
        const serviceA = services.find(s => s.id === a.serviceId);
        const serviceB = services.find(s => s.id === b.serviceId);
        const priorityA = isFinalStageService(serviceA, categories) ? 2 : 1;
        const priorityB = isFinalStageService(serviceB, categories) ? 2 : 1;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.originalIndex - b.originalIndex;
      })
      .map(({ originalIndex, ...item }) => item);
  }

  function ensurePublicBookingState(salonId) {
    const today = todayISO();
    const b = state.publicBooking;
    if (!Array.isArray(b.items)) b.items = [];
    if (!b.date || b.date < today) b.date = today;
    b.items = sanitizeServiceItems(salonId, b.items);
    const activePros = getActiveProfessionals(salonId);
    if (!b.draftProfessionalId || !activePros.some(p => p.id === b.draftProfessionalId)) b.draftProfessionalId = activePros[0]?.id || '';
    const availableServices = getActiveServicesForProfessional(salonId, b.draftProfessionalId);
    if (!b.draftServiceId || !availableServices.some(s => s.id === b.draftServiceId)) b.draftServiceId = availableServices[0]?.id || '';
    const slots = getMultiAvailableSlots(salonId, b.items, b.date);
    if (!slots.includes(b.time)) b.time = '';
    return b;
  }

  function ensureAppointmentDraft(salonId) {
    const today = todayISO();
    const d = state.appointmentDraft;
    if (!Array.isArray(d.items)) d.items = [];
    if (!d.date || d.date < today) d.date = state.selectedDate && state.selectedDate >= today ? state.selectedDate : today;
    d.items = sanitizeServiceItems(salonId, d.items);
    const activePros = getActiveProfessionals(salonId);
    if (!d.draftProfessionalId || !activePros.some(p => p.id === d.draftProfessionalId)) d.draftProfessionalId = activePros[0]?.id || '';
    const availableServices = getActiveServicesForProfessional(salonId, d.draftProfessionalId);
    if (!d.draftServiceId || !availableServices.some(s => s.id === d.draftServiceId)) d.draftServiceId = availableServices[0]?.id || '';
    const slots = getMultiAvailableSlots(salonId, d.items, d.date);
    if (!slots.includes(d.time)) d.time = '';
    return d;
  }

  function sanitizeServiceItems(salonId, items) {
    const { professionals, services } = salonData(salonId);
    const cleaned = (items || []).filter(item => {
      const pro = professionals.find(p => p.id === item.professionalId && p.active);
      const service = services.find(s => s.id === item.serviceId && s.active);
      return pro && service && (pro.services || []).includes(service.id);
    }).map(item => ({ id: item.id || uid('item'), professionalId: item.professionalId, serviceId: item.serviceId }));
    return orderServiceItems(salonId, cleaned);
  }

  function renderSelectedServiceItem(item, index, services, professionals, scope) {
    const service = services.find(s => s.id === item.serviceId);
    const pro = professionals.find(p => p.id === item.professionalId);
    const removeFn = scope === 'public' ? `Bella.removePublicItem(${index})` : `Bella.removeAppointmentItem(${index})`;
    return `<article class="item">
      <div class="avatar">${index + 1}</div>
      <div class="item-main">
        <div class="item-title">${esc(service?.name || 'Servi\u00e7o')}</div>
        <div class="item-meta">${esc(pro?.name || 'Profissional')} \u00b7 ${money(service?.price || 0)} \u00b7 ${Number(service?.duration || 0)} min</div>
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
      return `${time}${service?.name || 'Servi\u00e7o'} com ${pro?.name || 'profissional'}`;
    }).join(' \u00b7 ');
  }

  function permuteItems(list, limit = 720) {
    if ((list || []).length <= 1) return [list || []];
    const result = [];
    const used = new Array(list.length).fill(false);
    function walk(path) {
      if (result.length >= limit) return;
      if (path.length === list.length) {
        result.push(path.slice());
        return;
      }
      for (let i = 0; i < list.length; i += 1) {
        if (used[i]) continue;
        used[i] = true;
        path.push(list[i]);
        walk(path);
        path.pop();
        used[i] = false;
        if (result.length >= limit) break;
      }
    }
    walk([]);
    return result;
  }

  function candidateServiceOrders(salonId, items) {
    const { services, categories } = salonData(salonId);
    const normal = [];
    const finalStage = [];
    (items || []).forEach(item => {
      const service = services.find(s => s.id === item.serviceId);
      if (isFinalStageService(service, categories)) finalStage.push(item);
      else normal.push(item);
    });

    const maxOrders = 720;
    const normalOrders = permuteItems(normal, maxOrders);
    const finalLimit = Math.max(1, Math.floor(maxOrders / Math.max(1, normalOrders.length)));
    const finalOrders = permuteItems(finalStage, finalLimit);
    const orders = [];

    for (const firstPart of normalOrders) {
      for (const lastPart of finalOrders) {
        orders.push([...firstPart, ...lastPart]);
        if (orders.length >= maxOrders) return orders;
      }
    }
    return orders.length ? orders : [items || []];
  }

  function buildServicePlanForStart(salonId, items, date, startMin) {
    const { salon, professionals, services, appointments } = salonData(salonId);
    const cleaned = sanitizeServiceItems(salonId, items || []);
    if (!cleaned.length || !date) return null;
    for (const orderedItems of candidateServiceOrders(salonId, cleaned)) {
      let cursor = startMin;
      const segments = [];
      let ok = true;
      for (const item of orderedItems) {
        const service = services.find(s => s.id === item.serviceId);
        const professional = professionals.find(p => p.id === item.professionalId);
        const duration = itemDuration(item, services, salon);
        if (!service || !professional || !duration) {
          ok = false;
          break;
        }
        const start = cursor;
        const end = cursor + duration;
        if (!isProfessionalSegmentAvailable({ salon, professional, date, startMin: start, endMin: end, appointments })) {
          ok = false;
          break;
        }
        segments.push({ ...item, start: minToTime(start), end: minToTime(end), duration });
        cursor = end;
      }
      if (ok) {
        return {
          items: orderedItems,
          segments,
          start: minToTime(startMin),
          end: minToTime(cursor),
          duration: cursor - startMin
        };
      }
    }
    return null;
  }

  function isProfessionalSegmentAvailable({ salon, professional, date, startMin, endMin, appointments }) {
    const salonHours = salonHoursForDate(salon, date);
    if (!salonHours) return false;
    const schedule = scheduleForDate(professional, date, salon.id);
    if (!schedule) return false;
    if (startMin < Math.max(timeToMin(salonHours.start), timeToMin(schedule.start))) return false;
    if (endMin > Math.min(timeToMin(salonHours.end), timeToMin(schedule.end))) return false;
    if (salonHours.breakStart && salonHours.breakEnd) {
      const breakStart = timeToMin(salonHours.breakStart);
      const breakEnd = timeToMin(salonHours.breakEnd);
      if (startMin < breakEnd && endMin > breakStart) return false;
    }
    if (schedule.breakStart && schedule.breakEnd) {
      const breakStart = timeToMin(schedule.breakStart);
      const breakEnd = timeToMin(schedule.breakEnd);
      if (startMin < breakEnd && endMin > breakStart) return false;
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
    const salonHours = salonHoursForDate(salon, date);
    if (!salonHours) return [];
    const salonStart = timeToMin(salonHours.start);
    const salonEnd = timeToMin(salonHours.end);
    for (let m = salonStart; m + totalDuration <= salonEnd; m += 30) {
      const t = minToTime(m);
      const startDate = new Date(`${date}T${t}:00`);
      if (startDate < minDate) continue;
      if (buildServicePlanForStart(salonId, items, date, m)) slots.push(t);
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
        <header class="section"><div><div class="eyebrow">Painel administrativo</div><h1 style="margin:.2em 0">BellaOS</h1><p class="card-sub">Gerencie sal\u00f5es, planos, status, demonstra\u00e7\u00f5es e m\u00e9tricas gerais.</p></div><button class="btn secondary" onclick="Bella.logout()">Sair</button></header>
        <div class="admin-grid">
          <div class="admin-card"><div class="stat-label">Sal\u00f5es ativos</div><div class="stat-number">${active}</div></div>
          <div class="admin-card"><div class="stat-label">Agendamentos</div><div class="stat-number">${totalAppointments}</div></div>
          <div class="admin-card"><div class="stat-label">Plano principal</div><div class="stat-number">Premium</div></div>
        </div>
        <section class="section"><h2>Sal\u00f5es cadastrados</h2><button class="btn small brand" onclick="Bella.openAdminCreateSalon()">Novo sal\u00e3o</button></section>
        <div class="list">
          ${salons.map(s => `<article class="item"><div class="avatar">${initials(s.name)}</div><div class="item-main"><div class="item-title">${esc(s.name)} <span class="badge ${s.status === 'ativo' ? 'success' : 'danger'}">${esc(s.status)}</span></div><div class="item-meta">/${esc(s.slug)} \u00b7 ${esc(s.plan)} \u00b7 ${esc(s.whatsapp)}</div><div class="actions" style="margin-top:10px"><button class="btn small secondary" onclick="Bella.toggleSalonStatus('${s.id}')">${s.status === 'ativo' ? 'Bloquear' : 'Ativar'}</button><button class="btn small secondary" onclick="Bella.copyText('${bookingUrl(s.slug)}')">Copiar agenda</button></div></div></article>`).join('')}
        </div>
      </main>
    `;
  }


  function currentSetupSalonTarget() {
    const salon = currentSalon();
    if (!salon) return null;
    return salon;
  }

  function setSetupStep(step) {
    const salon = currentSetupSalonTarget();
    if (!salon) return;
    const db = getDb();
    const target = db.salons.find(s => s.id === salon.id);
    target.setupStep = Math.max(1, Math.min(4, Number(step || 1)));
    saveDb(db);
    render();
  }

  function nextSetupStep() {
    const salon = currentSetupSalonTarget();
    if (!salon) return;
    setSetupStep(Number(salon.setupStep || 1) + 1);
  }

  function prevSetupStep() {
    const salon = currentSetupSalonTarget();
    if (!salon) return;
    setSetupStep(Number(salon.setupStep || 1) - 1);
  }

  function saveSetupUnit(event) {
    event.preventDefault();
    const salon = currentSetupSalonTarget();
    if (!salon) return;
    const data = new FormData(event.target);
    const db = getDb();
    db.units = db.units || [];
    db.units.push({
      id: uid('unit'),
      salonId: salon.id,
      name: String(data.get('name') || '').trim(),
      address: String(data.get('address') || '').trim(),
      phone: normalizePhone(data.get('phone') || ''),
      active: true,
      createdAt: new Date().toISOString()
    });
    saveDb(db);
    toast('Unidade adicionada.');
    render();
  }

  function deleteSetupUnit(id) {
    const salon = currentSetupSalonTarget();
    if (!salon) return;
    const db = getDb();
    const used = db.professionals.some(p => p.unitId === id);
    if (used) return toast('Esta unidade possui profissional vinculado.');
    db.units = (db.units || []).filter(u => u.id !== id);
    saveDb(db);
    render();
  }

  function saveSetupService(event) {
    event.preventDefault();
    const salon = currentSetupSalonTarget();
    if (!salon) return;
    const data = new FormData(event.target);
    const categoryName = String(data.get('category') || 'Outros').trim();
    const db = getDb();
    let cat = db.categories.find(c => c.salonId === salon.id && c.name.toLowerCase() === categoryName.toLowerCase());
    if (!cat) {
      cat = { id: uid('cat'), salonId: salon.id, name: categoryName };
      db.categories.push(cat);
    }
    db.services.push({
      id: uid('srv'),
      salonId: salon.id,
      categoryId: cat.id,
      name: String(data.get('name') || '').trim(),
      price: Number(String(data.get('price') || '0').replace('.', '').replace(',', '.')) || 0,
      duration: Number(data.get('duration') || 60),
      minAdvanceMinutes: Number(data.get('minAdvanceMinutes') || 120),
      buffer: 10,
      active: true,
      commissionType: 'percent',
      commissionValue: 40,
      products: []
    });
    saveDb(db);
    toast('Servi\u00e7o adicionado.');
    render();
  }

  function deleteSetupService(id) {
    const db = getDb();
    db.services = db.services.filter(s => s.id !== id);
    db.professionals.forEach(p => { p.services = (p.services || []).filter(sid => sid !== id); });
    saveDb(db);
    render();
  }

  function saveSetupProfessional(event) {
    event.preventDefault();
    const salon = currentSetupSalonTarget();
    if (!salon) return;
    const data = new FormData(event.target);
    const services = data.getAll('services');
    if (!services.length) return toast('Selecione pelo menos um servi\u00e7o.');
    const db = getDb();
    db.professionals.push({
      id: uid('pro'),
      salonId: salon.id,
      unitId: String(data.get('unitId') || ''),
      name: String(data.get('name') || '').trim(),
      phone: normalizePhone(data.get('phone') || ''),
      specialty: String(data.get('specialty') || '').trim(),
      services,
      workDays: [1,2,3,4,5,6],
      start: '09:00',
      end: '18:00',
      lunchStart: '12:30',
      lunchEnd: '13:30',
      commissionDefault: 40,
      color: '#C89B7B',
      active: true
    });
    saveDb(db);
    toast('Profissional adicionada.');
    render();
  }

  function deleteSetupProfessional(id) {
    const db = getDb();
    db.professionals = db.professionals.filter(p => p.id !== id);
    saveDb(db);
    render();
  }

  function saveSetupSchedule(event, professionalId) {
    event.preventDefault();
    const data = new FormData(event.target);
    const db = getDb();
    const p = db.professionals.find(x => x.id === professionalId);
    if (!p) return;
    const workDays = data.getAll('workDays').map(Number);
    if (!workDays.length) return toast('Selecione pelo menos um dia.');
    p.workDays = workDays;
    p.start = String(data.get('start') || '09:00');
    p.end = String(data.get('end') || '18:00');
    p.lunchStart = String(data.get('lunchStart') || '');
    p.lunchEnd = String(data.get('lunchEnd') || '');
    p.weeklySchedule = defaultWeeklySchedule(p);
    saveDb(db);
    toast('Hor\u00e1rio salvo.');
    render();
  }

  function finishSetup() {
    const salon = currentSetupSalonTarget();
    if (!salon) return;
    const data = salonData(salon.id);
    if (!data.units.length) return toast('Cadastre pelo menos uma unidade.');
    if (!data.services.length) return toast('Cadastre pelo menos um servi\u00e7o.');
    if (!data.professionals.length) return toast('Cadastre pelo menos uma profissional.');
    const db = getDb();
    const target = db.salons.find(s => s.id === salon.id);
    target.setupCompleted = true;
    target.setupStep = 4;
    saveDb(db);
    toast('Configura\u00e7\u00e3o finalizada.');
    render();
  }

  function login(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim().toLowerCase();
    const password = String(form.get('password'));
    const db = getDb();
    const user = db.users.find(u => u.email.toLowerCase() === email && u.password === password);
    if (!user) return toast('E-mail ou senha inv\u00e1lidos.');
    setSession(user.id);
    const salon = user.role === 'super_admin' ? null : db.salons.find(s => s.id === user.salonId);
    const lock = subscriptionLockInfo(salon);
    toast(lock.locked ? 'Assinatura vencida. Regularize para continuar.' : (user.mustChangePassword ? 'Crie uma nova senha para continuar.' : 'Bem-vinda ao BellaOS.'));
    render();
  }

  function changePassword(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    const confirm = String(form.get('confirm'));
    if (password !== confirm) return toast('As senhas n\u00e3o conferem.');
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
    if (!items.length) return toast('Adicione pelo menos um servi\u00e7o.');
    const date = String(data.get('date') || draft.date || '');
    const start = String(data.get('start') || draft.time || '');
    if (!start) return toast('Selecione um hor\u00e1rio dispon\u00edvel.');
    const availableSlots = getMultiAvailableSlots(salon.id, items, date);
    if (!availableSlots.includes(start)) return toast('Este hor\u00e1rio n\u00e3o est\u00e1 dispon\u00edvel ou j\u00e1 passou.');
    const plan = buildServicePlanForStart(salon.id, items, date, timeToMin(start));
    if (!plan) return toast('N\u00e3o foi poss\u00edvel encaixar todos os servi\u00e7os nos hor\u00e1rios das profissionais.');
    const db = getDb();
    const { services, professionals } = salonData(salon.id);
    const clientId = String(data.get('clientId'));
    const groupId = uid('grp');
    const notes = String(data.get('notes') || '');
    const orderedItems = plan.items;
    const summary = itemSummary(orderedItems, services, professionals, start);
    plan.segments.forEach((segment, index) => {
      const service = services.find(s => s.id === segment.serviceId);
      db.appointments.push({
        id: uid('app'),
        groupId,
        groupIndex: index + 1,
        groupTotal: orderedItems.length,
        salonId: salon.id,
        clientId,
        professionalId: segment.professionalId,
        serviceIds: [segment.serviceId],
        date,
        start: segment.start,
        end: segment.end,
        status: 'agendado',
        total: Number(service?.price || 0),
        duration: segment.duration,
        notes: `${notes}${orderedItems.length > 1 ? (notes ? '\n' : '') + 'Atendimento combinado: ' + summary : ''}`,
        createdBy: currentUser().id,
        createdAt: new Date().toISOString()
      });
    });
    saveDb(db);
    state.modal = null;
    state.selectedDate = date;
    state.appointmentDraft = { items: [], draftProfessionalId: '', draftServiceId: '', date: todayISO(), time: '' };
    toast(items.length > 1 ? 'Atendimento com m\u00faltiplos servi\u00e7os criado.' : 'Agendamento criado.');
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
    if (!payload.name || !payload.price || !payload.duration) return toast('Preencha nome, pre\u00e7o e dura\u00e7\u00e3o.');
    const db = getDb();
    const existing = db.services.find(s => s.id === serviceId && s.salonId === salon.id);
    if (existing) Object.assign(existing, payload, { products: existing.products || [] });
    else db.services.push({ id: uid('srv'), ...payload, products: [] });
    saveDb(db);
    state.modal = null;
    toast(existing ? 'Servi\u00e7o atualizado.' : 'Servi\u00e7o cadastrado.');
    render();
  }

  function saveProfessional(event, professionalId = '') {
    event.preventDefault();
    if (!canEdit()) return;
    const salon = currentSalon();
    const data = new FormData(event.currentTarget);
    const services = data.getAll('services');
    if (!services.length) return toast('Selecione pelo menos um servi\u00e7o.');
    const weeklySchedule = scheduleFromForm(data);
    const scheduleError = validateWeeklySchedule(weeklySchedule);
    if (scheduleError) return toast(scheduleError);
    const first = firstActiveSchedule(weeklySchedule);
    const workDays = WEEK_DAYS.filter(day => weeklySchedule[day.value].active).map(day => day.value);
    const payload = {
      salonId: salon.id,
      name: String(data.get('name')).trim(),
      phone: String(data.get('phone') || '').trim(),
      specialty: String(data.get('specialty') || '').trim(),
      services,
      weeklySchedule,
      workDays,
      start: first.start,
      end: first.end,
      lunchStart: first.breakStart || '',
      lunchEnd: first.breakEnd || '',
      commissionDefault: Number(data.get('commissionDefault') || 0),
      active: data.has('active')
    };
    if (!payload.name) return toast('Informe o nome da profissional.');
    const db = getDb();
    const existing = db.professionals.find(p => p.id === professionalId && p.salonId === salon.id);
    if (existing) Object.assign(existing, payload, { color: existing.color || '#C89B7B' });
    else db.professionals.push({ id: uid('pro'), ...payload, color: '#C89B7B' });
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
      ? `Excluir ${client.name}? A ficha, hist\u00f3rico capilar e ${relatedAppointmentIds.length} agendamento(s) vinculados tamb\u00e9m ser\u00e3o removidos.`
      : `Excluir ${client.name}?`;
    if (!confirm(message)) return;
    db.clients = db.clients.filter(c => c.id !== clientId);
    db.hairHistory = db.hairHistory.filter(h => h.clientId !== clientId);
    db.appointments = db.appointments.filter(a => a.clientId !== clientId);
    db.financial = db.financial.filter(f => !relatedAppointmentIds.includes(f.appointmentId));
    saveDb(db);
    state.modal = null;
    toast('Cliente exclu\u00edda.');
    render();
  }

  function deleteService(serviceId) {
    if (!canEdit()) return;
    const db = getDb();
    const salon = currentSalon();
    const service = db.services.find(s => s.id === serviceId && s.salonId === salon?.id);
    if (!service) return;
    if (!confirm(`Excluir o servi\u00e7o "${service.name}"? Ele ser\u00e1 removido das profissionais e dos agendamentos vinculados.`)) return;
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
    toast('Servi\u00e7o exclu\u00eddo.');
    render();
  }

  function deleteProfessional(professionalId) {
    if (!canEdit()) return;
    const db = getDb();
    const pro = db.professionals.find(p => p.id === professionalId && p.salonId === currentSalon()?.id);
    if (!pro) return;
    const related = db.appointments.filter(a => a.professionalId === professionalId).length;
    const message = related
      ? `Excluir ${pro.name}? Os agendamentos antigos ser\u00e3o mantidos, mas ficar\u00e3o sem profissional definida.`
      : `Excluir ${pro.name}?`;
    if (!confirm(message)) return;
    db.professionals = db.professionals.filter(p => p.id !== professionalId);
    db.clients.forEach(c => { if (c.preferredProfessionalId === professionalId) c.preferredProfessionalId = ''; });
    db.appointments.forEach(a => { if (a.professionalId === professionalId) a.professionalId = ''; });
    db.hairHistory.forEach(h => { if (h.professionalId === professionalId) h.professionalId = ''; });
    saveDb(db);
    state.modal = null;
    toast('Profissional exclu\u00edda.');
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
    toast('Lan\u00e7amento salvo.');
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
    if (slugTaken) return toast('Este slug j\u00e1 est\u00e1 em uso.');
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
      bookingEnabled: data.has('bookingEnabled'),
      infinitePayHandle: String(data.get('infinitePayHandle') || '').replace(/^\$/, '').trim()
    });
    saveDb(db);
    toast('Configura\u00e7\u00f5es salvas.');
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
    window.open(`https://wa.me/?text=${encodeURIComponent(`Agende seu hor\u00e1rio no ${salon.name}: ${link}`)}`, '_blank');
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
      const services = getActiveServicesForProfessional(salon.id, value);
      if (!services.some(s => s.id === state.publicBooking.draftServiceId)) state.publicBooking.draftServiceId = services[0]?.id || '';
    }
    if (field === 'serviceId') {
      state.publicBooking.draftServiceId = value;
      const pro = getActiveProfessionals(salon.id).find(p => p.id === state.publicBooking.draftProfessionalId);
      if (!pro || !(pro.services || []).includes(value)) {
        const available = getProfessionalsForService(salon.id, value);
        state.publicBooking.draftProfessionalId = available[0]?.id || '';
      }
    }
    render();
  }

  function addPublicItem() {
    const salon = salonBySlug(location.pathname.split('/agenda/')[1] || '') || currentSalon();
    if (!salon) return;
    const b = ensurePublicBookingState(salon.id);
    if (!b.draftProfessionalId || !b.draftServiceId) return toast('Escolha profissional e servi\u00e7o.');
    const valid = getProfessionalsForService(salon.id, b.draftServiceId).some(p => p.id === b.draftProfessionalId);
    if (!valid) return toast('Esta profissional n\u00e3o realiza este servi\u00e7o.');
    b.items.push({ id: uid('bi'), professionalId: b.draftProfessionalId, serviceId: b.draftServiceId });
    b.items = orderServiceItems(salon.id, b.items);
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
      const services = getActiveServicesForProfessional(salon.id, value);
      if (!services.some(s => s.id === state.appointmentDraft.draftServiceId)) state.appointmentDraft.draftServiceId = services[0]?.id || '';
    }
    if (field === 'serviceId') {
      state.appointmentDraft.draftServiceId = value;
      const pro = getActiveProfessionals(salon.id).find(p => p.id === state.appointmentDraft.draftProfessionalId);
      if (!pro || !(pro.services || []).includes(value)) {
        const available = getProfessionalsForService(salon.id, value);
        state.appointmentDraft.draftProfessionalId = available[0]?.id || '';
      }
    }
    render();
  }

  function addAppointmentItem() {
    const salon = currentSalon();
    if (!salon) return;
    const d = ensureAppointmentDraft(salon.id);
    if (!d.draftProfessionalId || !d.draftServiceId) return toast('Escolha profissional e servi\u00e7o.');
    const valid = getProfessionalsForService(salon.id, d.draftServiceId).some(p => p.id === d.draftProfessionalId);
    if (!valid) return toast('Esta profissional n\u00e3o realiza este servi\u00e7o.');
    d.items.push({ id: uid('ai'), professionalId: d.draftProfessionalId, serviceId: d.draftServiceId });
    d.items = orderServiceItems(salon.id, d.items);
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
    if (!items.length) return toast('Adicione pelo menos um servi\u00e7o.');
    if (!b.date || !b.time) return toast('Escolha uma data e hor\u00e1rio.');
    if (b.date < todayISO()) return toast('Escolha uma data atual ou futura.');
    if (!b.clientName.trim() || normalizePhone(b.clientPhone).length < 10) return toast('Informe nome e WhatsApp v\u00e1lidos.');
    const slots = getMultiAvailableSlots(salonId, items, b.date);
    if (!slots.includes(b.time)) return toast('Este hor\u00e1rio n\u00e3o est\u00e1 mais dispon\u00edvel.');
    const plan = buildServicePlanForStart(salonId, items, b.date, timeToMin(b.time));
    if (!plan) return toast('N\u00e3o foi poss\u00edvel encaixar todos os servi\u00e7os nos hor\u00e1rios das profissionais.');
    const db = getDb();
    let client = db.clients.find(c => c.salonId === salonId && normalizePhone(c.phone) === normalizePhone(b.clientPhone));
    if (!client) {
      client = { id: uid('cli'), salonId, name: b.clientName.trim(), phone: b.clientPhone.trim(), email: '', preferredProfessionalId: plan.items[0].professionalId, notes: '', formula: '', visits: 0, totalSpent: 0, createdAt: new Date().toISOString() };
      db.clients.push(client);
    }
    const groupId = uid('grp');
    const summary = itemSummary(plan.items, services, professionals, b.time);
    plan.segments.forEach((segment, index) => {
      const service = services.find(s => s.id === segment.serviceId);
      db.appointments.push({
        id: uid('app'),
        groupId,
        groupIndex: index + 1,
        groupTotal: plan.items.length,
        salonId,
        clientId: client.id,
        professionalId: segment.professionalId,
        serviceIds: [segment.serviceId],
        date: b.date,
        start: segment.start,
        end: segment.end,
        status: 'agendado',
        total: Number(service?.price || 0),
        duration: segment.duration,
        notes: `${b.notes || 'Agendado pela cliente no link p\u00fablico.'}${plan.items.length > 1 ? '\nAtendimento combinado: ' + summary : ''}`,
        createdBy: 'public',
        createdAt: new Date().toISOString()
      });
    });
    saveDb(db);
    const msg = `Ol\u00e1, ${client.name}! Seu hor\u00e1rio no ${salon.name} foi solicitado para ${brDate(b.date)}. Servi\u00e7os: ${summary}. Valor total: ${money(multiServiceTotal(plan.items, services))}.`;
    state.publicBooking = { items: [], draftProfessionalId: '', draftServiceId: '', date: todayISO(), time: '', clientName: '', clientPhone: '', notes: '' };
    render();
    setTimeout(() => {
      toast('Agendamento confirmado.');
      const open = confirm('Agendamento confirmado! Deseja enviar a confirma\u00e7\u00e3o pelo WhatsApp?');
      if (open) window.open(`https://wa.me/55${normalizePhone(client.phone)}?text=${encodeURIComponent(msg)}`, '_blank');
    }, 120);
  }


  
  async function generateCheckoutForSalon({ salonId, userId, planId, customer, salonDataInput, source = 'internal' }) {
    const db = getDb();
    const salon = db.salons.find(s => s.id === salonId);
    const user = db.users.find(u => u.id === userId);
    if (!salon || !user) throw new Error('Cadastro n\u00e3o encontrado.');
    const plan = getPlan(planId || salon.subscriptionPlanId || 'mensal');
    const handle = String(salon.infinitePayHandle || DEFAULT_INFINITEPAY_HANDLE || '').replace(/^\$/, '').trim();
    if (!handle) throw new Error('InfiniteTag n\u00e3o configurada.');

    const previousOrder = salon.subscriptionOrderNsu || '';
    const orderNsu = `bellaos-${salon.slug}-${plan.id}-${Date.now()}`;
    const nextDueDate = addMonthsISOFrom(todayISO(), plan.cycleMonths);
    const graceUntil = addDaysToISO(nextDueDate, 3);

    salon.subscriptionStatus = 'pendente';
    salon.subscriptionPlanId = plan.id;
    salon.subscriptionPlanName = plan.name;
    salon.subscriptionPrice = plan.amountCents / 100;
    salon.subscriptionCycleMonths = plan.cycleMonths;
    salon.subscriptionInstallments = plan.installments;
    salon.subscriptionInstallmentCents = plan.installmentCents;
    salon.subscriptionDueDate = nextDueDate;
    salon.subscriptionGraceUntil = graceUntil;
    salon.subscriptionPreviousOrderNsu = previousOrder || salon.subscriptionPreviousOrderNsu || '';
    salon.subscriptionReplacedOrders = [...(salon.subscriptionReplacedOrders || []), previousOrder].filter(Boolean);
    salon.subscriptionOrderNsu = orderNsu;
    salon.subscriptionCheckoutUrl = '';
    salon.subscriptionPaidAt = '';
    salon.subscriptionUpdatedAt = new Date().toISOString();
    saveDb(db);

    const payload = {
      handle,
      order_nsu: orderNsu,
      salon: {
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        phone_number: salon.whatsapp ? `+55${normalizePhone(salon.whatsapp)}` : undefined,
        cnpj: salon.cnpj || undefined,
        ...(salonDataInput || {})
      },
      customer: {
        name: customer?.name || user.name,
        email: customer?.email || user.email,
        phone_number: customer?.phone_number || (salon.adminPhone ? `+55${normalizePhone(salon.adminPhone)}` : undefined)
      },
      metadata: {
        recurrence: true,
        source,
        replaces_order_nsu: previousOrder || '',
        plan_id: plan.id,
        plan_name: plan.name,
        cycle_months: plan.cycleMonths,
        installments: plan.installments,
        installment_cents: plan.installmentCents,
        amount_cents: plan.amountCents,
        next_due_date: nextDueDate,
        grace_until: graceUntil,
        salon_id: salon.id,
        salon_name: salon.name
      },
      plan: {
        id: plan.id,
        name: `${BELLAOS_PLAN_NAME} - ${plan.name}`,
        price: plan.amountCents,
        display: plan.displayText,
        recurrence: true,
        cycle_months: plan.cycleMonths,
        installments: plan.installments
      }
    };

    const response = await fetch('/api/infinitepay-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.url) throw new Error(result.error || 'N\u00e3o foi poss\u00edvel gerar o checkout.');

    const latestDb = getDb();
    const target = latestDb.salons.find(s => s.id === salon.id);
    if (target) {
      target.subscriptionCheckoutUrl = result.url;
      target.subscriptionUpdatedAt = new Date().toISOString();
      saveDb(latestDb);
    }

    const checkoutInfo = {
      orderNsu,
      previousOrder,
      salonId: salon.id,
      userId: user.id,
      planId: plan.id,
      planName: plan.name,
      cycleMonths: plan.cycleMonths,
      nextDueDate,
      graceUntil,
      checkoutUrl: result.url,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('bellaos.last_internal_checkout', JSON.stringify(checkoutInfo));
    if (source === 'public') localStorage.setItem('bellaos.last_public_checkout', JSON.stringify(checkoutInfo));
    return { url: result.url, orderNsu, plan, previousOrder };
  }


async function startPublicSubscriptionPayment(event) {
    event?.preventDefault?.();
    const form = event?.target;
    const formData = form ? Object.fromEntries(new FormData(form).entries()) : {};
    const plan = getPlan(formData.planId || 'mensal');
    const handle = String(DEFAULT_INFINITEPAY_HANDLE || '').replace(/^\$/, '').trim();
    if (!handle) {
      toast('Configure a InfiniteTag no arquivo app.js ou pelo configurar_bellaos.bat.');
      return;
    }

    const adminName = String(formData.adminName || '').trim();
    const adminCpf = String(formData.adminCpf || '').replace(/\D/g, '');
    const adminBirthDate = String(formData.adminBirthDate || '').trim();
    const adminPhone = normalizePhone(formData.adminPhone || '');
    const adminEmail = String(formData.adminEmail || '').trim().toLowerCase();
    const password = String(formData.password || '');
    const confirmPassword = String(formData.confirmPassword || '');

    const salonName = String(formData.salonName || 'Novo sal\u00e3o BellaOS').trim();
    const salonCnpj = String(formData.salonCnpj || '').replace(/\D/g, '');
    const salonPhone = normalizePhone(formData.salonPhone || '');

    if (!adminName || !adminCpf || !adminBirthDate || !adminPhone || !adminEmail || !salonName || !salonPhone) {
      toast('Preencha todos os campos obrigat\u00f3rios.');
      return;
    }
    if (password.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.');
    if (password !== confirmPassword) return toast('As senhas n\u00e3o conferem.');

    const db = getDb();
    const existingUser = db.users.find(u => String(u.email || '').toLowerCase() === adminEmail);
    if (existingUser) {
      const existingSalon = db.salons.find(s => s.id === existingUser.salonId);
      if (!existingSalon) {
        toast('Este e-mail j\u00e1 possui cadastro. Use o login ou outro e-mail.');
        return;
      }
      if (existingSalon.subscriptionStatus === 'ativo') {
        toast('Este e-mail j\u00e1 possui assinatura ativa. Use o login.');
        return;
      }

      try {
        toast('Atualizando plano pendente e gerando novo checkout...');
        setSession(existingUser.id);
        const result = await generateCheckoutForSalon({
          salonId: existingSalon.id,
          userId: existingUser.id,
          planId: plan.id,
          source: 'public',
          customer: { name: existingUser.name, email: existingUser.email, phone_number: adminPhone ? `+55${adminPhone}` : undefined },
          salonDataInput: { name: existingSalon.name, slug: existingSalon.slug }
        });
        window.open(result.url, '_blank');
        toast('Novo checkout gerado. O link anterior foi substitu\u00eddo.');
        return;
      } catch (error) {
        console.error(error);
        toast(error.message || 'Erro ao atualizar o plano pendente.');
        return;
      }
    }

    const salonId = uid('salon');
    const userId = uid('user');
    let baseSlug = slugify(salonName) || 'novo-salao';
    let slug = baseSlug;
    let i = 2;
    while (db.salons.some(s => s.slug === slug)) slug = `${baseSlug}-${i++}`;

    db.salons.push({
      id: salonId,
      name: salonName,
      slug,
      logoUrl: '/assets/logo-mark.svg',
      whatsapp: salonPhone,
      address: '',
      cnpj: salonCnpj,
      adminCpf,
      adminBirthDate,
      adminPhone,
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
      plan: BELLAOS_PLAN_NAME,
      subscriptionStatus: 'pendente',
      subscriptionPlanId: plan.id,
      subscriptionPlanName: plan.name,
      subscriptionPrice: plan.amountCents / 100,
      subscriptionCycleMonths: plan.cycleMonths,
      subscriptionInstallments: plan.installments,
      subscriptionInstallmentCents: plan.installmentCents,
      subscriptionDueDate: addMonthsISOFrom(todayISO(), plan.cycleMonths),
      subscriptionGraceUntil: addDaysToISO(addMonthsISOFrom(todayISO(), plan.cycleMonths), 3),
      subscriptionOrderNsu: '',
      subscriptionReplacedOrders: [],
      infinitePayHandle: handle,
      setupCompleted: false,
      setupStep: 1,
      createdAt: new Date().toISOString()
    });

    db.users.push({
      id: userId,
      salonId,
      name: adminName,
      email: adminEmail,
      password,
      role: 'owner',
      mustChangePassword: false,
      isDemo: false,
      createdAt: new Date().toISOString()
    });

    db.units = db.units || [];
    saveDb(db);
    setSession(userId);

    try {
      toast('Gerando link de pagamento...');
      const result = await generateCheckoutForSalon({
        salonId,
        userId,
        planId: plan.id,
        source: 'public',
        customer: { name: adminName, email: adminEmail, phone_number: adminPhone ? `+55${adminPhone}` : undefined },
        salonDataInput: { name: salonName, slug, cnpj: salonCnpj || undefined, phone_number: salonPhone ? `+55${salonPhone}` : undefined }
      });

      const publicCheckout = JSON.parse(localStorage.getItem('bellaos.last_public_checkout') || '{}');
      localStorage.setItem('bellaos.last_public_checkout', JSON.stringify({
        ...publicCheckout,
        adminName,
        adminCpf,
        adminBirthDate,
        adminPhone,
        adminEmail,
        salonName,
        salonCnpj,
        salonPhone
      }));

      window.open(result.url, '_blank');
      toast('Cadastro criado. Finalize o pagamento para liberar o painel.');
    } catch (error) {
      console.error(error);
      const rollback = getDb();
      rollback.users = rollback.users.filter(u => u.id !== userId);
      rollback.salons = rollback.salons.filter(s => s.id !== salonId);
      saveDb(rollback);
      localStorage.removeItem(SESSION_KEY);
      toast(error.message || 'Erro ao gerar pagamento InfinitePay.');
      render();
    }
  }

  async function startSubscriptionPayment(planId = 'mensal') {
    const user = currentUser();
    const salon = currentSalon();
    if (!user || !salon) return;
    try {
      toast('Gerando novo checkout...');
      const result = await generateCheckoutForSalon({
        salonId: salon.id,
        userId: user.id,
        planId: planId || salon.subscriptionPlanId || 'mensal',
        source: 'internal',
        customer: { name: user.name, email: user.email, phone_number: salon.whatsapp ? `+55${normalizePhone(salon.whatsapp || '')}` : undefined }
      });
      window.open(result.url, '_blank');
      toast(result.previousOrder ? 'Novo checkout gerado. O link anterior foi substitu\u00eddo.' : 'Link de pagamento aberto.');
      render();
    } catch (error) {
      console.error(error);
      toast(error.message || 'Erro ao gerar pagamento InfinitePay.');
    }
  }

  function toggleExceptionScope(value) {
    const el = document.querySelector('.exception-professional');
    if (el) el.style.display = value === 'professional' ? '' : 'none';
  }

  function saveScheduleException(event, exceptionId = '') {
    event.preventDefault();
    if (!canEdit()) return;
    const salon = currentSalon();
    const data = new FormData(event.target);
    const scope = String(data.get('scope') || 'salon');
    const closed = data.has('closed');
    const item = {
      id: exceptionId || uid('exc'),
      salonId: salon.id,
      date: String(data.get('date') || todayISO()),
      scope,
      professionalId: scope === 'professional' ? String(data.get('professionalId') || '') : '',
      closed,
      start: String(data.get('start') || '09:00'),
      end: String(data.get('end') || '18:00'),
      breakStart: String(data.get('breakStart') || ''),
      breakEnd: String(data.get('breakEnd') || ''),
      reason: String(data.get('reason') || '').trim()
    };
    if (item.date < todayISO()) return toast('Escolha uma data atual ou futura.');
    if (item.scope === 'professional' && !item.professionalId) return toast('Escolha uma profissional.');
    if (!item.closed) {
      if (timeToMin(item.start) >= timeToMin(item.end)) return toast('O hor\u00e1rio de abertura precisa ser antes do fechamento.');
      if (item.breakStart && item.breakEnd) {
        if (timeToMin(item.breakStart) >= timeToMin(item.breakEnd)) return toast('Revise o hor\u00e1rio do intervalo.');
        if (timeToMin(item.breakStart) < timeToMin(item.start) || timeToMin(item.breakEnd) > timeToMin(item.end)) return toast('O intervalo precisa ficar dentro do hor\u00e1rio de funcionamento.');
      }
    }
    const db = getDb();
    db.scheduleExceptions = db.scheduleExceptions || [];
    const duplicate = db.scheduleExceptions.find(x => x.id !== item.id && x.salonId === item.salonId && x.date === item.date && x.scope === item.scope && (item.scope === 'salon' || x.professionalId === item.professionalId));
    if (duplicate) return toast('J\u00e1 existe uma exce\u00e7\u00e3o para essa data e escopo. Edite a existente.');
    const idx = db.scheduleExceptions.findIndex(x => x.id === item.id);
    if (idx >= 0) db.scheduleExceptions[idx] = item;
    else db.scheduleExceptions.push(item);
    saveDb(db);
    state.modal = null;
    toast('Exce\u00e7\u00e3o de agenda salva.');
    render();
  }

  function deleteScheduleException(exceptionId) {
    if (!canEdit() || !confirm('Excluir esta exce\u00e7\u00e3o de agenda?')) return;
    const db = getDb();
    db.scheduleExceptions = (db.scheduleExceptions || []).filter(x => x.id !== exceptionId);
    saveDb(db);
    state.modal = null;
    toast('Exce\u00e7\u00e3o exclu\u00edda.');
    render();
  }

  function addHairHistoryPrompt(clientId) {
    if (!canEdit()) return;
    const service = prompt('Servi\u00e7o realizado:', 'Colora\u00e7\u00e3o');
    if (!service) return;
    const formula = prompt('F\u00f3rmula usada:', '7.1 + OX 20 volumes') || '';
    const notes = prompt('Observa\u00e7\u00f5es:', '') || '';
    const salon = currentSalon();
    const db = getDb();
    db.hairHistory.push({ id: uid('hist'), salonId: salon.id, clientId, date: todayISO(), service, formula, products: '', professionalId: '', notes });
    saveDb(db);
    toast('Hist\u00f3rico capilar adicionado.');
    render();
  }

  function toggleSalonStatus(salonId) {
    const user = currentUser();
    if (!user || user.role !== 'super_admin') return;
    const db = getDb();
    const salon = db.salons.find(s => s.id === salonId);
    salon.status = salon.status === 'ativo' ? 'bloqueado' : 'ativo';
    saveDb(db);
    toast(`Sal\u00e3o ${salon.status}.`);
    render();
  }

  function openAdminCreateSalon() {
    const user = currentUser();
    if (!user || user.role !== 'super_admin') return;
    const name = prompt('Nome do sal\u00e3o:');
    if (!name) return;
    const email = prompt('E-mail do usu\u00e1rio principal:');
    if (!email) return;
    const db = getDb();
    const salonId = uid('salon');
    const slug = slugify(name);
    db.salons.push({ id: salonId, name, slug, logoUrl: '/assets/logo-mark.svg', whatsapp: '', address: '', openingStart: '09:00', openingEnd: '19:00', minAdvanceMinutes: 120, bufferMinutes: 10, allowSameDay: true, allowAnyProfessional: true, showPrices: true, bookingEnabled: true, color: '#C89B7B', status: 'ativo', plan: 'BellaOS Completo', subscriptionStatus: 'teste', subscriptionPrice: 69.90, infinitePayHandle: '', createdAt: new Date().toISOString() });
    db.users.push({ id: uid('u'), salonId, name: 'Usu\u00e1ria Principal', email, password: 'bella123', role: 'owner', mustChangePassword: true, isDemo: false });
    db.categories.push(...['Cabelo','Unhas','Sobrancelhas','Maquiagem','Penteados','Noivas','Est\u00e9tica','Pacotes'].map(n => ({ id: uid('cat'), salonId, name: n })));
    saveDb(db);
    toast('Sal\u00e3o criado com senha tempor\u00e1ria bella123.');
    render();
  }

  window.Bella = {
    login, changePassword, logout, navigate, openModal, closeModal, setDate, setClientSearch, setServiceFilter,
    updateAppointmentStatus, saveAppointment, saveClient, saveService, saveProfessional, deleteClient, deleteService, deleteProfessional, saveFinancial, saveProduct, startSubscriptionPayment, startPublicSubscriptionPayment, saveScheduleException, deleteScheduleException, toggleExceptionScope,
    adjustStock, saveSettings, copyBookingLink, openBookingLink, shareBookingLink, copyText, togglePublicService, setPublicItemDraft, addPublicItem, removePublicItem,
    setAppointmentItemDraft, addAppointmentItem, removeAppointmentItem,
    setPublic, setAppointmentDraft, toggleAppointmentService, confirmPublicBooking, openClient, addHairHistoryPrompt, toast, goLogin, toggleSalonStatus, openAdminCreateSalon, saveSetupUnit, deleteSetupUnit, saveSetupService, deleteSetupService, saveSetupProfessional, deleteSetupProfessional, saveSetupSchedule, nextSetupStep, prevSetupStep, finishSetup
  };

  window.addEventListener('popstate', render);
  startRemoteSync();
  render();
})();
