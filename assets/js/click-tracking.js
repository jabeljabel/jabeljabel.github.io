/*
 * Click tracking for Umami (adds events; does not change the existing analytics snippets).
 *
 * Events sent to Umami:
 *   "more-about-me"  when a visitor opens the "More about me" section
 *   "link-click"     when a visitor clicks any link (label, url, section, destination)
 *   "cover-click"    when a visitor clicks the rotating book cover (which book)
 *
 * Each event carries the visitor's country, region, city and network (org), taken from
 * the "geolocation" event that the existing ipinfo snippet already sends to Umami.
 * Nothing extra is requested from ipinfo: this script only remembers that result.
 */
(function () {
    var GEO_KEY = 'jea-geo';

    function readGeo() {
        try { return JSON.parse(sessionStorage.getItem(GEO_KEY)) || {}; } catch (e) { return {}; }
    }

    // Remember the geolocation payload the existing ipinfo snippet sends, for later events.
    function watchUmami() {
        if (!window.umami || typeof window.umami.track !== 'function' || window.umami.__jeaWrapped) return false;
        var original = window.umami.track;
        window.umami.track = function (name, data) {
            if (name === 'geolocation' && data && typeof data === 'object') {
                try { sessionStorage.setItem(GEO_KEY, JSON.stringify(data)); } catch (e) {}
            }
            return original.apply(this, arguments);
        };
        window.umami.__jeaWrapped = true;
        return true;
    }
    if (!watchUmami()) {
        var tries = 0, timer = setInterval(function () {
            if (watchUmami() || ++tries > 100) clearInterval(timer);
        }, 100);
    }

    function send(name, data) {
        if (!window.umami || typeof window.umami.track !== 'function') return;
        var geo = readGeo(), payload = {};
        ['country', 'region', 'city', 'org'].forEach(function (k) { payload[k] = geo[k] || ''; });
        for (var k in data) payload[k] = String(data[k] == null ? '' : data[k]).slice(0, 400);
        payload.page = location.pathname;
        try { window.umami.track(name, payload); } catch (e) {}
    }

    function sectionOf(el) {
        if (el.closest('nav')) return 'nav';
        var s = el.closest('section[id]');
        if (s) return s.id;
        if (el.closest('.hero, header')) return 'hero';
        if (el.closest('footer')) return 'footer';
        return 'other';
    }

    // "More about me" opened
    document.querySelectorAll('details.more-about').forEach(function (d) {
        d.addEventListener('toggle', function () {
            if (d.open) send('more-about-me', { section: 'about' });
        });
    });

    // Link clicks (capture phase, so the event is queued before the page changes)
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        if (a.closest('.statcounter, noscript')) return;
        if (a.classList.contains('hero-cover')) {
            var img = a.querySelector('img');
            send('cover-click', { book: img ? img.alt.replace(/^Cover of /, '') : '' });
            return;
        }
        var href = a.getAttribute('href');
        if (href.charAt(0) === '#') {
            if (sectionOf(a) === 'nav') send('link-click', { label: a.textContent.trim(), url: href, section: 'nav', destination: 'same page' });
            return;
        }
        var url = a.href, external = a.hostname && a.hostname !== location.hostname;
        send('link-click', {
            label: (a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 120),
            url: url,
            section: sectionOf(a),
            destination: url.indexOf('mailto:') === 0 ? 'email' : (external ? 'external' : 'internal')
        });
    }, true);
})();
