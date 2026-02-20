$(document).ready(function () {
  const pageSound = document.getElementById("pageSound");
  const songPlayer = document.getElementById("songPlayer");
  const ambientPlayer = document.getElementById("ambientPlayer");
  const $book = $("#book");

  let typingInterval = null;
  let fadeInterval = null;
  let ambientFadeInterval = null;
  let coverTease = false;

  const fadeStep = 0.02;
  const fadeDelay = 40;
  const bookRatio = 3 / 2;

  function getBookSize() {
    const maxWidth = 900;
    const maxHeight = 600;
    const horizontalPadding = 24;
    const verticalPadding = 24;

    const availableWidth = Math.max(window.innerWidth - horizontalPadding, 320);
    const availableHeight = Math.max(window.innerHeight - verticalPadding, 360);

    let width = Math.min(maxWidth, availableWidth);
    let height = Math.round(width / bookRatio);

    if (height > Math.min(maxHeight, availableHeight)) {
      height = Math.min(maxHeight, availableHeight);
      width = Math.round(height * bookRatio);
    }

    return { width, height };
  }

  function clearCoverTease() {
    if (!coverTease) return;

    coverTease = false;
    $(".front-cover").removeClass("cover-tease");

    if ($book.data("turn")) {
      $book.turn("peel", false);
    }
  }

  function setupBook() {
    const size = getBookSize();

    $book.css(size);

    $book.turn({
      width: size.width,
      height: size.height,
      autoCenter: true,
      gradients: true,
      acceleration: true,
      elevation: 0,
      duration: 1000,
      when: {
        turning: function () {
          clearCoverTease();
        },
      },
    });
  }

  function resizeBook() {
    const size = getBookSize();

    if ($book.data("turn")) {
      $book.turn("size", size.width, size.height);
    }
  }

  function fadeIn(audio, target) {
    clearInterval(fadeInterval);
    fadeInterval = setInterval(function () {
      if (audio.volume < target) {
        audio.volume = Math.min(audio.volume + fadeStep, target);
      } else {
        clearInterval(fadeInterval);
      }
    }, fadeDelay);
  }

  function fadeOut(audio, step, callback) {
    clearInterval(fadeInterval);
    fadeInterval = setInterval(function () {
      if (audio.volume > 0) {
        audio.volume = Math.max(audio.volume - step, 0);
      } else {
        clearInterval(fadeInterval);
        if (callback) callback();
      }
    }, fadeDelay);
  }

  function startAmbient() {
    if (!ambientPlayer) return;
    if (songPlayer && !songPlayer.paused) return;

    clearInterval(ambientFadeInterval);
    const targetVolume = 0.32;
    const startFrom = Math.min(ambientPlayer.volume || 0, targetVolume);
    ambientPlayer.volume = startFrom;

    const ambientResult = ambientPlayer.paused ? ambientPlayer.play() : null;
    if (ambientResult && typeof ambientResult.catch === "function") {
      ambientResult.then(function () {
        ambientFadeIn(targetVolume);
      }).catch(function () {});
    } else {
      ambientFadeIn(targetVolume);
    }
  }

  function stopAmbient(resetTime) {
    if (!ambientPlayer) return;
    if (ambientPlayer.paused || ambientPlayer.volume <= 0.001) {
      ambientPlayer.pause();
      if (resetTime) ambientPlayer.currentTime = 0;
      return;
    }

    ambientFadeOut(0.03, function () {
      ambientPlayer.pause();
      if (resetTime) ambientPlayer.currentTime = 0;
    });
  }

  function ensureAmbientIfIdle() {
    if (songPlayer && songPlayer.paused) {
      startAmbient();
    }
  }

  function ambientFadeIn(target) {
    clearInterval(ambientFadeInterval);
    ambientFadeInterval = setInterval(function () {
      if (ambientPlayer.volume < target) {
        ambientPlayer.volume = Math.min(ambientPlayer.volume + fadeStep, target);
      } else {
        clearInterval(ambientFadeInterval);
      }
    }, fadeDelay);
  }

  function ambientFadeOut(step, callback) {
    clearInterval(ambientFadeInterval);
    ambientFadeInterval = setInterval(function () {
      if (ambientPlayer.volume > 0) {
        ambientPlayer.volume = Math.max(ambientPlayer.volume - step, 0);
      } else {
        clearInterval(ambientFadeInterval);
        if (callback) callback();
      }
    }, fadeDelay);
  }

  function stopSong(callback, keepSilent) {
    clearInterval(fadeInterval);

    if (!songPlayer) {
      if (callback) callback();
      if (!keepSilent) ensureAmbientIfIdle();
      return;
    }

    if (!songPlayer.paused) {
      fadeOut(songPlayer, 0.05, function () {
        songPlayer.pause();
        songPlayer.currentTime = 0;
        if (callback) callback();
        if (!keepSilent) ensureAmbientIfIdle();
      });
    } else {
      songPlayer.pause();
      songPlayer.currentTime = 0;
      if (callback) callback();
      if (!keepSilent) ensureAmbientIfIdle();
    }
  }

  function typeText(element) {
    if (!element) return;

    const fullText = element.dataset.text || "";
    element.textContent = "";

    let i = 0;
    typingInterval = setInterval(function () {
      element.textContent += fullText[i] || "";
      i++;

      if (i >= fullText.length) {
        clearInterval(typingInterval);
      }
    }, 35);
  }

  function resetTyping() {
    clearInterval(typingInterval);
    $(".typewriter").text("");
  }

  function resetAllPolaroids() {
    $(".polaroid").removeClass("flipped");
    resetTyping();
    $(".memory-video").each(function () {
      this.pause();
    });
  }

  function playSong(song, startTime) {
    if (!songPlayer || !song) return;

    stopAmbient(false);
    songPlayer.src = song;
    songPlayer.volume = 0;

    songPlayer.addEventListener(
      "loadedmetadata",
      function () {
        const duration = isFinite(songPlayer.duration) ? songPlayer.duration : Infinity;
        songPlayer.currentTime = Math.min(startTime, Math.max(duration - 0.1, 0));

        const playResult = songPlayer.play();
        if (playResult && typeof playResult.then === "function") {
          playResult.then(function () {
            fadeIn(songPlayer, 1);
          }).catch(function () {});
        } else {
          fadeIn(songPlayer, 1);
        }
      },
      { once: true }
    );
  }

  function startSongAndType($polaroid, song, startTime) {
    playSong(song, startTime || 0);

    const textElement = $polaroid.find(".typewriter")[0];
    if (textElement) {
      typeText(textElement);
    }
  }

  setupBook();
  $(window).on("resize", resizeBook);

  $(document).one("click touchstart keydown", function () {
    ensureAmbientIfIdle();
  });

  if (songPlayer) {
    songPlayer.addEventListener("ended", function () {
      ensureAmbientIfIdle();
    });
  }

  $book.on("turning", function () {
    if (pageSound) {
      pageSound.pause();
      pageSound.currentTime = 0;
      const turnSoundResult = pageSound.play();
      if (turnSoundResult && typeof turnSoundResult.catch === "function") {
        turnSoundResult.catch(function () {});
      }
    }

    stopSong(null, false);
    resetAllPolaroids();
  });

  $book.on("mouseenter", ".front-cover", function () {
    if (!$book.data("turn") || $book.turn("page") !== 1 || coverTease) return;

    coverTease = true;
    $(".front-cover").addClass("cover-tease");
    $book.turn("peel", "br");
  });

  $book.on("mouseleave", ".front-cover", clearCoverTease);

  $(document).on("click", ".polaroid", function (e) {
    e.stopPropagation();

    const $this = $(this);
    const isFlipped = $this.hasClass("flipped");

    if (isFlipped) {
      $this.removeClass("flipped");
      stopSong(null, false);
      resetTyping();
      return;
    }

    $(".polaroid").removeClass("flipped");
    resetTyping();

    const song = $this.data("song");
    const startTime = parseFloat($this.data("start")) || 0;

    $this.addClass("flipped");

    stopSong(function () {
      setTimeout(function () {
        startSongAndType($this, song, startTime);
      }, 500);
    }, true);
  });

  $(document).on("click", ".video-card", function (e) {
    e.stopPropagation();

    const video = $(this).find(".memory-video")[0];
    if (!video) return;

    if (video.paused) {
      stopSong(null, true);
      stopAmbient(false);
      const playResult = video.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(function () {});
      }
    } else {
      video.pause();
      ensureAmbientIfIdle();
    }
  });

  $(document).on("ended", ".memory-video", function () {
    ensureAmbientIfIdle();
  });
});
