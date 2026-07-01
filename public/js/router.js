(function () {
  'use strict';

  var PJAX_PATHS = ['/', '/blog.html', '/forum.html', '/admin.html'];

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
      } else if (path === '/blog.html') {
        if (window.BLOG) BLOG.init();
      } else if (path === '/forum.html') {
        if (window.FORUM) FORUM.init();
      } else if (path === '/admin.html') {
        if (window.ADMIN) ADMIN.init();
      }
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
