const SHELL_CACHE = "minha-liturgia-shell-v2";
const RUNTIME_CACHE = "minha-liturgia-runtime-v2";
const OFFLINE_FALLBACK_URL = "/offline.html";

const SHELL_ROUTES = [
  "/",
  "/biblia",
  "/biblioteca",
  "/calendario",
  "/entrar",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/reenviar-verificacao",
  "/verificar-email",
  OFFLINE_FALLBACK_URL,
];

const PRIVATE_NAVIGATION_PREFIXES = ["/inicio", "/diario", "/minha-devocao", "/conta"];
const SENSITIVE_PUBLIC_PREFIXES = ["/biblioteca/novo", "/biblioteca/upload"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ROUTES)).catch(() => {
      // ignore precache failures and continue with runtime caching
    }),
  );
});

function isPrivateNavigationPath(pathname) {
  return [...PRIVATE_NAVIGATION_PREFIXES, ...SENSITIVE_PUBLIC_PREFIXES].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function canStoreNavigationResponse(response) {
  if (!response || !response.ok || response.type !== "basic") {
    return false;
  }

  const cacheControl = response.headers.get("cache-control")?.toLowerCase() || "";

  if (
    cacheControl.includes("no-store") ||
    cacheControl.includes("private") ||
    cacheControl.includes("no-cache")
  ) {
    return false;
  }

  if (response.headers.has("set-cookie")) {
    return false;
  }

  return true;
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== SHELL_CACHE && cacheName !== RUNTIME_CACHE)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableGetRequest(request, url) {
  if (request.method !== "GET") {
    return false;
  }

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth")) {
    return false;
  }

  if (url.pathname.startsWith("/_next/webpack-hmr")) {
    return false;
  }

  return true;
}

async function networkFirstForNavigation(request, url) {
  const isPrivatePath = isPrivateNavigationPath(url.pathname);
  const runtimeCache = await caches.open(RUNTIME_CACHE);

  try {
    const networkResponse = await fetch(request);

    if (!isPrivatePath && canStoreNavigationResponse(networkResponse)) {
      runtimeCache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    if (isPrivatePath) {
      const shellCache = await caches.open(SHELL_CACHE);
      return shellCache.match(OFFLINE_FALLBACK_URL);
    }

    const cachedResponse = await runtimeCache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const shellCache = await caches.open(SHELL_CACHE);
    return shellCache.match(OFFLINE_FALLBACK_URL);
  }
}

async function staleWhileRevalidate(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await runtimeCache.match(request);

  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        runtimeCache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  return cachedResponse || networkFetch;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (!isCacheableGetRequest(request, url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstForNavigation(request, url));
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Minha Liturgia",
    body: "Você tem um lembrete novo.",
    url: "/calendario",
    tag: "calendar-reminder",
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // ignore malformed payload
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/android-chrome-192x192.png",
      badge: "/android-chrome-192x192.png",
      tag: payload.tag,
      data: { url: payload.url || "/calendario" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/calendario";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
