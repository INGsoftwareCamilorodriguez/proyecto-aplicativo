const API_BASE_URL = "http://localhost:8080/api";

// Todos los fetch al API (excepto /auth/) llevan el id y el token de la sesión.
// El backend los usa para saber quién es el dueño de los datos.
(function () {
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = function (url, options) {
    const u = typeof url === 'string' ? url : (url && url.url) || '';
    const esApi = u.startsWith(API_BASE_URL) && !u.startsWith(API_BASE_URL + '/auth/');
    const userId = sessionStorage.getItem('userId');
    const token = sessionStorage.getItem('token');
    if (esApi && userId && token) {
      options = options || {};
      const headers = new Headers(options.headers || {});
      headers.set('X-User-Id', userId);
      headers.set('X-Token', token);
      options.headers = headers;
    }
    return fetchOriginal(url, options);
  };
})();