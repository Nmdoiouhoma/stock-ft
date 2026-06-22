export const API_BASE = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE || '';

// Minimal auth helpers
export function setToken(token) {
  if (!token) return;
  localStorage.setItem('token', token);
}

export function getToken() {
  return localStorage.getItem('token');
}

export function clearToken() {
  localStorage.removeItem('token');
}

export function decodeToken(token) {
  try {
    const raw = String(token || '');
    const payload = JSON.parse(atob(raw.split('.')[1] || ''));

    // Normalize roles into an array of short lowercase names (e.g. 'admin', 'worker')
    // Accepts roles as array or comma-separated string and strips optional 'ROLE_' prefix.
    if (payload && payload.roles) {
      let roles = payload.roles;
      if (!Array.isArray(roles)) {
        roles = String(roles || '').split(',').map(s => s.trim()).filter(Boolean);
      }
      roles = roles.map(r => String(r || '')
        .replace(/^ROLE_/i, '')
        .trim()
        .toLowerCase()
      ).filter(Boolean);
      payload.roles = Array.from(new Set(roles));
    }

    return payload;
  } catch {
    return null;
  }
}

// Wrapper around fetch that adds Authorization header when token is available.
export async function authFetch(input, init = {}) {
  const token = getToken();
  const headers = Object.assign({}, init.headers || {}, {
    'Content-Type': 'application/json',
  });

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const url = typeof input === 'string' && input.startsWith('/') ? API_BASE + input : input;
  const res = await fetch(url, Object.assign({}, init, { headers }));

  // If backend returns unauthorized, clear token and redirect to login page.
  // This lets the top-level App (which shows the Login when no user/token)
  // take over and display the login screen.
  if (res.status === 401) {
    try {
      clearToken();
    } catch (e) {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }

  return res;
}
