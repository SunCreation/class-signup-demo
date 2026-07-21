/* ==========================================================================
   원데이 클래스 신청 - 순수 정적 프론트엔드 (Supabase 직결)
   빌드 도구 없음 · CDN UMD(@supabase/supabase-js@2)만 사용
   기능: 여러 클래스 목록 신청 + 관리자 패널(추가/수정/삭제/신청자 명단)
   ========================================================================== */
'use strict';

/* ---- 공개키 (정적 사이트에 실려도 되는 값. secret 금지) ---- */
const SUPABASE_URL = 'https://xyiwqndysskwluxmgfku.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F4W3atrd0WqLFLoSvcb9Ig_LxbbF---';

/* UMD 전역은 `supabase`. 클라이언트는 이름 충돌을 피해 `sb`로. */
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---- DOM 헬퍼 ---- */
const $ = (id) => document.getElementById(id);

/** 엘리먼트 생성 (텍스트는 textContent로 안전하게) */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** 스프링 스파인 (점 8개) */
function spineEl() {
  const spine = el('div', 'spine');
  for (let i = 0; i < 8; i++) spine.appendChild(el('i'));
  return spine;
}

const views = {
  loading: $('view-loading'),
  auth: $('view-auth'),
  class: $('view-class'),
};

function showView(name) {
  Object.keys(views).forEach((k) => {
    views[k].hidden = (k !== name);
  });
}

function setMsg(node, text, kind) {
  if (!node) return;
  if (!text) {
    node.hidden = true;
    node.textContent = '';
    node.classList.remove('error', 'info');
    return;
  }
  node.hidden = false;
  node.textContent = text;
  node.classList.remove('error', 'info');
  node.classList.add(kind === 'info' ? 'info' : 'error');
}

/* ---- Supabase 에러를 한국어로 부드럽게 ---- */
function friendlyError(error, context) {
  const raw = (error && (error.message || error.error_description || '')) || '';
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해 주세요.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return '이미 가입된 이메일이에요. 로그인해 주세요.';
  }
  if (m.includes('email') && m.includes('invalid')) {
    return '이메일 형식이 올바르지 않아요.';
  }
  if (m.includes('password') && m.includes('at least')) {
    return '비밀번호는 8자 이상이어야 해요.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return '요청이 잦아요. 잠시 후 다시 시도해 주세요.';
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network')) {
    return '네트워크 연결을 확인해 주세요.';
  }
  if (raw) return raw;
  return context === 'signup'
    ? '가입 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
    : '요청 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
}

/* ---- 이메일 @앞부분을 표시 이름으로 ---- */
function displayName(user) {
  const email = (user && user.email) || '';
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : (email || '회원');
}

