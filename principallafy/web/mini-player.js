
function getMiniPlayerResourceName() {
  if (typeof window.GetParentResourceName === "function") {
    return window.GetParentResourceName()
  }
  return "principal"
}

let miniPlayerVisible = false
let miniCurrentTrackData = null
let miniIsDJMode = false
let miniIsPlaying = false
let miniCurrentProgress = 0
let currentVideoId
let isPlaying
let isDJMode
let MiniPlayer

const miniPlayer = document.getElementById("mini-player")
const miniTitle = document.getElementById("mini-title")
const miniArtist = document.getElementById("mini-artist")
const miniArtwork = document.getElementById("mini-artwork-img")
const miniPlayPause = document.getElementById("mini-play-pause")
const miniPrev = document.getElementById("mini-prev")
const miniNext = document.getElementById("mini-next")
const miniProgressFill = document.getElementById("mini-progress-fill")

const MiniPlayerUI = {
  shouldShow: () => {
    return miniCurrentTrackData && miniIsPlaying && typeof currentVideoId !== "undefined" && currentVideoId
  },

  show: (trackData, djMode = false, playing = false) => {
    if (!trackData || !playing) {
      console.log("🔽 Mini player não mostrado - sem dados ou não tocando")
      return
    }

    console.log("🎵 Mostrando mini player:", trackData)

    miniCurrentTrackData = trackData
    miniIsDJMode = djMode
    miniIsPlaying = playing

    MiniPlayerUI.updateInfo(trackData)
    MiniPlayerUI.updatePlayState(playing)
    MiniPlayerUI.updateDJMode(djMode)

    miniPlayer.classList.add("entering")
    miniPlayer.classList.add("visible")

    document.body.classList.add("has-mini-player")

    setTimeout(() => {
      miniPlayer.classList.remove("entering")
    }, 400)

    miniPlayerVisible = true
  },

  hide: () => {
    if (!miniPlayerVisible) return

    console.log("🔽 Escondendo mini player")

    miniPlayer.classList.add("leaving")

    setTimeout(() => {
      miniPlayer.classList.remove("visible", "leaving")
      document.body.classList.remove("has-mini-player")
      miniPlayerVisible = false
      miniIsPlaying = false
    }, 300)
  },

  updateInfo: (trackData) => {
    if (!trackData) return

    miniTitle.textContent = trackData.title || "Música Desconhecida"
    miniArtist.textContent = trackData.artist || "Artista Desconhecido"

    if (trackData.thumbnail) {
      miniArtwork.src = trackData.thumbnail

      const img = new Image()
      img.onload = () => {
        miniArtwork.src = trackData.thumbnail
      }
      img.src = trackData.thumbnail
    }

    if (trackData.title && trackData.title.length > 25) {
      miniTitle.classList.add("marquee")
    } else {
      miniTitle.classList.remove("marquee")
    }

    miniCurrentTrackData = trackData
  },

  updatePlayState: (playing) => {
    miniIsPlaying = playing

    const playIcon = miniPlayPause.querySelector(".play-icon")
    const pauseIcon = miniPlayPause.querySelector(".pause-icon")

    if (playing) {
      playIcon.style.display = "none"
      pauseIcon.style.display = "block"
      miniPlayer.classList.add("playing")
    } else {
      playIcon.style.display = "block"
      pauseIcon.style.display = "none"
      miniPlayer.classList.remove("playing")

      setTimeout(() => {
        if (!miniIsPlaying) {
          MiniPlayerUI.hide()
        }
      }, 1000)
    }
  },

  updateDJMode: (isDJMode) => {
    miniIsDJMode = isDJMode

    if (isDJMode) {
      miniPlayer.classList.add("dj-mode")
    } else {
      miniPlayer.classList.remove("dj-mode")
    }
  },

  updateProgress: (progress) => {
    miniCurrentProgress = Math.max(0, Math.min(100, progress))
    miniProgressFill.style.width = `${miniCurrentProgress}%`
  },

  toggle: () => {
    if (miniPlayerVisible) {
      MiniPlayerUI.hide()
    } else if (MiniPlayerUI.shouldShow()) {
      MiniPlayerUI.show(miniCurrentTrackData, miniIsDJMode, miniIsPlaying)
    }
  },
}

