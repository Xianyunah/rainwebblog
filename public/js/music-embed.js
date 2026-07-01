(function () {
  'use strict';

  class MusicEmbed {
    constructor() {
      this.container = null;
      this.timer = null;
      this.idleTimeout = 10000;
      this.autoHide = false;
      this.position = 'right';
      this.embedCode = '';
    }

    init() {
      var s = NAV.siteSettings;
      if (!s || Object.keys(s).length === 0) {
        var self = this;
        setTimeout(function () { self.init(); }, 50);
        return;
      }

      var enabled = s.music_embed_enabled === '1';
      if (!enabled) return;

      this.embedCode = s.music_embed_code || '';
      if (!this.embedCode) return;

      this.position = s.music_embed_position || 'right';
      this.autoHide = s.music_embed_autohide === '1';
      this.idleTimeout = (parseInt(s.music_embed_idle_timeout) || 10) * 1000;

      this._render();
      this._bindEvents();
      if (this.autoHide) this._startIdleTimer();
    }

    _render() {
      var container = document.getElementById('musicEmbed');
      if (!container) return;
      container.className = 'music-embed ' + this.position + ' expanded';
      container.innerHTML =
        '<div class="music-embed-player">' + this.embedCode + '</div>' +
        '<div class="music-embed-icon" style="display:none">' +
          '<span class="material-icons">music_note</span>' +
        '</div>';
      this.container = container;
    }

    _bindEvents() {
      var self = this;

      this._onEnter = function () {
        clearTimeout(self.timer);
        self._expand();
      };
      this._onLeave = function () {
        if (!self.autoHide) return;
        clearTimeout(self.timer);
        self.timer = setTimeout(function () { self._collapse(); }, self.idleTimeout);
      };

      this.container.addEventListener('mouseenter', this._onEnter);
      this.container.addEventListener('mouseleave', this._onLeave);

      var icon = this.container.querySelector('.music-embed-icon');
      if (icon) {
        icon.addEventListener('click', function () {
          clearTimeout(self.timer);
          self._expand();
          // Re-start leave timer after expanding via click
          if (self.autoHide) {
            self.timer = setTimeout(function () { self._collapse(); }, self.idleTimeout);
          }
        });
      }

      // Also re-expand if mouse re-enters after icon click
      this.container.addEventListener('mouseenter', function () {
        clearTimeout(self.timer);
        self._expand();
      });
    }

    _startIdleTimer() {
      // Start the initial collapse timer
      var self = this;
      this.timer = setTimeout(function () { self._collapse(); }, this.idleTimeout);
    }

    _collapse() {
      if (!this.container) return;
      this.container.classList.remove('expanded');
      this.container.classList.add('collapsed');
      var player = this.container.querySelector('.music-embed-player');
      var icon = this.container.querySelector('.music-embed-icon');
      if (player) player.style.display = 'none';
      if (icon) icon.style.display = 'flex';
    }

    _expand() {
      if (!this.container) return;
      this.container.classList.remove('collapsed');
      this.container.classList.add('expanded');
      var player = this.container.querySelector('.music-embed-player');
      var icon = this.container.querySelector('.music-embed-icon');
      if (player) player.style.display = '';
      if (icon) icon.style.display = 'none';
    }

    destroy() {
      clearTimeout(this.timer);
      if (this.container) {
        this.container.removeEventListener('mouseenter', this._onEnter);
        this.container.removeEventListener('mouseleave', this._onLeave);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var inst = new MusicEmbed();
    inst.init();
  });

})();