/* ---- 날짜/시각 포맷 ---- */
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const base = formatDate(value);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${base} ${hh}:${mi}`;
}

/* rpc 응답이 배열/객체 어느 쪽이든 단일 객체로 */
function first(data) {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;
  return data;
}
/* rpc 응답을 항상 배열로 */
function asArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [data];
}

/* =========================================================================
   인증 화면 (로그인 / 회원가입 탭 전환)  — 기존 유지
   ========================================================================= */
const paneLogin = $('pane-login');
const paneSignup = $('pane-signup');
const msgLogin = $('msg-login');
const msgSignup = $('msg-signup');

function showLogin() {
  paneLogin.hidden = false;
  paneSignup.hidden = true;
  setMsg(msgLogin, '');
  setMsg(msgSignup, '');
}
function showSignup() {
  paneLogin.hidden = true;
  paneSignup.hidden = false;
  setMsg(msgLogin, '');
  setMsg(msgSignup, '');
}

$('go-signup').addEventListener('click', showSignup);
$('go-login').addEventListener('click', showLogin);
[['go-signup', showSignup], ['go-login', showLogin]].forEach(([id, fn]) => {
  $(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  });
});

/* ---- 로그인 ---- */
$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('btn-login');
  const email = $('login-email').value.trim();
  const password = $('login-pw').value;

  setMsg(msgLogin, '');
  if (!email || !password) {
    setMsg(msgLogin, '이메일과 비밀번호를 입력해 주세요.', 'error');
    return;
  }

  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = '로그인 중…';
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg(msgLogin, friendlyError(error, 'login'), 'error');
      return;
    }
    // 성공 시 onAuthStateChange가 화면 전환.
  } catch (err) {
    setMsg(msgLogin, friendlyError(err, 'login'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
});

/* ---- 회원가입 ---- */
$('form-signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('btn-signup');
  const email = $('signup-email').value.trim();
  const password = $('signup-pw').value;

  setMsg(msgSignup, '');
  if (!email) {
    setMsg(msgSignup, '이메일을 입력해 주세요.', 'error');
    return;
  }
  if (password.length < 8) {
    setMsg(msgSignup, '비밀번호는 8자 이상으로 입력해 주세요.', 'error');
    return;
  }

  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = '가입 중…';
  try {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) {
      setMsg(msgSignup, friendlyError(error, 'signup'), 'error');
      return;
    }
    // 이메일 확인이 꺼져 있으면 즉시 세션 생성 → onAuthStateChange가 전환.
    if (!data.session) {
      setMsg(msgSignup, '가입 확인 메일을 보냈어요. 메일함을 확인해 주세요.', 'info');
    }
  } catch (err) {
    setMsg(msgSignup, friendlyError(err, 'signup'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
});

/* =========================================================================
   로그인 후: 여러 클래스 목록 + 신청 + 관리자 패널
   ========================================================================= */
const msgClass = $('msg-class');
const classesGrid = $('classes-grid');
const classesEmpty = $('classes-empty');
const adminGrid = $('admin-grid');
const adminEmpty = $('admin-empty');
const summaryWrap = $('my-summary');
const summaryChips = $('summary-chips');
const msgAdminList = $('msg-admin-list');

/* 앱 상태 */
const appState = {
  isAdmin: false,
  classes: [],
  userId: null,
};

/* ---- dots: 채움(filled ochre) / 빈칸(empty dashed) / 마감(full muted) ---- */
function dotsEl(capacity, signupCount, closed) {
  const wrap = el('div', 'dots');
  const cap = Number(capacity) || 0;
  const filled = Math.max(0, Math.min(cap, Number(signupCount) || 0));
  for (let i = 0; i < cap; i++) {
    const dot = el('i');
    if (closed) dot.className = 'full';
    else if (i < filled) dot.className = 'filled';
    else dot.className = 'empty';
    wrap.appendChild(dot);
  }
  const remaining = Math.max(0, cap - filled);
  wrap.setAttribute('aria-label', `정원 ${cap}명 중 ${filled}명 신청 완료, 남은 자리 ${remaining}명`);
  return wrap;
}

/* ---- meta 목록 (일시/장소/강사) ---- */
function metaEl(c) {
  const ul = el('ul', 'meta');
  const rows = [
    ['일시', c.when_text || '미정', false],
    ['장소', c.place_text || '미정', false],
  ];
  if (c.instructor_text) rows.push(['강사', c.instructor_text, true]);
  rows.forEach(([k, v, isInstructor]) => {
    const li = el('li');
    li.appendChild(el('span', 'k', k));
    li.appendChild(el('span', 'v' + (isInstructor ? ' instructor' : ''), v));
    ul.appendChild(li);
  });
  return ul;
}

/* ---- seats 블록 (남은 자리 + dots) ---- */
function seatsEl(c) {
  const capacity = Number(c.capacity) || 0;
  const signupCount = Number(c.signup_count) || 0;
  const closed = !!c.closed;
  const remaining = (c.remaining != null) ? Number(c.remaining) : Math.max(0, capacity - signupCount);

  const seats = el('div', 'seats');
  const row = el('div', 'seats-row');
  row.appendChild(el('span', 'seats-label', '남은 자리'));
  const count = el('span', 'seats-count');
  count.appendChild(el('span', 'num', closed ? '0' : String(remaining)));
  count.appendChild(document.createTextNode(' '));
  count.appendChild(el('span', 'of', `/ ${capacity}`));
  row.appendChild(count);
  seats.appendChild(row);
  seats.appendChild(dotsEl(capacity, closed ? capacity : signupCount, closed));
  return seats;
}

/* =========================================================================
   사용자용 클래스 카드
   ========================================================================= */
function userClassCard(c) {
  const closed = !!c.closed;
  const applied = !!c.applied;

  const card = el('section', 'card grid-card ' + (closed ? 'closed' : 'loggedin'));
  card.appendChild(spineEl());
  const content = el('div', 'content');

  const tag = el('span', 'tag', closed ? '마감' : '클래스');
  content.appendChild(tag);
  content.appendChild(el('h1', null, c.title || '원데이 클래스'));
  if (c.subtitle) content.appendChild(el('p', 'subline', c.subtitle));
  content.appendChild(metaEl(c));
  content.appendChild(seatsEl(c));

  const btn = el('button', 'cta ochre');
  btn.type = 'button';
  if (applied) {
    btn.textContent = '신청 완료';
    btn.classList.add('disabled');
    btn.disabled = true;
  } else if (closed) {
    btn.textContent = '마감되었습니다';
    btn.classList.add('disabled');
    btn.disabled = true;
  } else {
    btn.textContent = '신청하기';
    btn.addEventListener('click', () => applyToClass(c.id, btn));
  }
  content.appendChild(btn);

  if (applied) {
    const hist = el('p', 'history');
    hist.appendChild(el('span', 'dot'));
    hist.appendChild(document.createTextNode('내 신청 내역: '));
    hist.appendChild(el('b', null, '신청 완료'));
    const dateStr = formatDate(c.applied_at);
    if (dateStr) hist.appendChild(document.createTextNode(` (${dateStr})`));
    content.appendChild(hist);
  }

  card.appendChild(content);

  if (closed) {
    const stamp = el('div', 'stamp');
    stamp.appendChild(document.createTextNode('마감'));
    stamp.appendChild(el('br'));
    stamp.appendChild(document.createTextNode('되었습니다'));
    content.appendChild(stamp);
  }

  return card;
}

/* ---- 신청: apply_to_class({ p_class_id }) ---- */
async function applyToClass(classId, btn) {
  setMsg(msgClass, '');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '신청 중…';
  }
  try {
    const { data, error } = await sb.rpc('apply_to_class', { p_class_id: classId });
    if (error) {
      setMsg(msgClass, '신청 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', 'error');
      await loadClasses();
      return;
    }
    const res = first(data);
    if (res && res.error) {
      switch (res.error) {
        case 'full': setMsg(msgClass, '아쉽지만 정원이 모두 찼어요.', 'error'); break;
        case 'duplicate': setMsg(msgClass, '이미 신청하셨어요.', 'info'); break;
        case 'auth_required': setMsg(msgClass, '로그인이 필요해요. 다시 로그인해 주세요.', 'error'); break;
        default: setMsg(msgClass, '신청 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', 'error');
      }
    } else {
      setMsg(msgClass, '신청이 완료됐어요.', 'info');
    }
    await loadClasses();
  } catch (err) {
    setMsg(msgClass, friendlyError(err, 'apply'), 'error');
    await loadClasses();
  }
}

/* =========================================================================
   관리자용 클래스 카드 (수정/삭제/신청자 보기)
   ========================================================================= */
function adminClassCard(c) {
  const closed = !!c.closed;
  const card = el('section', 'card grid-card admin ' + (closed ? 'closed' : 'loggedin'));
  card.appendChild(spineEl());
  const content = el('div', 'content');

  content.appendChild(el('span', 'tag', `클래스 #${c.id}`));
  content.appendChild(el('h1', null, c.title || '원데이 클래스'));
  if (c.subtitle) content.appendChild(el('p', 'subline', c.subtitle));
  content.appendChild(metaEl(c));
  content.appendChild(seatsEl(c));

  /* 관리 액션 */
  const actions = el('div', 'admin-actions');
  const btnEdit = el('button', 'chip-btn', '수정');
  btnEdit.type = 'button';
  btnEdit.addEventListener('click', () => startEdit(c));

  const btnDelete = el('button', 'chip-btn danger', '삭제');
  btnDelete.type = 'button';
  btnDelete.addEventListener('click', () => deleteClass(c));

  const btnSignups = el('button', 'chip-btn', '신청자 보기');
  btnSignups.type = 'button';
  actions.appendChild(btnEdit);
  actions.appendChild(btnSignups);
  actions.appendChild(btnDelete);
  content.appendChild(actions);

  /* 신청자 명단 컨테이너 (토글) */
  const signupsBox = el('div', 'signups');
  signupsBox.hidden = true;
  content.appendChild(signupsBox);
  btnSignups.addEventListener('click', () => toggleSignups(c, signupsBox, btnSignups));

  card.appendChild(content);

  if (closed) {
    const stamp = el('div', 'stamp');
    stamp.appendChild(document.createTextNode('마감'));
    stamp.appendChild(el('br'));
    stamp.appendChild(document.createTextNode('되었습니다'));
    content.appendChild(stamp);
  }

  return card;
}