if (miniPlayPause) {
  miniPlayPause.addEventListener("click", (e) => {
    e.stopPropagation()

    console.log("🎵 Mini player: Play/Pause clicado")

    fetch(`https://${getMiniPlayerResourceName()}/miniPlayerAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "playPause" }),
    }).catch(console.error)

    const newState = !miniIsPlaying
    MiniPlayerUI.updatePlayState(newState)

    if (!newState) {
      setTimeout(() => {
        if (!miniIsPlaying) {
          MiniPlayerUI.hide()
        }
      }, 1000)
    }
  })
}

if (miniPrev) {
  miniPrev.addEventListener("click", (e) => {
    e.stopPropagation()

    console.log("🎵 Mini player: Previous clicado")

    fetch(`https://${getMiniPlayerResourceName()}/miniPlayerAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "previous" }),
    }).catch(console.error)

    miniPrev.style.transform = "scale(0.9)"
    setTimeout(() => {
      miniPrev.style.transform = "scale(1)"
    }, 150)
  })
}

if (miniNext) {
  miniNext.addEventListener("click", (e) => {
    e.stopPropagation()

    console.log("🎵 Mini player: Next clicado")

    fetch(`https://${getMiniPlayerResourceName()}/miniPlayerAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "next" }),
    }).catch(console.error)

    miniNext.style.transform = "scale(0.9)"
    setTimeout(() => {
      miniNext.style.transform = "scale(1)"
    }, 150)
  })
}

if (miniPlayer) {
  miniPlayer.addEventListener("click", (e) => {
    if (e.target.closest(".mini-controls")) return

    console.log("🎵 Mini player: Abrindo UI principal")

    fetch(`https://${getMiniPlayerResourceName()}/openMainUI`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(console.error)

    miniPlayer.style.transform = "translateY(-2px) scale(0.98)"
    setTimeout(() => {
      miniPlayer.style.transform = ""
    }, 200)
  })
}

function handleMiniPlayerMessages(event) {
  if (!event.data || !event.data.type) return

  switch (event.data.type) {
    case "showMiniPlayer":
      console.log("📨 Recebido showMiniPlayer:", event.data)
      if (event.data.isPlaying) {
        MiniPlayerUI.show(event.data.trackData, event.data.djMode, event.data.isPlaying)
      }
      break

    case "hideMiniPlayer":
      console.log("📨 Recebido hideMiniPlayer")
      MiniPlayerUI.hide()
      break

    case "updateMiniPlayer":
      console.log("📨 Recebido updateMiniPlayer:", event.data)
      if (miniPlayerVisible) {
        MiniPlayerUI.updateInfo(event.data.trackData)
        MiniPlayerUI.updateDJMode(event.data.djMode)
      }
      break

    case "updateMiniPlayState":
      console.log("📨 Recebido updateMiniPlayState:", event.data.isPlaying)
      MiniPlayerUI.updatePlayState(event.data.isPlaying)

      if (!event.data.isPlaying) {
        setTimeout(() => {
          if (!miniIsPlaying) {
            MiniPlayerUI.hide()
          }
        }, 1000)
      }
      break

    case "updateMiniProgress":
      MiniPlayerUI.updateProgress(event.data.progress)
      break

    case "setMiniDJMode":
      console.log("📨 Recebido setMiniDJMode:", event.data.enabled)
      MiniPlayerUI.updateDJMode(event.data.enabled)
      break

    case "ui":
      if (event.data.status) {
        if (miniPlayerVisible) {
          MiniPlayerUI.hide()
        }
      } else {
        setTimeout(() => {
          if (
            typeof isPlaying !== "undefined" &&
            isPlaying &&
            typeof currentVideoId !== "undefined" &&
            currentVideoId
          ) {
            if (typeof MiniPlayer !== "undefined" && MiniPlayer.getCurrentTrackData) {
              const trackData = MiniPlayer.getCurrentTrackData()
              if (trackData) {
                const djMode = typeof isDJMode !== "undefined" ? isDJMode : false
                MiniPlayerUI.show(trackData, djMode, true)
              }
            }
          }
        }, 500)
      }
      break

    case "pausePlayback":
    case "forceStop":
      console.log("📨 Recebido comando de pause/stop")
      MiniPlayerUI.updatePlayState(false)
      setTimeout(() => {
        MiniPlayerUI.hide()
      }, 500)
      break

    case "resumePlayback":
      console.log("📨 Recebido comando de resume")
      MiniPlayerUI.updatePlayState(true)
      if (!miniPlayerVisible && miniCurrentTrackData) {
        MiniPlayerUI.show(miniCurrentTrackData, miniIsDJMode, true)
      }
      break
  }
}

window.addEventListener("message", handleMiniPlayerMessages)

document.addEventListener("DOMContentLoaded", () => {
  console.log("🎵 Mini Player JavaScript carregado!")

  if (!miniPlayer) {
    console.warn("⚠️ Elemento mini-player não encontrado")
    return
  }

  miniPlayerVisible = false
  MiniPlayerUI.updatePlayState(false)
  MiniPlayerUI.updateDJMode(false)

  const mainApp = document.getElementById("app")
  if (mainApp) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          const isMainUIVisible = mainApp.classList.contains("visible")

          if (!isMainUIVisible && !miniPlayerVisible) {
            setTimeout(() => {
              if (
                typeof isPlaying !== "undefined" &&
                isPlaying &&
                typeof currentVideoId !== "undefined" &&
                currentVideoId
              ) {
                if (typeof MiniPlayer !== "undefined" && MiniPlayer.getCurrentTrackData) {
                  const trackData = MiniPlayer.getCurrentTrackData()
                  if (trackData) {
                    const djMode = typeof isDJMode !== "undefined" ? isDJMode : false
                    MiniPlayerUI.show(trackData, djMode, true)
                  }
                }
              }
            }, 300)
          } else if (isMainUIVisible && miniPlayerVisible) {
            MiniPlayerUI.hide()
          }
        }
      })
    })

    observer.observe(mainApp, {
      attributes: true,
      attributeFilter: ["class"],
    })
  }

  setInterval(() => {
    if (typeof isPlaying !== "undefined" && typeof currentVideoId !== "undefined") {
      if (
        isPlaying &&
        currentVideoId &&
        !miniPlayerVisible &&
        !document.getElementById("app").classList.contains("visible")
      ) {
        if (typeof MiniPlayer !== "undefined" && MiniPlayer.getCurrentTrackData) {
          const trackData = MiniPlayer.getCurrentTrackData()
          if (trackData) {
            const djMode = typeof isDJMode !== "undefined" ? isDJMode : false
            MiniPlayerUI.show(trackData, djMode, true)
          }
        }
      } else if (!isPlaying && miniPlayerVisible) {
        MiniPlayerUI.hide()
      }

      if (miniPlayerVisible && miniIsPlaying !== isPlaying) {
        MiniPlayerUI.updatePlayState(isPlaying)
      }

      if (typeof isDJMode !== "undefined" && miniIsDJMode !== isDJMode) {
        MiniPlayerUI.updateDJMode(isDJMode)
      }

      if (
        isPlaying &&
        miniPlayerVisible &&
        typeof window.player !== "undefined" &&
        window.player &&
        window.player.getCurrentTime &&
        window.player.getDuration
      ) {
        try {
          const currentTime = window.player.getCurrentTime()
          const duration = window.player.getDuration()

          if (currentTime && duration) {
            const progress = (currentTime / duration) * 100
            MiniPlayerUI.updateProgress(progress)
          }
        } catch (error) {
        }
      }
    }
  }, 1000)

  console.log("🎵 Mini player controls inicializados")

  setupMiniPlayerControls()
})

