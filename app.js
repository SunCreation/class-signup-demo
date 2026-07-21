/* ==========================================================================
   원데이 클래스 신청 - 순수 정적 프론트엔드 (Supabase 직결)
   빌드 도구 없음 · CDN UMD(@supabase/supabase-js@2)만 사용
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

function setMsg(el, text, kind) {
  if (!text) {
    el.hidden = true;
    el.textContent = '';
    el.classList.remove('error', 'info');
    return;
  }
  el.hidden = false;
  el.textContent = text;
  el.classList.remove('error', 'info');
  el.classList.add(kind === 'info' ? 'info' : 'error');
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

/* ---- 날짜 포맷 (applied_at → YYYY-MM-DD) ---- */
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/* =========================================================================
   인증 화면 (로그인 / 회원가입 탭 전환)
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
// 링크 역할 <a>의 키보드 접근성
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
    // 성공 시 onAuthStateChange가 화면을 전환.
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
    // 이메일 확인이 꺼져 있으면 session이 즉시 생김 → onAuthStateChange가 전환.
    // session이 null이면 확인 메일 안내.
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
   클래스 신청 화면
   ========================================================================= */
const btnApply = $('btn-apply');
const btnLogout = $('btn-logout');
const msgClass = $('msg-class');
const historyEl = $('class-history');
const stampEl = $('class-stamp');
const classCard = $('class-card');

/* rpc 응답에서 상태 객체를 견고하게 추출 */
function extractState(data) {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;
  return data;
}

/* 남은자리 dots 렌더: 채움(filled ochre) / 빈칸(empty dashed) / 마감(full muted) */
function renderDots(container, capacity, signupCount, closed) {
  container.innerHTML = '';
  const cap = Number(capacity) || 0;
  const filled = Math.max(0, Math.min(cap, Number(signupCount) || 0));
  for (let i = 0; i < cap; i++) {
    const dot = document.createElement('i');
    if (closed) {
      dot.className = 'full';
    } else if (i < filled) {
      dot.className = 'filled';
    } else {
      dot.className = 'empty';
    }
    container.appendChild(dot);
  }
  const remaining = Math.max(0, cap - filled);
  container.setAttribute('aria-label', `정원 ${cap}명 중 ${filled}명 신청 완료, 남은 자리 ${remaining}명`);
}

/* 상태 객체로 신청 카드 전체 렌더 */
function renderClass(state) {
  if (!state) return;

  $('class-title').textContent = state.title || '원데이 클래스';
  $('class-subtitle').textContent = state.subtitle || '';
  $('class-subtitle').hidden = !state.subtitle;
  $('class-when').textContent = state.when_text || '미정';
  $('class-place').textContent = state.place_text || '미정';
  $('class-instructor').textContent = state.instructor_text || '';

  const capacity = Number(state.capacity) || 0;
  const signupCount = Number(state.signup_count) || 0;
  const remaining = (state.remaining != null)
    ? Number(state.remaining)
    : Math.max(0, capacity - signupCount);
  const closed = !!state.closed;
  const applied = !!state.applied;

  $('class-remaining').textContent = closed ? '0' : String(remaining);
  $('class-capacity').textContent = `/ ${capacity}`;

  renderDots($('class-dots'), capacity, closed ? capacity : signupCount, closed);

  // 카드 톤: 마감이면 closed 스타일 우선
  classCard.classList.toggle('closed', closed);
  classCard.classList.toggle('loggedin', !closed);
  $('class-tag').textContent = closed ? '마감' : 'STEP · 신청';

  // 마감 스탬프
  stampEl.hidden = !closed;

  // 신청 내역
  if (applied) {
    historyEl.hidden = false;
    $('history-status').textContent = '신청 완료';
    const dateStr = formatDate(state.applied_at);
    $('history-date').textContent = dateStr ? `(${dateStr})` : '';
  } else {
    historyEl.hidden = true;
  }

  // 버튼 상태
  if (applied) {
    btnApply.textContent = '신청 완료';
    btnApply.disabled = true;
    btnApply.classList.add('disabled');
  } else if (closed) {
    btnApply.textContent = '마감되었습니다';
    btnApply.disabled = true;
    btnApply.classList.add('disabled');
  } else {
    btnApply.textContent = '신청하기';
    btnApply.disabled = false;
    btnApply.classList.remove('disabled');
  }
}

