(function () {
  'use strict';

  var PJAX_PATHS = ['/', '/blog.html', '/forum.html', '/admin.html', '/passwords.html', '/login.html', '/register.html', '/profile.html'];

  var ROUTER = {
    init: function () {
      var self = this;

      document.addEventListener('click', function (e) {
        var link = e.target.closest('a');
        if (!link) return;
        if (!link.closest('#mainNav')) return;
        if (link.hasAttribute('target')) return;
        if (link.hostname !== location.hostname) return;

        var href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('#')) return;
        if (PJAX_PATHS.indexOf(href) === -1) return;

        e.preventDefault();
        self.navigate(href);
      });

      window.addEventListener('popstate', function (e) {
        if (!e.state || !e.state.path) return;
        if (PJAX_PATHS.indexOf(e.state.path) === -1) {
          location.reload();
          return;
        }
        self.loadPage(e.state.path, true);
      });
    },

    navigate: function (path) {
      history.pushState({ path: path }, '', path);
      this.loadPage(path, false);
    },

    loadPage: function (path, isPop) {
      var self = this;
      var main = document.querySelector('main');
      if (!main) { if (!isPop) location.href = path; return; }

      if (!isPop) {
        main.innerHTML = '<div class="loading" style="min-height:200px;display:flex;align-items:center;justify-content:center"><div class="spinner"></div></div>';
      }

      fetch(path)
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var newMain = doc.querySelector('main');
          if (!newMain) { if (!isPop) location.href = path; return; }

          main.outerHTML = newMain.outerHTML;
          document.title = doc.title;
          self.runPageInit(path);
          self.updateNav(path);
        })
        .catch(function () {
          if (!isPop) location.href = path;
        });
    },

    runPageInit: function (path) {
      if (path === '/' || path === '/index.html') {
        if (window.HOMEPAGE) HOMEPAGE.init();
        return;
      }
      var pageConf = this._pageConfig(path);
      if (!pageConf) return;
      if (window[pageConf.global]) {
        window[pageConf.global].init();
      } else {
        this._loadScript(pageConf.js, pageConf.global);
      }
    },

    _pageConfig: function (path) {
      var map = {
        '/blog.html': { global: 'BLOG', js: '/js/blog.js' },
        '/forum.html': { global: 'FORUM', js: '/js/forum.js' },
        '/admin.html': { global: 'ADMIN', js: '/js/admin.js' },
        '/passwords.html': { global: 'PASSWORDS', js: '/js/passwords.js' },
      };
      return map[path] || null;
    },

    _loadScript: function (src, globalName) {
      var self = this;
      var script = document.createElement('script');
      script.src = src;
      script.onload = function () {
        if (window[globalName]) window[globalName].init();
      };
      document.head.appendChild(script);
    },

    updateNav: function (path) {
      var tabs = document.querySelectorAll('#mainNav .nav-tab');
      for (var i = 0; i < tabs.length; i++) {
        var a = tabs[i];
        if (a.getAttribute('href') === path) {
          a.classList.add('active');
        } else {
          a.classList.remove('active');
        }
      }
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    ROUTER.init();
  });

})();
