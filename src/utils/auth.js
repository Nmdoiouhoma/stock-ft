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
    return JSON.parse(atob(token.split('.')[1]));
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

  const res = await fetch(input, Object.assign({}, init, { headers }));
  return res;
}