/* 클래스 상태 로드: get_class_state (인자 없음, 기본 class_id=1) */
async function loadClassState() {
  setMsg(msgClass, '');
  try {
    const { data, error } = await sb.rpc('get_class_state');
    if (error) {
      setMsg(msgClass, '클래스 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
      return;
    }
    const state = extractState(data);
    if (!state) {
      setMsg(msgClass, '아직 열린 클래스가 없어요.', 'info');
      return;
    }
    renderClass(state);
  } catch (err) {
    setMsg(msgClass, friendlyError(err, 'class'), 'error');
  }
}

/* 신청: apply_to_class (인자 없음) */
btnApply.addEventListener('click', async () => {
  setMsg(msgClass, '');
  btnApply.disabled = true;
  const prev = btnApply.textContent;
  btnApply.textContent = '신청 중…';
  try {
    const { data, error } = await sb.rpc('apply_to_class');
    if (error) {
      setMsg(msgClass, '신청 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', 'error');
      btnApply.textContent = prev;
      btnApply.disabled = false;
      return;
    }
    const state = extractState(data);

    if (state && state.error) {
      switch (state.error) {
        case 'full':
          setMsg(msgClass, '아쉽지만 정원이 모두 찼어요.', 'error');
          break;
        case 'duplicate':
          setMsg(msgClass, '이미 신청하셨어요.', 'info');
          break;
        case 'auth_required':
          setMsg(msgClass, '로그인이 필요해요. 다시 로그인해 주세요.', 'error');
          break;
        default:
          setMsg(msgClass, '신청 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', 'error');
      }
      // 서버가 갱신된 상태를 함께 주면 반영
      if (state.capacity != null || state.title != null) {
        renderClass(state);
      } else {
        btnApply.textContent = prev;
        btnApply.disabled = false;
      }
      return;
    }

    // 성공: { ok:true, ...state }
    if (state) {
      renderClass(state);
      if (state.applied) {
        setMsg(msgClass, '신청이 완료됐어요.', 'info');
      }
    } else {
      // 상태를 안 돌려주면 재조회
      await loadClassState();
    }
  } catch (err) {
    setMsg(msgClass, friendlyError(err, 'apply'), 'error');
    btnApply.textContent = prev;
    btnApply.disabled = false;
  }
});

/* 로그아웃 */
btnLogout.addEventListener('click', async () => {
  btnLogout.disabled = true;
  try {
    await sb.auth.signOut();
    // onAuthStateChange가 로그인 화면으로 전환.
  } catch (err) {
    // 실패해도 로컬 세션 정리 시도
    console.warn('signOut 처리 중 문제:', err && err.message);
  } finally {
    btnLogout.disabled = false;
  }
});

/* =========================================================================
   세션에 따른 라우팅
   ========================================================================= */
let currentUserId = null;

async function routeForSession(session) {
  if (session && session.user) {
    const changed = currentUserId !== session.user.id;
    currentUserId = session.user.id;
    $('user-name').textContent = displayName(session.user);
    showView('class');
    // 사용자가 바뀌었거나 첫 진입일 때만 새로 로드
    if (changed) {
      await loadClassState();
    }
  } else {
    currentUserId = null;
    showLogin();
    showView('auth');
  }
}

async function init() {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) {
      // 세션 조회 실패 시 로그인 화면으로 폴백
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

  // 이후 상태 변화를 반영
  sb.auth.onAuthStateChange((_event, session) => {
    routeForSession(session);
  });
}

init();
