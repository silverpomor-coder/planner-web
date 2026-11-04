'use strict';
// Migration cleanup only. Private data is never stored in a service-worker cache.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('travel-book-rome-'))await caches.delete(name);await self.registration.unregister();})()));