/* ---- 신청자 명단: admin_list_signups({ p_class_id }) ---- */
async function toggleSignups(c, box, btn) {
  if (!box.hidden) {
    box.hidden = true;
    box.innerHTML = '';
    btn.textContent = '신청자 보기';
    return;
  }
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = '불러오는 중…';
  try {
    const { data, error } = await sb.rpc('admin_list_signups', { p_class_id: c.id });
    box.innerHTML = '';
    if (error) {
      box.appendChild(el('p', 'signups-note error-text', '명단을 불러오지 못했어요.'));
      box.hidden = false;
      return;
    }
    const res = first(data);
    if (res && res.error === 'forbidden') {
      box.appendChild(el('p', 'signups-note error-text', '권한이 없어요.'));
      box.hidden = false;
      return;
    }
    const list = asArray(data).filter((r) => r && r.email);
    const head = el('p', 'signups-note', `신청자 ${list.length}명`);
    box.appendChild(head);
    if (list.length === 0) {
      box.appendChild(el('p', 'signups-note', '아직 신청자가 없어요.'));
    } else {
      const ul = el('ul', 'signups-list');
      list.forEach((r) => {
        const li = el('li');
        li.appendChild(el('span', 'sg-email', r.email));
        const when = formatDateTime(r.applied_at);
        if (when) li.appendChild(el('span', 'sg-when', when));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    box.hidden = false;
    btn.textContent = '접기';
  } catch (err) {
    box.innerHTML = '';
    box.appendChild(el('p', 'signups-note error-text', friendlyError(err, 'signups')));
    box.hidden = false;
    btn.textContent = prev;
  } finally {
    btn.disabled = false;
  }
}

/* =========================================================================
   관리자 폼 (추가 / 수정)
   ========================================================================= */
const adminForm = $('form-admin-class');
const msgAdmin = $('msg-admin');
const btnAdminSubmit = $('btn-admin-submit');
const btnAdminCancel = $('btn-admin-cancel');

function resetAdminForm() {
  $('admin-id').value = '';
  $('admin-title').value = '';
  $('admin-subtitle').value = '';
  $('admin-when').value = '';
  $('admin-place').value = '';
  $('admin-instructor').value = '';
  $('admin-capacity').value = '10';
  $('admin-form-tag').textContent = '새 클래스 추가';
  $('admin-form-title').textContent = '클래스 추가';
  btnAdminSubmit.textContent = '추가하기';
  btnAdminCancel.hidden = true;
  setMsg(msgAdmin, '');
}

function startEdit(c) {
  $('admin-id').value = String(c.id);
  $('admin-title').value = c.title || '';
  $('admin-subtitle').value = c.subtitle || '';
  $('admin-when').value = c.when_text || '';
  $('admin-place').value = c.place_text || '';
  $('admin-instructor').value = c.instructor_text || '';
  $('admin-capacity').value = String(c.capacity != null ? c.capacity : 10);
  $('admin-form-tag').textContent = `클래스 #${c.id} 수정`;
  $('admin-form-title').textContent = '클래스 수정';
  btnAdminSubmit.textContent = '저장하기';
  btnAdminCancel.hidden = false;
  setMsg(msgAdmin, '');
  // 관리자 탭으로 전환하고 폼으로 스크롤
  switchTab('admin');
  document.querySelector('.admin-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

btnAdminCancel.addEventListener('click', resetAdminForm);

adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg(msgAdmin, '');

  const idRaw = $('admin-id').value.trim();
  const title = $('admin-title').value.trim();
  const subtitle = $('admin-subtitle').value.trim();
  const when = $('admin-when').value.trim();
  const place = $('admin-place').value.trim();
  const instructor = $('admin-instructor').value.trim();
  const capacity = parseInt($('admin-capacity').value, 10);

  if (!title) {
    setMsg(msgAdmin, '제목을 입력해 주세요.', 'error');
    return;
  }
  if (!Number.isFinite(capacity) || capacity < 1) {
    setMsg(msgAdmin, '정원은 1명 이상 숫자로 입력해 주세요.', 'error');
    return;
  }

  const isEdit = idRaw !== '';
  btnAdminSubmit.disabled = true;
  const prev = btnAdminSubmit.textContent;
  btnAdminSubmit.textContent = isEdit ? '저장 중…' : '추가 중…';

  try {
    let resp;
    if (isEdit) {
      resp = await sb.rpc('admin_update_class', {
        p_id: parseInt(idRaw, 10),
        p_title: title,
        p_subtitle: subtitle,
        p_when: when,
        p_place: place,
        p_instructor: instructor,
        p_capacity: capacity,
      });
    } else {
      resp = await sb.rpc('admin_create_class', {
        p_title: title,
        p_subtitle: subtitle,
        p_when: when,
        p_place: place,
        p_instructor: instructor,
        p_capacity: capacity,
      });
    }
    const { data, error } = resp;
    if (error) {
      setMsg(msgAdmin, isEdit ? '수정 중 문제가 생겼어요.' : '추가 중 문제가 생겼어요.', 'error');
      return;
    }
    const res = first(data);
    if (res && res.error === 'forbidden') {
      setMsg(msgAdmin, '관리자 권한이 필요해요.', 'error');
      return;
    }
    setMsg(msgAdmin, isEdit ? '수정했어요.' : '새 클래스를 추가했어요.', 'info');
    resetAdminForm();
    await loadClasses();
  } catch (err) {
    setMsg(msgAdmin, friendlyError(err, 'admin'), 'error');
  } finally {
    btnAdminSubmit.disabled = false;
    btnAdminSubmit.textContent = prev;
  }
});

/* ---- 삭제: admin_delete_class({ p_id }) ---- */
async function deleteClass(c) {
  const ok = window.confirm(`"${c.title || '이 클래스'}"를 삭제할까요? 되돌릴 수 없어요.`);
  if (!ok) return;
  setMsg(msgAdminList, '');
  try {
    const { data, error } = await sb.rpc('admin_delete_class', { p_id: c.id });
    if (error) {
      setMsg(msgAdminList, '삭제 중 문제가 생겼어요.', 'error');
      return;
    }
    const res = first(data);
    if (res && res.error === 'forbidden') {
      setMsg(msgAdminList, '관리자 권한이 필요해요.', 'error');
      return;
    }
    setMsg(msgAdminList, '삭제했어요.', 'info');
    // 수정 중이던 항목이면 폼 초기화
    if ($('admin-id').value === String(c.id)) resetAdminForm();
    await loadClasses();
  } catch (err) {
    setMsg(msgAdminList, friendlyError(err, 'delete'), 'error');
  }
}

/* =========================================================================
   목록 로드 + 렌더 (사용자 그리드 + 관리자 그리드 + 요약)
   ========================================================================= */
function renderSummary(classes) {
  const applied = classes.filter((c) => c && c.applied);
  summaryChips.innerHTML = '';
  if (applied.length === 0) {
    summaryWrap.hidden = true;
    return;
  }
  applied.forEach((c) => {
    const chip = el('span', 'chip');
    chip.appendChild(el('b', null, c.title || '클래스'));
    const dateStr = formatDate(c.applied_at);
    if (dateStr) chip.appendChild(document.createTextNode(` · ${dateStr}`));
    summaryChips.appendChild(chip);
  });
  summaryWrap.hidden = false;
}

function renderGrids() {
  const classes = appState.classes;

  // 사용자 그리드
  classesGrid.innerHTML = '';
  if (classes.length === 0) {
    classesEmpty.hidden = false;
  } else {
    classesEmpty.hidden = true;
    classes.forEach((c) => classesGrid.appendChild(userClassCard(c)));
  }

  // 관리자 그리드
  if (appState.isAdmin) {
    adminGrid.innerHTML = '';
    if (classes.length === 0) {
      adminEmpty.hidden = false;
    } else {
      adminEmpty.hidden = true;
      classes.forEach((c) => adminGrid.appendChild(adminClassCard(c)));
    }
  }

  renderSummary(classes);
}

async function loadClasses() {
  try {
    const { data, error } = await sb.rpc('list_classes_state');
    if (error) {
      setMsg(msgClass, '클래스 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
      appState.classes = [];
      renderGrids();
      return;
    }
    // id 오름차순 정렬로 안정적인 순서 보장
    appState.classes = asArray(data)
      .filter((c) => c && c.id != null)
      .sort((a, b) => Number(a.id) - Number(b.id));
    renderGrids();
  } catch (err) {
    setMsg(msgClass, friendlyError(err, 'class'), 'error');
    appState.classes = [];
    renderGrids();
  }
}

/* ---- 관리자 여부 확인: is_admin() → boolean ---- */
async function checkAdmin() {
  try {
    const { data, error } = await sb.rpc('is_admin');
    if (error) return false;
    // boolean 또는 { is_admin: true } / [true] 형태 모두 대응
    if (typeof data === 'boolean') return data;
    const v = first(data);
    if (typeof v === 'boolean') return v;
    if (v && typeof v === 'object') return !!(v.is_admin || v.admin || v.result);
    return !!v;
  } catch (_) {
    return false;
  }
}

/* =========================================================================
   탭 전환
   ========================================================================= */
const tabClasses = $('tab-classes');
const tabAdmin = $('tab-admin');
const panelClasses = $('panel-classes');
const panelAdmin = $('panel-admin');

function switchTab(name) {
  const admin = name === 'admin' && appState.isAdmin;
  panelClasses.hidden = admin;
  panelAdmin.hidden = !admin;
  tabClasses.classList.toggle('is-active', !admin);
  tabAdmin.classList.toggle('is-active', admin);
}

tabClasses.addEventListener('click', () => switchTab('classes'));
tabAdmin.addEventListener('click', () => switchTab('admin'));

/* =========================================================================
   로그아웃
   ========================================================================= */
$('btn-logout').addEventListener('click', async () => {
  const btn = $('btn-logout');
  btn.disabled = true;
  try {
    await sb.auth.signOut();
  } catch (err) {
    console.warn('signOut 처리 중 문제:', err && err.message);
  } finally {
    btn.disabled = false;
  }
});

/* =========================================================================
   세션 라우팅
   ========================================================================= */
async function enterApp(user) {
  $('user-name').textContent = displayName(user);
  showView('class');

  // 관리자 여부 → 탭 노출
  appState.isAdmin = await checkAdmin();
  tabAdmin.hidden = !appState.isAdmin;
  if (!appState.isAdmin) {
    // 관리자 아님: 항상 클래스 탭
    switchTab('classes');
  } else {
    switchTab('classes');
  }

  resetAdminForm();
  await loadClasses();
}

async function routeForSession(session) {
  if (session && session.user) {
    const changed = appState.userId !== session.user.id;
    appState.userId = session.user.id;
    if (changed) {
      await enterApp(session.user);
    } else {
      // 같은 사용자: 이름만 최신화, 화면 유지
      $('user-name').textContent = displayName(session.user);
      showView('class');
    }
  } else {
    appState.userId = null;
    appState.isAdmin = false;
    appState.classes = [];
    showLogin();
    showView('auth');
  }
}

async function init() {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) {
      showLogin();
      showView('auth');
    } else {
      await routeForSession(data.session);
    }
  } catch (err) {
    console.warn('세션 확인 중 문제:', err && err.message);
    showLogin();
    showView('auth');
  }

  sb.auth.onAuthStateChange((_event, session) => {
    routeForSession(session);
  });
}

init();
