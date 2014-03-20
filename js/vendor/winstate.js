'use strict';
/**
 * Cross-platform window state preservation.
 * Yes this code is quite complicated, but this is the best I came up with for
 * current state of node-webkit Window API (v0.7.3 and later).
 *
 * Known issues:
 * - unmaximization not always sets the window (x, y) in the lastly used coordinates
 * - unmaximization animation sometimes looks wierd
 * - extra height added to window, at least in linux x64 gnome-shell env. It seems that
 *   when we read height then it returns it with window frame, but if we resize window
 *   then it applies dimensions only to internal document without external frame.
 *   Need to test in other environments with different visual themes.
 *
 * Change log:
 * 2013.12.01
 * - workaround of extra height in gnome-shell added
 */

(function() {
  var gui = require('nw.gui'),
      win = gui.Window.get(),
      winState,
      currWinMode,
      resizeTimeout,
      isMaximizationEvent = false,
      // extra height added in linux x64 gnome-shell env, use it as workaround
      deltaHeight = false;

  window.windowState = {
    init: function() {
      winState = JSON.parse(localStorage.windowState || 'null');

      if (winState) {
        currWinMode = winState.mode;

        if (currWinMode === 'maximized') {
          win.maximize();
        } else {
          this.restore();
        }
      } else {
        currWinMode = 'normal';
        deltaHeight = 0;
        this.dump();
      }

      win.show();
    },

    dump: function() {
      if (!winState) {
        winState = {};
      }

      // we don't want to save minimized state, only maximized or normal
      if (currWinMode === 'maximized' || currWinMode === 'fullscreen') {
        winState.mode = currWinMode;
      } else {
        winState.mode = 'normal';
      }

      // when window is maximized you want to preserve normal
      // window dimensions to restore them later (even between sessions)
      if (currWinMode === 'normal') {
        winState.x = win.x;
        winState.y = win.y;
        winState.width = win.width;
        winState.height = win.height;

        // save delta only of it is not zero
        if (deltaHeight !== 0 &&
            currWinMode !== 'maximized' &&
              currWinMode !== 'fullscreen') {
          winState.deltaHeight = deltaHeight;
        }
      }
    },

    restore: function() {
      // deltaHeight already saved, so just restore it and adjust window height
      if (typeof winState.deltaHeight !== 'undefined') {
        deltaHeight = winState.deltaHeight;
        winState.height = winState.height - deltaHeight;
      }

      win.resizeTo(winState.width, winState.height);
      win.moveTo(winState.x, winState.y);

      if (winState.mode === 'fullscreen') {
        win.enterFullscreen();
      }
    },

    save: function() {
      this.dump();
      localStorage.windowState = JSON.stringify(winState);
    }
  }

  windowState.init();

  win.on('maximize', function() {
    isMaximizationEvent = true;
    currWinMode = 'maximized';
  });

  win.on('unmaximize', function() {
    currWinMode = 'normal';
    windowState.restore();
  });

  win.on('minimize', function() {
    currWinMode = 'minimized';
  });

  win.on('restore', function() {
    currWinMode = 'normal';
  });

  win.on('enter-fullscreen', function() {
    currWinMode = 'fullscreen';
  });

  win.on('leave-fullscreen', function() {
    currWinMode = 'normal';
  });

  win.window.addEventListener('resize', function() {
    // resize event is fired many times on one resize action,
    // this hack with setTiemout forces it to fire only once
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {

      // on MacOS you can resize maximized window, so it's no longer maximized
      if (isMaximizationEvent) {
        // first resize after maximization event should be ignored
        isMaximizationEvent = false;
      } else {
        if (currWinMode === 'maximized') {
          currWinMode = 'normal';
        }
      }

      // there is no deltaHeight yet, calculate it and adjust window size
      if (deltaHeight === false) {
        deltaHeight = win.height - winState.height;

        // set correct size
        if (deltaHeight !== 0) {
          win.resizeTo(winState.width, win.height - deltaHeight);
        }
      }

      windowState.dump();
    }, 500);
  }, false);
})();