function setupMiniPlayerControls() {
  const miniPlayPauseBtn = document.getElementById("mini-play-pause")
  if (miniPlayPauseBtn) {
    miniPlayPauseBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      console.log("🎵 Mini player play/pause clicado")

      if (typeof window.invokeNative === "function") {
        window.invokeNative("miniPlayerPlayPause", {})
      } else {
        if (typeof MiniPlayer !== "undefined") {
          MiniPlayer.togglePlayPause()
        }
      }
    })
  }

  const miniPreviousBtn = document.getElementById("mini-prev")
  if (miniPreviousBtn) {
    miniPreviousBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      console.log("🎵 Mini player anterior clicado")

      if (typeof window.invokeNative === "function") {
        window.invokeNative("miniPlayerPrevious", {})
      } else {
        if (typeof MiniPlayer !== "undefined") {
          MiniPlayer.previousTrack()
        }
      }
    })
  }

  const miniNextBtn = document.getElementById("mini-next")
  if (miniNextBtn) {
    miniNextBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      console.log("🎵 Mini player próximo clicado")

      if (typeof window.invokeNative === "function") {
        window.invokeNative("miniPlayerNext", {})
      } else {
        if (typeof MiniPlayer !== "undefined") {
          MiniPlayer.nextTrack()
        }
      }
    })
  }

  const miniPlayerElement = document.getElementById("mini-player")
  if (miniPlayerElement) {
    miniPlayerElement.addEventListener("click", (e) => {
      if (!e.target.closest("button")) {
        console.log("🎵 Mini player clicado - abrindo interface principal")

        if (typeof window.invokeNative === "function") {
          window.invokeNative("openMusicInterface", {})
        }
      }
    })
  }

  console.log("✅ Controles do mini player configurados")
}

function updateMiniPlayerButtons(isPlaying) {
  const playPauseBtn = document.getElementById("mini-play-pause")
  if (!playPauseBtn) return

  const playIcon = playPauseBtn.querySelector(".play-icon")
  const pauseIcon = playPauseBtn.querySelector(".pause-icon")

  if (isPlaying) {
    if (playIcon) playIcon.style.display = "none"
    if (pauseIcon) pauseIcon.style.display = "block"
  } else {
    if (playIcon) playIcon.style.display = "block"
    if (pauseIcon) pauseIcon.style.display = "none"
  }
}

window.updateMiniPlayerButtons = updateMiniPlayerButtons

console.log("🎵 Sistema de Mini Player inicializado!")

window.MiniPlayerUI = MiniPlayerUI

window.addEventListener("resize", () => {
  if (miniPlayerVisible) {
    setTimeout(() => {
      const rect = miniPlayer.getBoundingClientRect()
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      if (rect.right > windowWidth || rect.bottom > windowHeight || rect.left < 0 || rect.top < 0) {
        miniPlayer.style.top = "20px"
        miniPlayer.style.right = "20px"
        miniPlayer.style.left = "auto"
        miniPlayer.style.bottom = "auto"
      }
    }, 100)
  }
})

function saveMiniPlayerPosition() {
  if (miniPlayerVisible) {
    const rect = miniPlayer.getBoundingClientRect()
    const position = {
      top: rect.top,
      right: window.innerWidth - rect.right,
    }

    try {
      localStorage.setItem("miniPlayerPosition", JSON.stringify(position))
    } catch (error) {
      console.warn("Não foi possível salvar posição do mini player:", error)
    }
  }
}

function restoreMiniPlayerPosition() {
  try {
    const savedPosition = localStorage.getItem("miniPlayerPosition")
    if (savedPosition) {
      const position = JSON.parse(savedPosition)
      miniPlayer.style.top = `${position.top}px`
      miniPlayer.style.right = `${position.right}px`
    }
  } catch (error) {
    console.warn("Não foi possível restaurar posição do mini player:", error)
  }
}
;(() => {
  try {
    const enabled = localStorage.getItem('principal_debug') === 'true'
    const noop = function () {}
    if (!enabled) {
      console.log = noop
      console.info = noop
      console.warn = noop
    }
  } catch (_) {}
})()
