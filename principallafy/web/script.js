let isPlaying = false
let player
let ambientPlayer = null
let currentVideoId = null
let isDragging = false
let currentX
let currentY
let initialX
let initialY
let xOffset = 0
let yOffset = 0
let currentTrackIndex = 0
let playlist = []
let savedVolume = 100
let trackHistory = []

const externalPlayers = {}
const gainNodes = {}
const panNodes = {}

const djPlayers = {}
const djGainNodes = {}
const djPanNodes = {}
let userId = null
let isDJMode = false
let currentDJStation = null
let isGlobalMuted = false
let audioContext
let currentPlaylistId = null

function showPlaylistSelector(videoId) {
  console.log("Abrindo seletor de playlist para vídeo:", videoId)
  
  const modal = document.getElementById("playlist-modal")
  if (!modal) {
    console.error("Modal de playlist não encontrado")
    return
  }
  
  modal.style.display = "flex"
  
  loadPlaylistsForModal()
  try {
    if (Array.isArray(dataCache?.favoritos) && dataCache.favoritos.length > 0) {
      populatePlaylistModal(dataCache.favoritos)
    }
  } catch (e) {
    console.warn("Não foi possível popular modal a partir do cache:", e)
  }
  
  modal.dataset.videoId = videoId
}

function setupNowPlayingActions() {
  try {
    const nowPlaying = document.querySelector('.now-playing')
    const favoriteBtn = document.querySelector('.now-playing-actions .favorite')
    const addBtn = document.querySelector('.now-playing-actions .add-to-playlist')

    if (!favoriteBtn && !addBtn) return

    favoriteBtn?.replaceWith(favoriteBtn.cloneNode(true))
    addBtn?.replaceWith(addBtn.cloneNode(true))

    const refreshedFavoriteBtn = document.querySelector('.now-playing-actions .favorite')
    const refreshedAddBtn = document.querySelector('.now-playing-actions .add-to-playlist')

    refreshedFavoriteBtn?.addEventListener('click', (e) => {
      e.stopPropagation()

      if (!currentVideoId || !player || !player.getVideoData) {
        showNotification('Nenhuma música tocando no momento', 'warning')
        return
      }

      const isActive = refreshedFavoriteBtn.classList.contains('active')
      const data = player.getVideoData() || {}
      const title = nowPlaying?.dataset.title || data.title || 'Música'
      const duration = nowPlaying?.dataset.duration || formatTime(player.getDuration())
      const videoId = nowPlaying?.dataset.videoId || currentVideoId

      refreshedFavoriteBtn.classList.toggle('active')

      const action = isActive ? 'removida dos' : 'adicionada aos'
      showNotification(`Música ${action} favoritos`, isActive ? 'info' : 'success')

      fetch(`https://${safeGetParentResourceName()}/toggleFavorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          id: videoId,
          title,
          thumbnail: getOptimizedThumbnail(videoId, 'medium'),
          duration,
        }),
      }).catch((error) => {
        console.error('Erro ao favoritar (now-playing):', error)
        refreshedFavoriteBtn.classList.toggle('active')
        showNotification('Erro ao favoritar música', 'error')
      })
    })

    refreshedAddBtn?.addEventListener('click', (e) => {
      e.stopPropagation()

      const videoId = nowPlaying?.dataset.videoId || currentVideoId
      if (!videoId) {
        showNotification('Nenhuma música selecionada para adicionar', 'warning')
        return
      }

      if (typeof showPlaylistSelector === 'function') {
        showPlaylistSelector(videoId)
      } else {
        console.error('Função showPlaylistSelector não encontrada')
        showNotification('Não foi possível abrir o seletor de playlist', 'error')
      }
    })
  } catch (err) {
    console.error('Erro ao configurar ações do now-playing:', err)
  }
}

function loadPlaylistsForModal() {
  console.log("Carregando playlists para o modal...")
  
  fetch(`https://${safeGetParentResourceName()}/getPlaylists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  .then(() => {
    console.log("Solicitação de playlists enviada")
  })
  .catch((error) => console.error("Erro ao carregar playlists:", error))
}

function populatePlaylistModal(playlists) {
  const playlistsList = document.querySelector("#playlist-modal .playlists-list")
  if (!playlistsList) return
  
  if (!Array.isArray(playlists) || playlists.length === 0) {
    playlistsList.innerHTML = `
      <div class="empty-playlists">
        <p>Você ainda não criou nenhuma playlist.</p>
        <p>Use o formulário abaixo para criar sua primeira playlist.</p>
      </div>
    `
    return
  }
  
  playlistsList.innerHTML = playlists.map(playlist => `
    <div class="playlist-item" data-playlist-id="${playlist.id}" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;background-color:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);">
      <div class="playlist-icon" style="width:40px;height:40px;border-radius:4px;background:${playlist.thumbnail ? `url('${playlist.thumbnail}') center/cover` : 'rgba(255,255,255,0.1)'};display:flex;align-items:center;justify-content:center;color:#1db954;flex-shrink:0;">
        ${playlist.thumbnail ? '' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12 13V5M1 5v14l4-4h4"/></svg>'}
      </div>
      <span class="playlist-name" style="flex:1;color:#fff;">${playlist.name}</span>
      <button class="add-to-this-playlist" data-playlist-id="${playlist.id}" style="padding:8px 12px;background-color:#1db954;border:none;border-radius:6px;color:#000;font-weight:600;cursor:pointer;">Adicionar</button>
    </div>
  `).join("")
  
  playlistsList.querySelectorAll(".add-to-this-playlist").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const playlistId = btn.dataset.playlistId
      const modal = document.getElementById("playlist-modal")
      const videoId = modal.dataset.videoId
      
      if (playlistId && videoId) {
        addVideoToPlaylist(playlistId, videoId)
      }
    })
  })
}

function addVideoToPlaylist(playlistId, videoId) {
  console.log(`Adicionando vídeo ${videoId} à playlist ${playlistId}`)
  
  fetch(`https://${safeGetParentResourceName()}/addToPlaylist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlistId, videoId }),
  })
  .then(() => {
    console.log("Vídeo adicionado à playlist com sucesso")
    const modal = document.getElementById("playlist-modal")
    if (modal) {
      modal.style.display = "none"
    }
    
    showNotification("Música adicionada à playlist!")
  })
  .catch((error) => {
    console.error("Erro ao adicionar vídeo à playlist:", error)
    showNotification("Erro ao adicionar música à playlist", "error")
  })
}

function showNotification(message, type = "success") {
  const notification = document.createElement("div")
  notification.className = `notification ${type}`
  notification.textContent = message
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === "error" ? "#ff4444" : "#00ff88"};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 10000;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `
  
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.style.transform = "translateX(0)"
  }, 100)
  
  setTimeout(() => {
    notification.style.transform = "translateX(100%)"
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 300)
  }, 3000)
}

let miniPlayerVisible = false
let miniCurrentTrackData = null
let miniIsPlaying = false

let currentTab = "musicas"
const isDataLoaded = {
  musicas: false,
  favoritos: false,
  curtidas: false,
}

const dataCache = {
  musicas: [],
  favoritos: [],
  curtidas: [],
}

const thumbnailCache = new Map()
const imagePreloader = new Map()

const imagePool = []
const MAX_POOL_SIZE = 50

const isFiveMEnvironment = () => {
  return (
    typeof window !== "undefined" &&
    typeof window.GetParentResourceName === "function" &&
    typeof window.RegisterNUICallback === "function"
  )
}

function safeRegisterNUICallback(eventName, callback) {
  if (isFiveMEnvironment()) {
    try {
      window.RegisterNUICallback(eventName, callback)
      console.log(`✅ Callback registrado: ${eventName}`)
    } catch (error) {
      console.error(`❌ Erro ao registrar callback ${eventName}:`, error)
    }
  } else {
    console.warn(`⚠️ Ambiente FiveM não detectado, callback ${eventName} não registrado`)
    window[`nui_${eventName}`] = callback
  }
}

function safeGetParentResourceName() {
  if (isFiveMEnvironment()) {
    try {
      return window.GetParentResourceName()
    } catch (error) {
      console.error("❌ Erro ao obter nome do resource:", error)
      return "principal"
    }
  }
  return "principal"
}

const MiniPlayer = {
  shouldShow: () => {
    console.log("🔍 Verificando se deve mostrar mini player:")
    console.log("  - currentVideoId:", currentVideoId)
    console.log("  - isPlaying:", isPlaying)
    console.log("  - player state:", player && player.getPlayerState ? player.getPlayerState() : "N/A")

    const YT = window.YT

    const shouldShow =
      currentVideoId &&
      isPlaying &&
      (!player ||
        !player.getPlayerState ||
        (player.getPlayerState() !== YT.PlayerState.PAUSED && player.getPlayerState() !== YT.PlayerState.ENDED))

    console.log("  - Resultado:", shouldShow)
    return shouldShow
  },

  getCurrentTrackData: () => {
    if (!player || !currentVideoId) return null

    try {
      const data = player.getVideoData()
      const currentTrack = playlist.find((track) => track.id === currentVideoId || track.videoId === currentVideoId)

      return {
        videoId: currentVideoId,
        title: data?.title || currentTrack?.title || "Música Desconhecida",
        artist: currentTrack?.author || "Artista Desconhecido",
        thumbnail: getOptimizedThumbnail(currentVideoId, "medium"),
        duration: player.getDuration ? formatTime(player.getDuration()) : "0:00",
      }
    } catch (error) {
      console.error("Erro ao obter dados da faixa:", error)
      return null
    }
  },

  show: () => {
    if (!MiniPlayer.shouldShow()) {
      console.log("🚫 Mini player não deve ser mostrado - música não está tocando")
      return
    }

    const trackData = MiniPlayer.getCurrentTrackData()
    if (!trackData) {
      console.log("🚫 Mini player não mostrado - sem dados da faixa")
      return
    }

    console.log("✅ Mostrando mini player:", trackData.title)

    if (isFiveMEnvironment()) {
      try {
        fetch(`https://${safeGetParentResourceName()}/showMiniPlayer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackData: trackData,
            djMode: isDJMode && currentDJStation,
            isPlaying: isPlaying,
          }),
        }).catch(console.error)
      } catch (error) {
        console.error("Erro ao mostrar mini player via fetch:", error)
      }
    }

    try {
      const miniPlayerElement = document.getElementById("mini-player")
      if (miniPlayerElement) {
        const miniTitle = document.getElementById("mini-title")
        const miniArtist = document.getElementById("mini-artist")
        const miniArtwork = document.getElementById("mini-artwork-img")

        if (miniTitle) miniTitle.textContent = trackData.title
        if (miniArtist) miniArtist.textContent = trackData.artist
        if (miniArtwork) miniArtwork.src = trackData.thumbnail

        miniPlayerElement.classList.toggle("dj-mode", isDJMode && currentDJStation)
        miniPlayerElement.classList.toggle("playing", isPlaying)
        miniPlayerElement.classList.add("visible")

        miniPlayerVisible = true
        miniCurrentTrackData = trackData
        miniIsPlaying = isPlaying

        console.log("✅ Mini player mostrado localmente:", trackData)
      }
    } catch (error) {
      console.error("Erro ao mostrar mini player localmente:", error)
    }
  },

  hide: () => {
    console.log("🔽 Escondendo mini player")

    if (isFiveMEnvironment()) {
      try {
        fetch(`https://${safeGetParentResourceName()}/hideMiniPlayer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).catch(console.error)
      } catch (error) {
        console.error("Erro ao esconder mini player via fetch:", error)
      }
    }

    try {
      const miniPlayerElement = document.getElementById("mini-player")
      if (miniPlayerElement) {
        miniPlayerElement.classList.remove("visible")
        miniPlayerVisible = false
        console.log("🔽 Mini player escondido localmente")
      }
    } catch (error) {
      console.error("Erro ao esconder mini player localmente:", error)
    }
  },

  updatePlayState: () => {
    if (isFiveMEnvironment()) {
      try {
        fetch(`https://${safeGetParentResourceName()}/updateMiniPlayState`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isPlaying: isPlaying,
          }),
        }).catch(console.error)
      } catch (error) {
        console.error("Erro ao atualizar estado via fetch:", error)
      }
    }

    try {
      const miniPlayerElement = document.getElementById("mini-player")
      const playPauseBtn = document.getElementById("mini-play-pause")

      if (miniPlayerElement) {
        miniPlayerElement.classList.toggle("playing", isPlaying)
      }

      if (playPauseBtn) {
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

      miniIsPlaying = isPlaying
    } catch (error) {
      console.error("Erro ao atualizar estado localmente:", error)
    }
  },

  updateTrack: () => {
    const trackData = MiniPlayer.getCurrentTrackData()
    if (!trackData) return

    if (isFiveMEnvironment()) {
      try {
        fetch(`https://${safeGetParentResourceName()}/updateMiniPlayer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackData: trackData,
            djMode: isDJMode && currentDJStation,
          }),
        }).catch(console.error)
      } catch (error) {
        console.error("Erro ao atualizar track via fetch:", error)
      }
    }

    try {
      const miniTitle = document.getElementById("mini-title")
      const miniArtist = document.getElementById("mini-artist")
      const miniArtwork = document.getElementById("mini-artwork-img")
      const miniPlayerElement = document.getElementById("mini-player")

      if (miniTitle) miniTitle.textContent = trackData.title
      if (miniArtist) miniArtist.textContent = trackData.artist
      if (miniArtwork) miniArtwork.src = trackData.thumbnail
      if (miniPlayerElement) {
        miniPlayerElement.classList.toggle("dj-mode", isDJMode && currentDJStation)
      }

      miniCurrentTrackData = trackData
    } catch (error) {
      console.error("Erro ao atualizar track localmente:", error)
    }
  },

  togglePlayPause: () => {
    console.log("🎵 Mini player toggle play/pause")

    if (!player || !currentVideoId) {
      console.log("🚫 Player ou videoId não disponível")
      return
    }

    if (isPlaying) {
      player.pauseVideo()
      isPlaying = false

      const playPauseBtn = document.getElementById("play-pause")
      if (playPauseBtn) {
        playPauseBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5V19L19 12L8 5Z"/>
          </svg>
        `
      }

      MiniPlayer.hide()

      if (isDJMode && currentDJStation) {
        MusicSystem.pauseDJTrack({
          stationIndex: currentDJStation.stationIndex,
        })
      } else {
        MusicSystem.pauseTrack()
      }
  } else {
      player.playVideo()
      isPlaying = true

      try {
        fetch(`https://${safeGetParentResourceName()}/resumePlayback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).catch((error) => console.error("Erro ao retomar reprodução (resumePlayback):", error))
      } catch (error) {
        console.error("Erro ao enviar resumePlayback:", error)
      }

      const playPauseBtn = document.getElementById("play-pause")
      if (playPauseBtn) {
        playPauseBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
        `
      }

      MiniPlayer.updatePlayState()
    }
  },

  nextTrack: () => {
    console.log("🎵 Mini player próxima música")
    playNextTrack()
  },

  previousTrack: () => {
    console.log("🎵 Mini player música anterior")
    playPreviousTrack()
  },
}

function getOptimizedThumbnail(videoId, quality = "mqdefault") {
  const qualities = {
    low: "default",
    medium: "mqdefault",
    high: "hqdefault",
    max: "maxresdefault",
  }

  const selectedQuality = qualities[quality] || "mqdefault"
  return `https://i.ytimg.com/vi/${videoId}/${selectedQuality}.jpg`
}

function preloadImage(src, videoId) {
  return new Promise((resolve, reject) => {
    if (thumbnailCache.has(src)) {
      resolve(thumbnailCache.get(src))
      return
    }

    if (imagePreloader.has(src)) {
      imagePreloader.get(src).then(resolve).catch(reject)
      return
    }

    const loadPromise = new Promise((imgResolve, imgReject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"

      const timeout = setTimeout(() => {
        imgReject(new Error("Timeout ao carregar imagem"))
      }, 3000)

      img.onload = () => {
        clearTimeout(timeout)
        thumbnailCache.set(src, src)
        imagePreloader.delete(src)
        imgResolve(src)
      }

      img.onerror = () => {
        clearTimeout(timeout)
        imagePreloader.delete(src)
        const fallbackSrc = getOptimizedThumbnail(videoId, "low")
        if (fallbackSrc !== src) {
          preloadImage(fallbackSrc, videoId).then(imgResolve).catch(imgReject)
        } else {
          imgReject(new Error("Falha ao carregar imagem"))
        }
      }

      img.src = src
    })

    imagePreloader.set(src, loadPromise)
    loadPromise.then(resolve).catch(reject)
  })
}

function setupLazyLoading() {
  if (!window.IntersectionObserver) {
    console.warn("⚠️ IntersectionObserver não suportado, usando carregamento direto")
    return {
      observe: (img) => {
        const src = img.dataset.src
        const videoId = img.dataset.videoId
        if (src && videoId) {
          preloadImage(src, videoId)
            .then((loadedSrc) => {
              img.src = loadedSrc
              img.classList.add("loaded")
            })
            .catch(() => {
              img.src = getOptimizedThumbnail(videoId, "low")
              img.classList.add("loaded")
            })
        }
      },
      unobserve: () => {},
    }
  }

  const imageObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target
          const videoId = img.dataset.videoId
          const src = img.dataset.src

          if (src && videoId) {
            preloadImage(src, videoId)
              .then((loadedSrc) => {
                img.src = loadedSrc
                img.classList.add("loaded")
              })
              .catch(() => {
                img.src = getOptimizedThumbnail(videoId, "low")
                img.classList.add("loaded")
              })
          }

          observer.unobserve(img)
        }
      })
    },
    {
      rootMargin: "50px",
    },
  )

  return imageObserver
}

try {
  const savedHistory = localStorage.getItem("trackHistory")
  if (savedHistory) {
    trackHistory = JSON.parse(savedHistory)
    playlist = trackHistory
  }
} catch (error) {
  console.error("Erro ao carregar histórico:", error)
  trackHistory = []
}

function initAudioContext() {
  try {
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.warn("⚠️ AudioContext não suportado neste navegador")
      return
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    console.log("✅ Contexto de áudio inicializado")

    if (audioContext.state === "suspended") {
      console.log("🔊 Contexto de áudio suspenso, será ativado na primeira interação")
    }
  } catch (e) {
    console.error("❌ Falha na inicialização do contexto de áudio:", e)
  }
}

function resumeAudioContext() {
  if (audioContext && audioContext.state === "suspended") {
    audioContext
      .resume()
      .then(() => {
        console.log("✅ Contexto de áudio ativado")
      })
      .catch((error) => {
        console.error("❌ Erro ao ativar contexto de áudio:", error)
      })
  }
}

function createDJPlayer(stationId, videoId) {
  const YT = window.YT
  if (djPlayers[stationId]) {
    console.log(`Atualizando player de DJ ${stationId} para o vídeo ${videoId}`)

    if (
      djPlayers[stationId].player &&
      djPlayers[stationId].player.getPlayerState &&
      djPlayers[stationId].player.getPlayerState() === YT.PlayerState.PLAYING
    ) {
      djPlayers[stationId].player.pauseVideo()
    }

    djPlayers[stationId].player.loadVideoById(videoId)
    djPlayers[stationId].videoId = videoId
    return
  }

  console.log(`Criando novo player de DJ para estação ${stationId}, vídeo ${videoId}`)

  const playerContainer = document.createElement("div")
  playerContainer.id = `youtube-dj-player-${stationId}`
  playerContainer.style.display = "none"
  document.body.appendChild(playerContainer)

  const newPlayer = new YT.Player(`youtube-dj-player-${stationId}`, {
    height: "0",
    width: "0",
    videoId: videoId,
    playerVars: {
      playsinline: 1,
      controls: 0,
      mute: 0,
    },
    events: {
      onReady: (event) => onDJPlayerReady(event, stationId),
      onStateChange: (event) => onDJPlayerStateChange(event, stationId),
    },
  })

  if (audioContext) {
    try {
      djGainNodes[stationId] = audioContext.createGain()
      djGainNodes[stationId].gain.value = 1.0

      djPanNodes[stationId] = audioContext.createStereoPanner()
      djPanNodes[stationId].pan.value = 0

      djGainNodes[stationId].connect(djPanNodes[stationId])
      djPanNodes[stationId].connect(audioContext.destination)
    } catch (error) {
      console.error("❌ Erro ao criar nós de áudio para DJ:", error)
    }
  }

  djPlayers[stationId] = {
    player: newPlayer,
    videoId: videoId,
    volume: 100,
    pan: 0,
    container: playerContainer,
  }
}

function onDJPlayerReady(event, stationId) {
  console.log(`Player de DJ ${stationId} pronto`)

  if (!djPlayers[stationId]) return

  try {
    event.target.setVolume(100)
    event.target.playVideo()

    console.log(`🎧 Player DJ ${stationId} iniciado com volume 100%`)
  } catch (error) {
    console.error(`❌ Erro ao configurar player DJ ${stationId}:`, error)
  }
}

function onDJPlayerStateChange(event, stationId) {
  console.log(`Estado do player de DJ ${stationId} mudou para ${event.data}`)

  if (!djPlayers[stationId]) return

  try {
    const YT = window.YT
    if (event.data === YT.PlayerState.ENDED) {
      event.target.playVideo()
    }
  } catch (error) {
    console.error(`❌ Erro no player DJ ${stationId}:`, error)
  }
}

function updateDJPlayer(stationId, volume, pan) {
  if (!djPlayers[stationId]) return

  console.log(`🎧 Atualizando DJ ${stationId} - Volume: ${volume}%, Pan: ${pan}`)

  djPlayers[stationId].volume = volume
  djPlayers[stationId].pan = pan

  try {
    if (djPlayers[stationId].player && djPlayers[stationId].player.setVolume) {
      const finalVolume = isGlobalMuted ? 0 : volume
      djPlayers[stationId].player.setVolume(finalVolume)
      console.log(`🎧 Volume aplicado no player DJ: ${finalVolume}%`)
    }

    if (audioContext) {
      if (djGainNodes[stationId]) {
        djGainNodes[stationId].gain.value = isGlobalMuted ? 0 : volume / 100
      }

      if (djPanNodes[stationId]) {
        djPanNodes[stationId].pan.value = pan
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao atualizar player DJ ${stationId}:`, error)
  }

  updateAmbientSourcesList()
}

function removeDJPlayer(stationId) {
  if (!djPlayers[stationId]) return

  console.log(`Removendo player de DJ ${stationId}`)

  try {
    if (djPlayers[stationId].player) {
      djPlayers[stationId].player.stopVideo()
      djPlayers[stationId].player.destroy()
    }

    if (audioContext) {
      if (djGainNodes[stationId]) {
        djGainNodes[stationId].disconnect()
        delete djGainNodes[stationId]
      }

      if (djPanNodes[stationId]) {
        djPanNodes[stationId].disconnect()
        delete djPanNodes[stationId]
      }
    }

    if (djPlayers[stationId].container) {
      djPlayers[stationId].container.remove()
    }

    delete djPlayers[stationId]
  } catch (error) {
    console.error(`❌ Erro ao remover player DJ ${stationId}:`, error)
  }

  updateAmbientSourcesList()
}

function createExternalPlayer(sourceId, videoId) {
  const YT = window.YT
  if (externalPlayers[sourceId]) {
    console.log(`Atualizando player externo ${sourceId} para o vídeo ${videoId}`)

    if (
      externalPlayers[sourceId].player &&
      externalPlayers[sourceId].player.getPlayerState &&
      externalPlayers[sourceId].player.getPlayerState() === YT.PlayerState.PLAYING
    ) {
      externalPlayers[sourceId].player.pauseVideo()
    }

    externalPlayers[sourceId].player.loadVideoById(videoId)
    try {
      externalPlayers[sourceId].player.playVideo()
    } catch (err) {
      console.warn(`Não foi possível iniciar reprodução automática do player externo ${sourceId}:`, err)
    }
    externalPlayers[sourceId].videoId = videoId
    return
  }

  console.log(`Criando novo player externo para fonte ${sourceId}, vídeo ${videoId}`)

  const playerContainer = document.createElement("div")
  playerContainer.id = `youtube-player-${sourceId}`
  playerContainer.style.display = "none"
  document.body.appendChild(playerContainer)

  const newPlayer = new YT.Player(`youtube-player-${sourceId}`, {
    height: "0",
    width: "0",
    videoId: videoId,
    playerVars: {
      playsinline: 1,
      controls: 0,
      mute: 0,
    },
    events: {
      onReady: (event) => onExternalPlayerReady(event, sourceId),
      onStateChange: (event) => onExternalPlayerStateChange(event, sourceId),
    },
  })

  if (audioContext) {
    try {
      gainNodes[sourceId] = audioContext.createGain()
      gainNodes[sourceId].gain.value = 0.5

      panNodes[sourceId] = audioContext.createStereoPanner()
      panNodes[sourceId].pan.value = 0

      gainNodes[sourceId].connect(panNodes[sourceId])
      panNodes[sourceId].connect(audioContext.destination)
    } catch (error) {
      console.error("❌ Erro ao criar nós de áudio externos:", error)
    }
  }

  externalPlayers[sourceId] = {
    player: newPlayer,
    videoId: videoId,
    volume: 50,
    pan: 0,
    container: playerContainer,
  }
}

function onExternalPlayerReady(event, sourceId) {
  console.log(`Player externo ${sourceId} pronto`)

  if (!externalPlayers[sourceId]) return

  try {
    event.target.setVolume(0)
    event.target.playVideo()
  } catch (error) {
    console.error(`❌ Erro no player externo ${sourceId}:`, error)
  }
}

function onExternalPlayerStateChange(event, sourceId) {
  console.log(`Estado do player externo ${sourceId} mudou para ${event.data}`)

  if (!externalPlayers[sourceId]) return

  try {
    const YT = window.YT
    if (
      event.data === YT.PlayerState.CUED ||
      event.data === YT.PlayerState.UNSTARTED
    ) {
      event.target.playVideo()
      return
    }

    if (event.data === YT.PlayerState.ENDED) {
      event.target.playVideo()
    }
  } catch (error) {
    console.error(`❌ Erro no player externo ${sourceId}:`, error)
  }
}

function updateExternalPlayer(sourceId, volume, pan) {
  if (!externalPlayers[sourceId]) return

  externalPlayers[sourceId].volume = volume
  externalPlayers[sourceId].pan = pan

  try {
    if (externalPlayers[sourceId].player && externalPlayers[sourceId].player.setVolume) {
      externalPlayers[sourceId].player.setVolume(isGlobalMuted ? 0 : volume)
    }

    if (audioContext) {
      if (gainNodes[sourceId]) {
        gainNodes[sourceId].gain.value = isGlobalMuted ? 0 : volume / 100
      }

      if (panNodes[sourceId]) {
        panNodes[sourceId].pan.value = pan
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao atualizar player externo ${sourceId}:`, error)
  }

  updateAmbientSourcesList()
}

function removeExternalPlayer(sourceId) {
  if (!externalPlayers[sourceId]) return

  console.log(`Removendo player externo ${sourceId}`)

  try {
    if (externalPlayers[sourceId].player) {
      externalPlayers[sourceId].player.stopVideo()
      externalPlayers[sourceId].player.destroy()
    }

    if (audioContext) {
      if (gainNodes[sourceId]) {
        gainNodes[sourceId].disconnect()
        delete gainNodes[sourceId]
      }

      if (panNodes[sourceId]) {
        panNodes[sourceId].disconnect()
        delete panNodes[sourceId]
      }
    }

    if (externalPlayers[sourceId].container) {
      externalPlayers[sourceId].container.remove()
    }

    delete externalPlayers[sourceId]
  } catch (error) {
    console.error(`❌ Erro ao remover player externo ${sourceId}:`, error)
  }

  updateAmbientSourcesList()
}

function updateAmbientSourcesList() {
  const sourcesList = document.querySelector(".ambient-sources-list")
  if (!sourcesList) return

  sourcesList.innerHTML = ""

  const hasExternalSources = Object.keys(externalPlayers).length > 0
  const hasDJSources = Object.keys(djPlayers).length > 0
  const hasSources = hasExternalSources || hasDJSources

  const ambientSources = document.querySelector(".ambient-sources")
  const ambientIndicator = document.querySelector(".ambient-indicator")

  if (ambientSources) ambientSources.classList.toggle("active", hasSources)
  if (ambientIndicator) ambientIndicator.style.display = hasSources ? "flex" : "none"

  for (const sourceId in externalPlayers) {
    const sourceData = externalPlayers[sourceId]
    const sourceElement = document.createElement("div")
    sourceElement.className = "ambient-source"
    sourceElement.innerHTML = `
            <div class="ambient-title" title="${sourceData.title || "Música Desconhecida"}">
                🎵 ${sourceData.title || "Música Desconhecida"}
            </div>
            <div class="ambient-volume">
                Volume: ${Math.round(sourceData.volume)}%
            </div>
        `
    sourcesList.appendChild(sourceElement)
  }

  for (const stationId in djPlayers) {
    const djData = djPlayers[stationId]
    const sourceElement = document.createElement("div")
    sourceElement.className = "ambient-source dj-source"
    sourceElement.innerHTML = `
            <div class="ambient-title" title="${djData.title || "DJ Desconhecido"}">
                🎧 DJ: ${djData.title || "Música Desconhecida"}
            </div>
            <div class="ambient-volume">
                Volume: ${Math.round(djData.volume)}%
            </div>
        `
    sourcesList.appendChild(sourceElement)
  }
}

function saveToHistory(track) {
  if (!track || !track.videoId) return

  trackHistory = trackHistory.filter((t) => t.videoId !== track.videoId)

  const historyTrack = {
    videoId: track.videoId,
    id: track.videoId,
    title: track.title,
    thumbnail: getOptimizedThumbnail(track.videoId, "medium"),
    duration: track.duration,
  }

  trackHistory.unshift(historyTrack)
  trackHistory = trackHistory.slice(0, 100)

  try {
    localStorage.setItem("trackHistory", JSON.stringify(trackHistory))
    playlist = trackHistory
  } catch (error) {
    console.error("Erro ao salvar histórico:", error)
  }
}

function loadYouTubeAPI() {
  if (window.YT) return

  const tag = document.createElement("script")
  tag.src = "https://www.youtube.com/iframe_api"
  const firstScriptTag = document.getElementsByTagName("script")[0]
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
}

function onYouTubeIframeAPIReady() {
  try {
    player = new YT.Player("youtube-player", {
      height: "0",
      width: "0",
      playerVars: {
        playsinline: 1,
        controls: 0,
        enablejsapi: 1,
      },
      events: {
        onStateChange: onPlayerStateChange,
        onReady: onPlayerReady,
      },
    })

    if (!player.setStereoPan) {
      player.setStereoPan = (pan) => {
        const audioElement = document.querySelector("#youtube-player audio")
        if (audioElement) {
          try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)()
            const source = audioContext.createMediaElementSource(audioElement)
            const panNode = audioContext.createStereoPanner()

            source.connect(panNode)
            panNode.connect(audioContext.destination)
            panNode.pan.value = pan
          } catch (error) {
            console.error("Erro no stereo pan:", error)
          }
        }
      }
    }

    const ambientEl = document.getElementById("ep-ambient")
    if (ambientEl && typeof YT !== "undefined" && YT.Player) {
      try {
        ambientPlayer = new YT.Player("ep-ambient", {
          height: "100%",
          width: "100%",
          playerVars: {
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (e) => {
              try {
                e.target.mute()
                if (currentVideoId) {
                  e.target.loadVideoById(currentVideoId)
                  e.target.playVideo()
                }
              } catch (_) {}
            },
          },
        })
      } catch (error) {
        console.error("❌ Erro ao inicializar ambient player:", error)
      }
    }
  } catch (error) {
    console.error("❌ Erro ao inicializar YouTube player:", error)
  }
}

function onPlayerReady(event) {
  if (!player) return

  try {
    const volume = Math.max(0, Math.min(savedVolume || 50, 100))
    player.setVolume(isGlobalMuted ? 0 : volume)

    document.querySelectorAll(".volume-slider, .ep-volume-slider").forEach((s) => {
      s.value = volume
      if (typeof updateSliderBackground === "function") updateSliderBackground(s)
    })
    const epVolValue = document.querySelector(".ep-volume-value")
    if (epVolValue) epVolValue.textContent = `${Math.round(volume)}%`
    if (typeof updateVolumeIcon === "function") updateVolumeIcon(volume)
  } catch (error) {
    console.error("❌ Erro no onPlayerReady:", error)
  }
}

function updateVolumeIcon(volume) {
  const volumeBtn = document.querySelector(".volume-btn")
  if (!volumeBtn) return

  const svgMuted = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    `

  const svgLowVolume = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 9L19 14M19 9L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    `

  const svgHighVolume = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 9L19 14M19 9L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18 6.7C19.3 8.1 20 10 20 12C20 14 19.3 15.9 18 17.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    `

  if (volume === 0 || isGlobalMuted) {
    volumeBtn.innerHTML = svgMuted
  } else if (volume < 50) {
    volumeBtn.innerHTML = svgLowVolume
  } else {
    volumeBtn.innerHTML = svgHighVolume
  }
}

function playVideo(videoId) {
  if (!player || !videoId) return

  try {
    currentVideoId = videoId
    player.loadVideoById(videoId)
    isPlaying = true

    try {
      if (ambientPlayer && typeof ambientPlayer.loadVideoById === "function") {
        ambientPlayer.mute()
        ambientPlayer.loadVideoById(videoId)
        ambientPlayer.playVideo()
      }
    } catch (_) {}

    const playPauseBtn = document.getElementById("play-pause")
    if (playPauseBtn) {
      playPauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
            `
    }

    if (miniPlayerVisible) {
      MiniPlayer.updatePlayState()
      MiniPlayer.updateTrack()
    }

    if (typeof ExpandedPlayer !== "undefined") {
      ExpandedPlayer.show()
    }
  } catch (error) {
    console.error("Erro ao reproduzir vídeo:", error)
  }
}

function playNextTrack() {
  if (!playlist || !Array.isArray(playlist) || playlist.length === 0) return

  try {
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length
    const nextTrack = playlist[currentTrackIndex]

    if (nextTrack && nextTrack.id) {
      playVideo(nextTrack.id)
      updateNowPlaying()

      const trackData = {
        videoId: nextTrack.id,
        title: nextTrack.title,
        thumbnail: nextTrack.thumbnail,
        duration: nextTrack.duration,
      }

      if (isDJMode && currentDJStation) {
        trackData.stationIndex = currentDJStation.stationIndex
        trackData.stationData = currentDJStation.stationData

        MusicSystem.playDJTrack(trackData).catch((error) => console.error("Erro ao tocar próxima faixa DJ:", error))
      } else {
        fetch(`https://${safeGetParentResourceName()}/playTrack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trackData),
        }).catch((error) => console.error("Erro ao tocar próxima faixa:", error))
      }
    }
  } catch (error) {
    console.error("Erro ao reproduzir próxima faixa:", error)
  }
}

function playPreviousTrack() {
  if (!playlist || !Array.isArray(playlist) || playlist.length === 0) return

  try {
    currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length
    const prevTrack = playlist[currentTrackIndex]

    if (prevTrack && prevTrack.id) {
      playVideo(prevTrack.id)
      updateNowPlaying()

      const trackData = {
        videoId: prevTrack.id,
        title: prevTrack.title,
        thumbnail: prevTrack.thumbnail,
        duration: prevTrack.duration,
      }

      if (isDJMode && currentDJStation) {
        trackData.stationIndex = currentDJStation.stationIndex
        trackData.stationData = currentDJStation.stationData

        MusicSystem.playDJTrack(trackData).catch((error) => console.error("Erro ao tocar faixa anterior DJ:", error))
      } else {
        fetch(`https://${safeGetParentResourceName()}/playTrack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trackData),
        }).catch((error) => console.error("Erro ao tocar faixa anterior:", error))
      }
    }
  } catch (error) {
    console.error("Erro ao reproduzir faixa anterior:", error)
  }
}

function onPlayerStateChange(event) {
  if (!event) return

  try {
    const YT = window.YT
    if (event.data === YT.PlayerState.ENDED) {
      playNextTrack()
    } else if (event.data === YT.PlayerState.PLAYING) {
      isPlaying = true
      updateNowPlaying()
      if (miniPlayerVisible) {
        MiniPlayer.updatePlayState()
      }
      if (typeof ExpandedPlayer !== "undefined") {
        ExpandedPlayer.updatePlayState(true)
        ExpandedPlayer.updateFromPlayer()
      }
    } else if (event.data === YT.PlayerState.PAUSED) {
      isPlaying = false
      if (miniPlayerVisible) {
        MiniPlayer.updatePlayState()
        setTimeout(() => {
          if (!isPlaying) {
            MiniPlayer.hide()
          }
        }, 1000)
      }
      if (typeof ExpandedPlayer !== "undefined") {
        ExpandedPlayer.updatePlayState(false)
      }
    }
  } catch (error) {
    console.error("❌ Erro no onPlayerStateChange:", error)
  }
}

function updateNowPlaying() {
  if (!player || !player.getVideoData || !currentVideoId) return

  try {
    const data = player.getVideoData()
    if (!data || !data.title) return

    const duration = player.getDuration()
    const thumbnail = getOptimizedThumbnail(currentVideoId, "medium")

    const nowPlayingTitle = document.querySelector(".now-playing-title")
    const nowPlayingDuration = document.querySelector(".now-playing-duration")
    const nowPlayingImg = document.querySelector(".now-playing-thumbnail")
    const nowPlayingContainer = document.querySelector(".now-playing")

    if (nowPlayingTitle) {
      const prefix = isDJMode ? "🎧 DJ: " : ""
      nowPlayingTitle.textContent = prefix + data.title
      console.log("📻 Now Playing atualizado:", prefix + data.title)
    }
    if (nowPlayingDuration) nowPlayingDuration.textContent = formatTime(duration)
    if (nowPlayingImg) {
      preloadImage(thumbnail, currentVideoId)
        .then((src) => (nowPlayingImg.src = src))
        .catch(() => (nowPlayingImg.src = getOptimizedThumbnail(currentVideoId, "low")))
    }

    if (nowPlayingContainer) {
      nowPlayingContainer.dataset.videoId = currentVideoId
      nowPlayingContainer.dataset.title = data.title || ""
      nowPlayingContainer.dataset.duration = formatTime(duration)
    }

    try {
      const epTitle = document.getElementById("ep-title")
      const epArtist = document.getElementById("ep-artist")
      const epArtwork = document.getElementById("ep-artwork")
      const epTotal = document.getElementById("ep-total")
      if (epTitle) epTitle.textContent = data.title
      if (epArtist) epArtist.textContent = data.author || ""
      if (epArtwork) {
        preloadImage(thumbnail, currentVideoId)
          .then((src) => (epArtwork.src = src))
          .catch(() => (epArtwork.src = getOptimizedThumbnail(currentVideoId, "low")))
      }
      if (epTotal) epTotal.textContent = formatTime(duration)
    } catch (e) {}
  } catch (error) {
    console.error("Erro ao atualizar reprodução atual:", error)
  }
}

const ExpandedPlayer = (() => {
  let el,
    btnClose,
    btnPlay,
    btnPrev,
    btnNext,
    btnFav,
    btnAdd,
    slider,
    timeCurrent,
    timeTotal,
    eventsBound = false,
    progressTimer = null

  function getElements() {
    el = document.getElementById("expanded-player")
    btnClose = document.getElementById("ep-close")
    btnPlay = document.getElementById("ep-play")
    btnPrev = document.getElementById("ep-prev")
    btnNext = document.getElementById("ep-next")
    btnFav = document.getElementById("ep-favorite")
    btnAdd = document.getElementById("ep-add")
    slider = document.getElementById("ep-slider")
    timeCurrent = document.getElementById("ep-current")
    timeTotal = document.getElementById("ep-total")
  }

  function setSliderPercent(p) {
    const percent = Math.min(100, Math.max(0, p || 0))
    if (slider) {
      slider.value = percent
      slider.style.background = `linear-gradient(90deg, #47ff8d ${percent}%, rgba(255,255,255,0.2) ${percent}%)`
    }
  }

  function attachEvents() {
    if (!el) return
    if (btnClose) btnClose.addEventListener("click", () => hide())
    if (btnPrev) btnPrev.addEventListener("click", () => {
      if (typeof MiniPlayer !== "undefined") MiniPlayer.previousTrack()
    })
    if (btnNext) btnNext.addEventListener("click", () => {
      if (typeof MiniPlayer !== "undefined") MiniPlayer.nextTrack()
    })
    if (btnPlay) btnPlay.addEventListener("click", () => {
      if (typeof MiniPlayer !== "undefined") MiniPlayer.togglePlayPause()
    })
    if (btnFav) btnFav.addEventListener("click", (e) => {
      e.stopPropagation()
      if (!currentVideoId || !player || !player.getVideoData) {
        showNotification("Nenhuma música tocando no momento", "warning")
        return
      }
      const isActive = btnFav.classList.contains("active")
      const data = player.getVideoData() || {}
      const title = data.title || "Música"
      const duration = formatTime(player.getDuration())
      const videoId = currentVideoId

      btnFav.classList.toggle("active")
      const action = isActive ? "removida dos" : "adicionada aos"
      showNotification(`Música ${action} favoritos`, isActive ? "info" : "success")

      fetch(`https://${safeGetParentResourceName()}/toggleFavorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          id: videoId,
          title,
          thumbnail: getOptimizedThumbnail(videoId, "medium"),
          duration,
        }),
      }).catch((error) => {
        console.error("Erro ao favoritar (expanded):", error)
        btnFav.classList.toggle("active")
        showNotification("Erro ao favoritar música", "error")
      })
    })
    if (btnAdd) btnAdd.addEventListener("click", (e) => {
      e.stopPropagation()
      const videoId = currentVideoId
      if (!videoId) {
        showNotification("Nenhuma música selecionada para adicionar", "warning")
        return
      }
      if (typeof showPlaylistSelector === "function") {
        showPlaylistSelector(videoId)
      } else {
        console.error("Função showPlaylistSelector não encontrada")
        showNotification("Não foi possível abrir o seletor de playlist", "error")
      }
    })
    if (slider) {
      slider.addEventListener("input", () => setSliderPercent(parseFloat(slider.value)))
      slider.addEventListener("change", () => {
        try {
          if (player && player.getDuration && player.seekTo) {
            const dur = player.getDuration() || 0
            const seekSec = (parseFloat(slider.value) / 100) * dur
            player.seekTo(seekSec, true)
          }
        } catch (_) {}
      })
    }
  }

  function startProgressLoop() {
    stopProgressLoop()
    progressTimer = setInterval(() => {
      if (el && el.classList.contains("open")) {
        updateFromPlayer()
      }
    }, 500)
  }
  function stopProgressLoop() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  }

  function show() {
    getElements()
    if (!el) return
    if (!eventsBound) {
      attachEvents()
      eventsBound = true
    }
    el.classList.add("open")
    updateFromPlayer()
    startProgressLoop()
  }
  function hide() {
    getElements()
    if (!el) return
    el.classList.remove("open")
    stopProgressLoop()
  }
  function updateFromPlayer() {
    try {
      if (!player || !player.getVideoData || !currentVideoId) return
      const d = player.getVideoData()
      const dur = player.getDuration() || 0
      const cur = player.getCurrentTime ? player.getCurrentTime() : 0
      const percent = dur ? (cur / dur) * 100 : 0
      setSliderPercent(percent)
      if (timeCurrent) timeCurrent.textContent = formatTime(cur)
      if (timeTotal) timeTotal.textContent = formatTime(dur)
      const playIcon = btnPlay?.querySelector(".ep-play-icon")
      const pauseIcon = btnPlay?.querySelector(".ep-pause-icon")
      if (playIcon && pauseIcon) {
        playIcon.style.display = isPlaying ? "none" : "block"
        pauseIcon.style.display = isPlaying ? "block" : "none"
      }
    } catch (_) {}
  }
  function updatePlayState(playing) {
    try {
      const playIcon = btnPlay?.querySelector(".ep-play-icon")
      const pauseIcon = btnPlay?.querySelector(".ep-pause-icon")
      if (playIcon && pauseIcon) {
        const state = typeof playing === "boolean" ? playing : isPlaying
        playIcon.style.display = state ? "none" : "block"
        pauseIcon.style.display = state ? "block" : "none"
      }
    } catch (_) {}
  }

  return { show, hide, updateFromPlayer, updatePlayState }
})()

document.addEventListener("DOMContentLoaded", () => {
  const np = document.querySelector(".now-playing")
  if (np) {
    np.addEventListener("click", () => {
      if (typeof ExpandedPlayer !== "undefined") ExpandedPlayer.show()
    })
  }
})

function updateDJModeUI() {
  const app = document.getElementById("app")
  const djIndicator = document.querySelector(".dj-mode-indicator")

  if (isDJMode && currentDJStation) {
    app.classList.add("dj-mode")

    if (!djIndicator) {
      const indicator = document.createElement("div")
      indicator.className = "dj-mode-indicator"
      indicator.innerHTML = `
                <div class="dj-icon">🎧</div>
                    <div class="dj-title">Modo DJ Ativo</div>
                    <div class="dj-station">${currentDJStation.stationData.name}</div>
                </div>
            `
      app.appendChild(indicator)
    } else {
      djIndicator.querySelector(".dj-station").textContent = currentDJStation.stationData.name
    }

    console.log("🎧 UI atualizada para modo DJ:", currentDJStation.stationData.name)
  } else {
    app.classList.remove("dj-mode")
    if (djIndicator) {
      djIndicator.remove()
    }
    console.log("🎵 UI restaurada para modo normal")
  }
}

function configurarBotoesAbas() {
  const botoes = document.querySelectorAll(".tab")

  botoes.forEach((botao) => {
    botao.removeEventListener("click", botaoClickHandler)
    botao.addEventListener("click", botaoClickHandler)
  })
}

function botaoClickHandler(e) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"))
  this.classList.add("active")

  const nomeAba = this.getAttribute("data-tab") || this.textContent.toLowerCase()
  currentTab = nomeAba

  console.log("Abrindo aba:", nomeAba)
  carregarConteudo(nomeAba)
}

function carregarConteudo(nomeAba) {
  const areaConteudo = document.querySelector(".grid")

  if (dataCache[nomeAba] && dataCache[nomeAba].length > 0) {
    console.log("Carregando da cache:", nomeAba)
    if (nomeAba === "musicas") {
      exibirMusicas(dataCache[nomeAba], "history")
    } else if (nomeAba === "favoritos") {
      exibirPlaylists(dataCache[nomeAba])
    } else if (nomeAba === "curtidas") {
      exibirMusicas(dataCache[nomeAba], "favorites")
    }
    return
  }

  const currentClass = areaConteudo.className || "grid"
  areaConteudo.innerHTML = `<div class="loading">Carregando ${nomeAba}...</div>`

  if (nomeAba === "musicas") {
    console.log("Solicitando histórico...")
    fetch(`https://${safeGetParentResourceName()}/getHistory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch((error) => {
      console.error("Erro ao carregar histórico:", error)
      carregarHistoricoMusicas()
    })
  } else if (nomeAba === "favoritos") {
    console.log("Solicitando playlists...")
    loadPlaylists()
  } else if (nomeAba === "curtidas") {
    console.log("Solicitando favoritos...")
    loadFavorites()
  }
}

function carregarHistoricoMusicas() {
  try {
    const historico = JSON.parse(localStorage.getItem("trackHistory") || "[]")
    dataCache.musicas = historico
    if (currentTab === "musicas") {
      exibirMusicas(historico, "history")
    }
  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro)
    mostrarErro("Não foi possível carregar o histórico de músicas.")
  }
}

function mostrarErro(mensagem) {
  const areaConteudo = document.querySelector(".grid")
  areaConteudo.innerHTML = `
        <div class="error-state">
            <p>${mensagem}</p>
            <button onclick="carregarConteudo(currentTab)">Tentar novamente</button>
        </div>
    `
}

function exibirMusicas(musicas, tipo) {
  const areaConteudo = document.querySelector(".grid")
  
  const listMode = (currentTab === "musicas") || (tipo === "musicas") || (tipo === "history" && currentTab === "musicas")
  areaConteudo.className = listMode ? "grid tracks-list" : "grid tracks-grid"

  if (!Array.isArray(musicas) || musicas.length === 0) {
    areaConteudo.innerHTML = `
            <div class="empty-state">
                ${
                  tipo === "history"
                    ? "Você ainda não assistiu nenhum vídeo. Pesquise alguma música para começar."
                    : tipo === "favorites"
                      ? "Você ainda não marcou nenhum favorito. Clique no coração para adicionar."
                      : "Nenhuma música encontrada nesta categoria."
                }
            </div>
        `
    return
  }

  const isFavoritos = tipo === "favorites"
  const isPlaylist = tipo === "playlist"
  const isListView = (currentTab === "musicas") || (tipo === "musicas") || (tipo === "history" && currentTab === "musicas")

  const html = musicas
    .map((musica) => {
      const videoId = musica.videoId || musica.id
      const optimizedThumbnail = getOptimizedThumbnail(videoId, "medium")
      const fallbackThumbnail = getOptimizedThumbnail(videoId, "low")

      if (isListView) {
        return `
          <div class="track-row" data-video-id="${videoId}">
            <div class="thumb">
              <img 
                class="lazy-image" 
                data-src="${optimizedThumbnail}" 
                data-video-id="${videoId}"
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='112' height='63'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3C/text%3E%3C/svg%3E"
                alt="${musica.title}" 
                onerror="this.src='${fallbackThumbnail}'"
                loading="lazy"
              >
            </div>
            <div class="info">
              <h3 class="track-title">${musica.title}</h3>
              <p class="track-duration">${musica.duration || "--:--"}</p>
            </div>
            <div class="actions">
              <button class="favorite ${isFavoritos ? "active" : ""}">${isFavoritos ? "❤️" : "🤍"}</button>
              <button class="add-to-playlist">+</button>
            </div>
          </div>
        `
      }

      return `
        <div class="track-card" data-video-id="${videoId}">
          <img 
            class="lazy-image" 
            data-src="${optimizedThumbnail}" 
            data-video-id="${videoId}"
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666'%3ECarregando...%3C/text%3E%3C/svg%3E"
            alt="${musica.title}" 
            onerror="this.src='${fallbackThumbnail}'"
            loading="lazy"
          >
          <div class="info">
            <h3>${musica.title}</h3>
            <p>${musica.duration || "--:--"}</p>
          </div>
          <div class="buttons">
            <button class="favorite ${isFavoritos ? "active" : ""}">${isFavoritos ? "❤️" : "🤍"}</button>
            <button class="add-to-playlist">+</button>
            ${isPlaylist ? '<button class="remove-from-playlist" title="Remover da playlist">🗑</button>' : ''}
          </div>
        </div>
      `
    })
    .join("")

  areaConteudo.innerHTML = html

  const imageObserver = setupLazyLoading()
  document.querySelectorAll(".lazy-image").forEach((img) => {
    imageObserver.observe(img)
  })

  addTrackCardListeners()
}

function exibirPlaylists(playlists) {
  const areaConteudo = document.querySelector(".grid")
  
  areaConteudo.className = "grid playlists-grid"

  if (!Array.isArray(playlists) || playlists.length === 0) {
    areaConteudo.innerHTML = `
            <div class="empty-state">
                <p>Você ainda não criou nenhuma playlist.</p>
                <button class="create-playlist-btn">Criar uma playlist</button>
            </div>
        `

    const createBtn = areaConteudo.querySelector(".create-playlist-btn")
    if (createBtn) {
      createBtn.addEventListener("click", () => {
        const modal = document.createElement("div")
        modal.className = "playlist-modal"
        modal.innerHTML = `
                    <div class="playlist-selector">
                        <h3>Criar Nova Playlist</h3>
                        <div class="new-playlist">
                            <input type="text" placeholder="Nome da nova playlist">
                            <button>Criar</button>
                        </div>
                    </div>
                `
        document.body.appendChild(modal)

        const createButton = modal.querySelector(".new-playlist button")
        const nameInput = modal.querySelector(".new-playlist input")

        createButton.addEventListener("click", () => {
          const name = nameInput.value.trim()
          if (name) {
            fetch(`https://${safeGetParentResourceName()}/createPlaylist`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            }).catch((error) => console.error("Erro ao criar playlist:", error))

            modal.remove()
          }
        })

        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            modal.remove()
          }
        })
      })
    }

    return
  }

  const html = playlists
    .map(
      (playlist) => `
        <div class="playlist-card" data-playlist-id="${playlist.id}">
            <div class="playlist-cover" style="${playlist.thumbnail ? `background-image: url('${playlist.thumbnail}')` : ''}">
                ${playlist.thumbnail ? '' : `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12 13V5M1 5v14l4-4h4"/>
                </svg>`}
            </div>
            <div class="playlist-info">
                <div class="playlist-meta">
                    <h3>${playlist.name}</h3>
                    <p>Playlist</p>
                </div>
                <button class="delete-playlist" data-playlist-id="${playlist.id}" title="Excluir playlist">🗑</button>
            </div>
        </div>
    `,
    )
    .join("")

  areaConteudo.innerHTML = html

  document.querySelectorAll(".playlist-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      if (e.target && e.target.classList.contains("delete-playlist")) return
      const playlistId = this.dataset.playlistId
      currentPlaylistId = playlistId
      fetch(`https://${safeGetParentResourceName()}/getPlaylistVideos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId }),
      }).catch((error) => console.error("Erro ao carregar vídeos da playlist:", error))
    })
  })

  document.querySelectorAll(".delete-playlist").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation()
      const playlistId = this.dataset.playlistId
      if (!playlistId) return
      deletePlaylist(playlistId)
    })
  })
}

function addTrackCardListeners() {
  document.querySelectorAll(".track-card, .track-row").forEach((card) => {
    const videoId = card.dataset.videoId
    const title = card.querySelector("h3")?.textContent
    const thumbnail = card.querySelector("img")?.src
    const durationEl = card.querySelector("p")
    const duration = durationEl ? durationEl.textContent.split("•").pop().trim() : ""

    if (!videoId || !title || !thumbnail) return

    card.removeEventListener("click", handleCardClick)
    card.querySelector(".favorite")?.removeEventListener("click", handleFavoriteClick)
    card.querySelector(".add-to-playlist")?.removeEventListener("click", handleAddToPlaylist)
    card.querySelector(".remove-from-playlist")?.removeEventListener("click", handleRemoveFromPlaylist)

    card.addEventListener("click", handleCardClick)
    card.querySelector(".favorite")?.addEventListener("click", handleFavoriteClick)
    card.querySelector(".add-to-playlist")?.addEventListener("click", handleAddToPlaylist)
    card.querySelector(".remove-from-playlist")?.addEventListener("click", handleRemoveFromPlaylist)

    function handleCardClick(e) {
      if (
        e.target.classList.contains("favorite") ||
        e.target.classList.contains("add-to-playlist") ||
        e.target.classList.contains("remove-from-playlist")
      ) return

      resumeAudioContext()

      try {
        console.log("=== CARD CLICK ===")
        console.log("Modo DJ ativo:", isDJMode)
        console.log("Estação DJ atual:", currentDJStation)

        const trackData = {
          videoId,
          title,
          thumbnail: getOptimizedThumbnail(videoId, "medium"),
          duration,
        }

        if (isDJMode && currentDJStation) {
          console.log("🎧 MODO DJ DETECTADO - Enviando para playDJTrack")

          trackData.stationIndex = currentDJStation.stationIndex
          trackData.stationData = currentDJStation.stationData

          console.log("🎧 Dados sendo enviados:", trackData)

          fetch(`https://${safeGetParentResourceName()}/playDJTrack`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trackData),
          })
            .then((response) => {
              console.log("🎧 Resposta do servidor DJ:", response.status)
              if (response.ok) {
                isPlaying = true
                currentVideoId = videoId
                playVideo(videoId)
                updateNowPlaying()

                if (!miniPlayerVisible) {
                  MiniPlayer.show()
                }
              }
              return response.text()
            })
            .then((data) => {
              console.log("🎧 Dados da resposta:", data)
            })
            .catch((error) => {
              console.error("❌ Erro ao tocar música de DJ:", error)
            })
        } else {
          console.log("🎵 MODO NORMAL - Usando playTrack")

          currentVideoId = videoId
          currentTrackIndex = playlist.findIndex((track) => track.id === videoId)
          playVideo(videoId)

          fetch(`https://${safeGetParentResourceName()}/playTrack`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trackData),
          }).catch((error) => console.error("Erro ao tocar música:", error))

          if (!miniPlayerVisible) {
            MiniPlayer.show()
          }
        }

        saveToHistory(trackData)
      } catch (error) {
        console.error("Erro em handleCardClick:", error)
      }
    }

    function handleFavoriteClick(e) {
      e.stopPropagation()
      const btn = e.target
      const card = btn.closest('.track-card, .track-row')
      const isActive = btn.classList.contains("active")

      const cardVideoId = card.dataset.videoId || videoId
      const cardTitle = card.querySelector('.track-title')?.textContent || title
      const cardDuration = card.querySelector('.track-duration')?.textContent || duration

      btn.textContent = isActive ? "🤍" : "❤️"
      btn.classList.toggle("active")

      const action = isActive ? 'removida dos' : 'adicionada aos'
      showNotification(`Música ${action} favoritos`, isActive ? 'info' : 'success')

      fetch(`https://${safeGetParentResourceName()}/toggleFavorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: cardVideoId,
          id: cardVideoId,
          title: cardTitle,
          thumbnail: getOptimizedThumbnail(cardVideoId, "medium"),
          duration: cardDuration,
        }),
      }).catch((error) => {
        console.error("Erro ao favoritar:", error)
        btn.textContent = isActive ? "❤️" : "🤍"
        btn.classList.toggle("active")
        showNotification('Erro ao favoritar música', 'error')
      })
    }

    function handleAddToPlaylist(e) {
      e.stopPropagation()
      
      const trackCard = e.target.closest('.track-card, .track-row')
      if (!trackCard) {
        console.error('Track card não encontrado')
        return
      }
      
      const videoId = trackCard.dataset.videoId
      if (!videoId) {
        console.error('VideoId não encontrado no track card')
        return
      }
      
      if (typeof showPlaylistSelector === "function") {
        showPlaylistSelector(videoId)
      } else {
        console.error('Função showPlaylistSelector não encontrada')
      }
    }

    function handleRemoveFromPlaylist(e) {
      e.stopPropagation()
      if (!currentPlaylistId) {
        showNotification("Playlist não identificada.", "error")
        return
      }
      const confirmRemove = confirm("Remover esta música da playlist?")
      if (!confirmRemove) return
      removeFromPlaylist(currentPlaylistId, videoId)
    }
  })
}

function removeFromPlaylist(playlistId, videoId) {
  fetch(`https://${safeGetParentResourceName()}/removeFromPlaylist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlistId, videoId }),
  })
    .then((response) => {
      if (response.ok) {
        showNotification("Música removida da playlist.")
        loadPlaylistVideos(playlistId)
      } else {
        showNotification("Erro ao remover música da playlist.", "error")
      }
    })
    .catch((error) => {
      console.error("Erro ao remover da playlist:", error)
      showNotification("Erro ao remover música da playlist.", "error")
    })
}

function deletePlaylist(playlistId) {
  fetch(`https://${safeGetParentResourceName()}/deletePlaylist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlistId }),
  })
    .then((response) => {
      if (response.ok) {
        showNotification("Playlist excluída.")
        loadPlaylists()
      } else {
        showNotification("Erro ao excluir playlist.", "error")
      }
    })
    .catch((error) => {
      console.error("Erro ao excluir playlist:", error)
      showNotification("Erro ao excluir playlist.", "error")
    })
}

const MusicSystem = {
  playDJTrack: (data) => {
    console.log("🎧 MusicSystem.playDJTrack chamado:", data)

    return fetch(`https://${safeGetParentResourceName()}/playDJTrack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((response) => {
        console.log("🎧 Resposta playDJTrack:", response.status)
        if (response.ok) {
          isPlaying = true
          fetch(`https://${safeGetParentResourceName()}/saveToHistory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: data.videoId }),
          }).catch(console.error)

          fetch(`https://${safeGetParentResourceName()}/saveVideo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: data.videoId,
              title: data.title,
              thumbnail: data.thumbnail,
              duration: data.duration,
            }),
          }).catch(console.error)
        }
        return response
      })
      .catch((error) => {
        console.error("❌ Erro em playDJTrack:", error)
        throw error
      })
  },

  pauseDJTrack: (data) => {
    console.log("🎧 MusicSystem.pauseDJTrack chamado:", data)

    return fetch(`https://${safeGetParentResourceName()}/pauseDJTrack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((response) => {
        console.log("🎧 Resposta pauseDJTrack:", response.status)
        if (response.ok) {
          isPlaying = false
          MiniPlayer.hide()
        }
        return response
      })
      .catch((error) => {
        console.error("❌ Erro em pauseDJTrack:", error)
        throw error
      })
  },

  pauseTrack: () => {
    console.log("🎵 MusicSystem.pauseTrack chamado")

    fetch(`https://${safeGetParentResourceName()}/deleteProp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(console.error)

    return fetch(`https://${safeGetParentResourceName()}/pauseTrack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((response) => {
        console.log("🎵 Resposta pauseTrack:", response.status)
        if (response.ok) {
          isPlaying = false
          MiniPlayer.hide()
        }
        return response
      })
      .catch((error) => {
        console.error("❌ Erro em pauseTrack:", error)
        throw error
      })
  },
}

function loadFavorites() {
  console.log("Solicitando favoritos do servidor...")
  fetch(`https://${safeGetParentResourceName()}/getFavorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).catch((error) => console.error("Erro ao carregar favoritos:", error))
}

function createNewPlaylist(name) {
  if (!name || name.trim() === "") return

  fetch(`https://${safeGetParentResourceName()}/createPlaylist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  }).catch((error) => console.error("Erro ao criar playlist:", error))
}

function loadPlaylists() {
  console.log("Solicitando playlists do servidor...")
  fetch(`https://${safeGetParentResourceName()}/getPlaylists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).catch((error) => console.error("Erro ao carregar playlists:", error))
}

function loadPlaylistVideos(playlistId) {
  console.log("Solicitando vídeos da playlist: " + playlistId)
  fetch(`https://${safeGetParentResourceName()}/getPlaylistVideos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlistId }),
  }).catch((error) => console.error("Erro ao carregar vídeos da playlist:", error))
}

const CACHE_NAME = "youtube_search_cache_v3"
const CACHE_EXPIRATION_HOURS = 6
const MAX_CACHE_ITEMS = 200

const sessionCache = new Map()
const searchQueue = new Map()

const INVIDIOUS_INSTANCES = [
  "https://iv.melmac.space",
]

const LOCAL_SEARCH_DATA = {
  mc: [
    {
      id: "dQw4w9WgXcQ",
      title: "MC Test - Música Exemplo",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      author: "MC Artista",
      duration: "3:32",
      views: 1000000,
    },
  ],
  funk: [
    {
      id: "dQw4w9WgXcQ",
      title: "Funk Exemplo - Batida Pesada",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      author: "Funk Artist",
      duration: "2:45",
      views: 500000,
    },
  ],
  ryan: [
    {
      id: "dQw4w9WgXcQ",
      title: "MC Ryan - Exemplo",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      author: "MC Ryan",
      duration: "3:15",
      views: 2000000,
    },
  ],
}

async function searchYouTubeWithCache(query) {
  if (!query?.trim()) return []

  const normalizedQuery = query.toLowerCase().trim()

  if (sessionCache.has(normalizedQuery)) {
    console.log("[Cache] Retornando da sessão:", query)
    return sessionCache.get(normalizedQuery)
  }

  if (searchQueue.has(normalizedQuery)) {
    console.log("[Cache] Aguardando busca em andamento:", query)
    return await searchQueue.get(normalizedQuery)
  }

  const cachedResults = await getFromCache(normalizedQuery)
  if (cachedResults) {
    console.log("[Cache] Retornando do armazenamento:", query)
    sessionCache.set(normalizedQuery, cachedResults)
    return cachedResults
  }

  console.log("[API] Buscando online:", query)
  const searchPromise = tryInvidiousAPI(query)
  searchQueue.set(normalizedQuery, searchPromise)

  try {
    const results = await searchPromise
    searchQueue.delete(normalizedQuery)

    if (results?.length > 0) {
      sessionCache.set(normalizedQuery, results)
      await saveToCache(normalizedQuery, results)
      return results
    } else {
      console.log("[Fallback] Tentando busca local para:", query)
      const localResults = tryLocalSearch(query)
      if (localResults.length > 0) {
        sessionCache.set(normalizedQuery, localResults)
        return localResults
      }
    }

    return []
  } catch (error) {
    searchQueue.delete(normalizedQuery)
    console.error("Erro na busca:", error)

    console.log("[Fallback] API falhou, tentando busca local para:", query)
    const localResults = tryLocalSearch(query)
    if (localResults.length > 0) {
      sessionCache.set(normalizedQuery, localResults)
      return localResults
    }

    return []
  }
}

function tryLocalSearch(query) {
  const normalizedQuery = query.toLowerCase().trim()
  const results = []

  for (const [key, data] of Object.entries(LOCAL_SEARCH_DATA)) {
    if (normalizedQuery.includes(key) || key.includes(normalizedQuery)) {
      results.push(...data)
    }
  }

  if (results.length === 0) {
    results.push({
      id: "dQw4w9WgXcQ",
      title: `Resultado para "${query}"`,
      thumbnail: getOptimizedThumbnail("dQw4w9WgXcQ", "medium"),
      author: "Artista Desconhecido",
      duration: "3:00",
      views: 100000,
    })
  }

  return results.slice(0, 10)
}

async function getFromCache(query) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_NAME) || "{}")
    const cachedData = cache[query]

    if (!cachedData) return null

    const cacheAge = (Date.now() - cachedData.timestamp) / (1000 * 60 * 60)
    if (cacheAge > CACHE_EXPIRATION_HOURS) {
      delete cache[query]
      localStorage.setItem(CACHE_NAME, JSON.stringify(cache))
      return null
    }

    return cachedData.results
  } catch (error) {
    console.warn("Erro ao acessar cache:", error)
    return null
  }
}

async function saveToCache(query, results) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_NAME) || "{}")

    const keys = Object.keys(cache)
    if (keys.length >= MAX_CACHE_ITEMS) {
      const oldest = keys
        .map((key) => ({ key, timestamp: cache[key].timestamp }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, Math.floor(MAX_CACHE_ITEMS * 0.3))

      oldest.forEach((item) => delete cache[item.key])
    }

    cache[query] = {
      results,
      timestamp: Date.now(),
    }

    localStorage.setItem(CACHE_NAME, JSON.stringify(cache))
  } catch (error) {
    console.warn("Erro ao salvar no cache:", error)
  }
}

async function tryInvidiousAPI(query) {
  const promises = INVIDIOUS_INSTANCES.map(async (instance, index) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance&region=BR`

      console.log(`[API] Tentando instância ${index + 1}/${INVIDIOUS_INSTANCES.length}: ${instance}`)

      const response = await fetch(url, {
        signal: controller.signal,
        referrerPolicy: "no-referrer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Nenhum resultado encontrado")
      }

      const results = data
        .filter((video) => video.videoId && video.title && video.lengthSeconds > 0)
        .map((video) => ({
          id: video.videoId,
          title: video.title,
          thumbnail: getBestThumbnail(video),
          author: video.author || "Artista Desconhecido",
          duration: formatDuration(video.lengthSeconds),
          views: video.viewCount || 0,
        }))
        .slice(0, 20)

      console.log(`[API] ✅ Sucesso com ${instance} - ${results.length} resultados`)
      return results
    } catch (error) {
      console.log(`[API] ❌ Falha com ${instance}: ${error.message}`)
      throw new Error(`${instance}: ${error.message}`)
    }
  })

  try {
    return await Promise.any(promises)
  } catch (error) {
    console.error("[API] ❌ Todas as instâncias falharam")
    throw new Error("Todas as instâncias falharam")
  }
}

function getBestThumbnail(video) {
  if (video.videoThumbnails && video.videoThumbnails.length > 0) {
    const priorities = ["medium", "high", "default"]

    for (const quality of priorities) {
      const thumb = video.videoThumbnails.find((t) => t.quality === quality)
      if (thumb && thumb.url) return thumb.url
    }

    const firstThumb = video.videoThumbnails[0]
    if (firstThumb && firstThumb.url) return firstThumb.url
  }

  return getOptimizedThumbnail(video.videoId, "medium")
}

function formatDuration(seconds) {
  if (!seconds) return "00:00"
  const date = new Date(0)
  date.setSeconds(seconds)
  return date.toISOString().substring(11, 19).replace(/^00:/, "")
}

window.youtubeSearch = {
  search: searchYouTubeWithCache,
  clearCache: async () => {
    sessionCache.clear()
    searchQueue.clear()
    localStorage.removeItem(CACHE_NAME)
  },
}

function formatTime(seconds) {
  if (!seconds) return "0:00"
  seconds = Math.floor(seconds)
  const minutes = Math.floor(seconds / 60)
  seconds = seconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function updateSliderBackground(slider) {
  const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100
  slider.style.background = `linear-gradient(to right, #1DB954 0%, #1DB954 ${value}%, #282828 ${value}%, #282828 100%)`
}

window.debugDJ = () => {
  console.log("=== DEBUG DJ ===")
  console.log("isDJMode:", isDJMode)
  console.log("currentDJStation:", currentDJStation)
  console.log("isPlaying:", isPlaying)
  console.log("currentVideoId:", currentVideoId)
  console.log("player:", player)
  console.log("===============")
}

window.debugMiniPlayer = () => {
  console.log("=== MINI PLAYER DEBUG ===")
  console.log("Visible:", miniPlayerVisible)
  console.log("DJ Mode:", isDJMode)
  console.log("Playing:", miniIsPlaying)
  console.log("Track Data:", miniCurrentTrackData)
  console.log("Should Show:", MiniPlayer.shouldShow())
  console.log("========================")
}

window.debugSearch = async (query) => {
  console.log("=== SEARCH DEBUG ===")
  console.log("Query:", query)
  console.log("Cache em memória:", sessionCache.has(query?.toLowerCase()))
  console.log("Cache localStorage:", await getFromCache(query?.toLowerCase()))

  try {
    const results = await searchYouTubeWithCache(query)
    console.log("Resultados:", results.length)
    console.log("Primeiro resultado:", results[0])
  } catch (error) {
    console.error("Erro na busca:", error)
  }
  console.log("==================")
}

document.addEventListener("DOMContentLoaded", () => {
  loadYouTubeAPI()
  const app = document.getElementById("app")

  initAudioContext()

  userId = localStorage.getItem("userId")
  if (!userId) {
    userId = "1"
    localStorage.setItem("userId", userId)
  }

  const searchInput = document.querySelector(".search-bar input")
  const gridContainer = document.querySelector(".grid")

  let searchTimeout
  let lastSearchQuery = ""

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout)
    const query = e.target.value.trim()

    if (query === lastSearchQuery) return

    searchTimeout = setTimeout(async () => {
      if (query.length > 2) {
        lastSearchQuery = query

        gridContainer.innerHTML = `
          <div class="loading-search">
            <div class="spinner"></div>
            <p>Buscando "${query}"...</p>
          </div>
        `

        try {
          const results = await window.youtubeSearch.search(query)

          if (!Array.isArray(results)) {
            console.error("Resultados inválidos:", results)
            return
          }

          playlist = results

          gridContainer.className = "grid tracks-list"
          gridContainer.innerHTML = results
            .map((item) => {
              const optimizedThumbnail = getOptimizedThumbnail(item.id, "medium")
              const fallbackThumbnail = getOptimizedThumbnail(item.id, "low")

              return `
                <div class="track-row" data-video-id="${item.id}">
                  <div class="thumb">
                    <img 
                      class="lazy-image search-result-img" 
                      data-src="${optimizedThumbnail}" 
                      data-video-id="${item.id}"
                      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='112' height='63'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3C/svg%3E"
                      alt="${item.title}" 
                      onerror="this.src='${fallbackThumbnail}'"
                      loading="lazy"
                    >
                  </div>
                  <div class="info">
                    <h3 class="track-title">${item.title}</h3>
                    <p class="track-duration">${item.author} • ${item.duration}</p>
                  </div>
                  <div class="actions">
                    <button class="favorite">🤍</button>
                    <button class="add-to-playlist">+</button>
                  </div>
                </div>
              `
            })
            .join("")

          const imageObserver = setupLazyLoading()
          document.querySelectorAll(".search-result-img").forEach((img) => {
            imageObserver.observe(img)
          })

          addTrackCardListeners()

          results.slice(0, 5).forEach((item) => {
            preloadImage(getOptimizedThumbnail(item.id, "medium"), item.id).catch(() => {})
          })
        } catch (error) {
          console.error("Erro na pesquisa:", error)
          gridContainer.innerHTML = `
            <div class="error-message">
                <p>Não foi possível carregar os resultados. Verifique sua conexão ou tente novamente mais tarde.</p>
                <button onclick="searchInput.dispatchEvent(new Event('input'))">Tentar novamente</button>
            </div>
          `
        }
      } else if (query.length === 0) {
        lastSearchQuery = ""
        clearTimeout(searchTimeout)
        searchInput.value = ""
        gridContainer.innerHTML = ""
        try {
          carregarConteudo(currentTab || "musicas")
        } catch (err) {
          console.warn("Falha ao recarregar conteúdo após limpar busca:", err)
        }
      }
    }, 300)
  })

  const clearButton = document.querySelector(".search-clear")
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      try {
        clearTimeout(searchTimeout)
        searchInput.value = ""
        lastSearchQuery = ""
        gridContainer.innerHTML = ""
        carregarConteudo(currentTab || "musicas")
        searchInput.focus()
      } catch (err) {
        console.error("Erro ao limpar busca:", err)
      }
    })
  }

  const bluetoothBtn = document.querySelector(".bluetooth-btn")
  const iconSpan = bluetoothBtn.querySelector(".icon-svg")

  const svgSound = `
    <svg xmlns="http://www.w3.org/2000/svg" class="sound-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
    `

  const svgBluetooth = `
    <svg xmlns="http://www.w3.org/2000/svg" class="bluetooth-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"></polyline>
    </svg>
    `

  bluetoothBtn.addEventListener("click", () => {
    fetch(`https://${safeGetParentResourceName()}/toggleBluetooth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          bluetoothBtn.classList.toggle("active", data.mode === "car")
          iconSpan.innerHTML = data.mode === "car" ? svgBluetooth : svgSound
        }
      })
  })

  const volumeBtn = document.querySelector(".volume-btn")
  const allVolumeSliders = Array.from(document.querySelectorAll(".volume-slider, .ep-volume-slider"))

  const syncVolumeUI = (vol) => {
    allVolumeSliders.forEach((s) => {
      s.value = vol
      if (typeof updateSliderBackground === "function") updateSliderBackground(s)
    })
    const epVal = document.querySelector(".ep-volume-value")
    if (epVal) epVal.textContent = `${Math.round(vol)}%`
    updateVolumeIcon(vol)
  }

  syncVolumeUI(savedVolume)

  allVolumeSliders.forEach((slider) => {
    slider.addEventListener("input", (e) => {
      const volume = Number.parseInt(e.target.value, 10)
      savedVolume = volume
      if (player && player.setVolume) {
        player.setVolume(isGlobalMuted ? 0 : volume)
      }
      syncVolumeUI(volume)
    })
  })

  if (volumeBtn) {
    volumeBtn.addEventListener("click", () => {
      const primarySlider = document.querySelector(".volume-slider") || document.querySelector(".ep-volume-slider")
      if (!primarySlider) return
      const currentVolume = Number.parseInt(primarySlider.value, 10)
      if (currentVolume > 0) {
        primarySlider.dataset.lastVolume = currentVolume
        syncVolumeUI(0)
      } else {
        const last = Number.parseInt(primarySlider.dataset.lastVolume || savedVolume, 10)
        syncVolumeUI(last)
      }
      const newVolume = Number.parseInt(document.querySelector(".volume-slider")?.value || document.querySelector(".ep-volume-slider")?.value || savedVolume, 10)
      if (player && player.setVolume) {
        player.setVolume(isGlobalMuted ? 0 : newVolume)
      }
      savedVolume = newVolume
    })
  }

  document.getElementById("previous")?.addEventListener("click", playPreviousTrack)
  document.getElementById("next")?.addEventListener("click", playNextTrack)

  function dragStart(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return

    initialX = e.clientX - xOffset
    initialY = e.clientY - yOffset

    if (e.target.closest("#app")) {
      isDragging = true
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault()
      currentX = e.clientX - initialX
      currentY = e.clientY - initialY
      xOffset = currentX
      yOffset = currentY
      setTranslate(currentX, currentY, app)
    }
  }

  function dragEnd() {
    initialX = currentX
    initialY = currentY
    isDragging = false
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`
  }

  app.addEventListener("mousedown", dragStart)
  document.addEventListener("mousemove", drag)
  document.addEventListener("mouseup", dragEnd)

  const playPauseBtn = document.getElementById("play-pause")
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      if (!player || !currentVideoId) return

      if (isPlaying) {
        player.pauseVideo()
        playPauseBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5V19L19 12L8 5Z"/>
            </svg>
        `
        isPlaying = false

        MiniPlayer.hide()

        if (isDJMode && currentDJStation) {
          MusicSystem.pauseDJTrack({
            stationIndex: currentDJStation.stationIndex,
          })
        } else {
          MusicSystem.pauseTrack()
        }
      } else {
        player.playVideo()
        try { resumeAudioContext() } catch (e) {}

        try {
          fetch(`https://${safeGetParentResourceName()}/resumePlayback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }).catch(() => {})
        } catch (_) {}
        playPauseBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
        `
        isPlaying = true

        if (MiniPlayer.shouldShow()) {
          MiniPlayer.show()
        }
      }
    })
  }

  const progress = document.querySelector(".progress")
  if (progress) {
    progress.addEventListener("click", function (e) {
      if (!player || !currentVideoId) return

      const progressBar = this.getBoundingClientRect()
      const percent = (e.clientX - progressBar.left) / progressBar.width
      const duration = player.getDuration()
      player.seekTo(duration * percent, true)

      const progressFilled = document.querySelector(".progress-filled")
      if (progressFilled) {
        progressFilled.style.width = `${percent * 100}%`
      }
    })
  }

  setInterval(() => {
    if (!player || !player.getCurrentTime || !isPlaying) return

    try {
      const currentTime = player.getCurrentTime()
      const duration = player.getDuration()
      if (!currentTime || !duration) return

      const percent = (currentTime / duration) * 100

      const progressFilled = document.querySelector(".progress-filled")
      const currentTimeEl = document.querySelector(".time.current")
      const totalTimeEl = document.querySelector(".time.total")

      if (progressFilled) progressFilled.style.width = `${percent}%`
      if (currentTimeEl) currentTimeEl.textContent = formatTime(currentTime)
      if (totalTimeEl) totalTimeEl.textContent = formatTime(duration)

      if (miniPlayerVisible && MiniPlayer.shouldShow()) {
        const miniProgressFill = document.getElementById("mini-progress-fill")
        if (miniProgressFill) {
          miniProgressFill.style.width = `${percent}%`
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar progresso:", error)
    }
  }, 1000)

  window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return

    switch (event.data.type) {
      case "ui":
        if (event.data.status) {
          app.classList.add("visible")
          currentTab = "musicas"
          document.querySelectorAll(".tab").forEach((tab) => {
            tab.classList.remove("active")
            if (tab.getAttribute("data-tab") === "musicas" || tab.textContent.toLowerCase() === "músicas") {
              tab.classList.add("active")
            }
          })
          carregarConteudo("musicas")
          MiniPlayer.hide()
        } else {
          app.classList.remove("visible")
          isDJMode = false
          currentDJStation = null
          updateDJModeUI()

          setTimeout(() => {
            console.log("🔍 UI fechada - verificando se deve mostrar mini player:")
            console.log("  - isPlaying:", isPlaying)
            console.log("  - currentVideoId:", currentVideoId)
            console.log("  - shouldShow:", MiniPlayer.shouldShow())

            if (MiniPlayer.shouldShow()) {
              console.log("✅ Mostrando mini player após fechar UI")
              MiniPlayer.show()
            } else {
              console.log("🚫 Mini player não mostrado - música não está tocando")
            }
          }, 500)
        }
        break

      case "setUIImages": {
        try {
          const bannerUrl = event.data.bannerUrl
          const avatarUrl = event.data.avatarUrl

          if (bannerUrl) {
            const header = document.querySelector('.drag-header')
            if (header) {
              header.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('${bannerUrl}')`
              header.style.backgroundSize = 'cover'
              header.style.backgroundPosition = 'center'
              header.style.backgroundRepeat = 'no-repeat'
            }
          }

          if (avatarUrl) {
            const profilePicEl = document.querySelector('.profile-pic')
            if (profilePicEl) {
              if (profilePicEl.tagName === 'IMG') {
                profilePicEl.src = avatarUrl
                profilePicEl.onerror = function () {
                  this.src = 'https://i.ibb.co/XghQBGw/unknown.png'
                }
              } else {
                profilePicEl.style.backgroundImage = `url('${avatarUrl}')`
              }
            }
          }
        } catch (e) {
          console.error('Erro ao aplicar setUIImages:', e)
        }
        break
      }
        break

      case "setDJMode":
        console.log("📨 Recebido setDJMode:", event.data)

        isDJMode = event.data.enabled
        currentDJStation = event.data.enabled
          ? {
              stationIndex: event.data.stationIndex,
              stationData: event.data.stationData,
            }
          : null

        console.log("🎧 Modo DJ definido:", isDJMode, currentDJStation)
        updateDJModeUI()
        if (miniPlayerVisible) {
          MiniPlayer.updateTrack()
        }
        break

      case "setGlobalMute":
        isGlobalMuted = event.data.muted

        if (player && player.setVolume) {
          const currentVol = Math.min(100, Math.max(0, Number.parseInt(document.querySelector(".volume-slider")?.value || document.querySelector(".ep-volume-slider")?.value || savedVolume || 50, 10)))
          player.setVolume(isGlobalMuted ? 0 : currentVol)
        }

        for (const sourceId in externalPlayers) {
          if (externalPlayers[sourceId].player && externalPlayers[sourceId].player.setVolume) {
            externalPlayers[sourceId].player.setVolume(isGlobalMuted ? 0 : externalPlayers[sourceId].volume)
          }
        }

        for (const stationId in djPlayers) {
          if (djPlayers[stationId].player && djPlayers[stationId].player.setVolume) {
            djPlayers[stationId].player.setVolume(isGlobalMuted ? 0 : djPlayers[stationId].volume)
          }
        }

        updateVolumeIcon(Number.parseInt(document.querySelector(".volume-slider")?.value || 50))
        break

      case "showMiniPlayer":
        console.log("📨 Recebido showMiniPlayer:", event.data)
        if (event.data.isPlaying) {
          try {
            const miniPlayerElement = document.getElementById("mini-player")
            if (miniPlayerElement) {
              const miniTitle = document.getElementById("mini-title")
              const miniArtist = document.getElementById("mini-artist")
              const miniArtwork = document.getElementById("mini-artwork-img")

              if (event.data.trackData) {
                if (miniTitle) miniTitle.textContent = event.data.trackData.title
                if (miniArtist) miniArtist.textContent = event.data.trackData.artist || "Artista Desconhecido"
                if (miniArtwork) miniArtwork.src = event.data.trackData.thumbnail
              }

              miniPlayerElement.classList.toggle("dj-mode", event.data.djMode)
              miniPlayerElement.classList.toggle("playing", event.data.isPlaying)
              miniPlayerElement.classList.add("visible")

              miniPlayerVisible = true
              miniCurrentTrackData = event.data.trackData
              miniIsPlaying = event.data.isPlaying

              console.log("✅ Mini player mostrado via message")
            }
          } catch (error) {
            console.error("Erro ao processar showMiniPlayer:", error)
          }
        } else {
          console.log("🚫 Mini player não mostrado - música não está tocando")
        }
        break

      case "hideMiniPlayer":
        console.log("📨 Recebido hideMiniPlayer")
        try {
          const miniPlayerElement = document.getElementById("mini-player")
          if (miniPlayerElement) {
            miniPlayerElement.classList.remove("visible")
            miniPlayerVisible = false
            console.log("🔽 Mini player escondido via message")
          }
        } catch (error) {
          console.error("Erro ao processar hideMiniPlayer:", error)
        }
        break

      case "updateMiniPlayer":
        console.log("📨 Recebido updateMiniPlayer:", event.data)
        try {
          if (miniPlayerVisible && event.data.trackData) {
            const miniTitle = document.getElementById("mini-title")
            const miniArtist = document.getElementById("mini-artist")
            const miniArtwork = document.getElementById("mini-artwork-img")
            const miniPlayerElement = document.getElementById("mini-player")

            if (miniTitle) miniTitle.textContent = event.data.trackData.title
            if (miniArtist) miniArtist.textContent = event.data.trackData.artist || "Artista Desconhecido"
            if (miniArtwork) miniArtwork.src = event.data.trackData.thumbnail
            if (miniPlayerElement) {
              miniPlayerElement.classList.toggle("dj-mode", event.data.djMode)
            }

            miniCurrentTrackData = event.data.trackData
          }
        } catch (error) {
          console.error("Erro ao processar updateMiniPlayer:", error)
        }
        break

      case "updateMiniPlayState":
        console.log("📨 Recebido updateMiniPlayState:", event.data.isPlaying)
        try {
          const miniPlayerElement = document.getElementById("mini-player")
          const playPauseBtn = document.getElementById("mini-play-pause")

          if (miniPlayerElement) {
            miniPlayerElement.classList.toggle("playing", event.data.isPlaying)
          }

          if (playPauseBtn) {
            const playIcon = playPauseBtn.querySelector(".play-icon")
            const pauseIcon = playPauseBtn.querySelector(".pause-icon")

            if (event.data.isPlaying) {
              if (playIcon) playIcon.style.display = "none"
              if (pauseIcon) pauseIcon.style.display = "block"
            } else {
              if (playIcon) playIcon.style.display = "block"
              if (pauseIcon) pauseIcon.style.display = "none"
            }
          }

          miniIsPlaying = event.data.isPlaying

          if (!event.data.isPlaying) {
            setTimeout(() => {
              MiniPlayer.hide()
            }, 1000)
          }
        } catch (error) {
          console.error("Erro ao processar updateMiniPlayState:", error)
        }
        break

      case "updateMiniProgress":
        try {
          const miniProgressFill = document.getElementById("mini-progress-fill")
          if (miniProgressFill) {
            const progress = Math.max(0, Math.min(100, event.data.progress))
            miniProgressFill.style.width = `${progress}%`
          }
        } catch (error) {
          console.error("Erro ao processar updateMiniProgress:", error)
        }
        break

      case "setMiniDJMode":
        console.log("📨 Recebido setMiniDJMode:", event.data.enabled)
        try {
          const miniPlayerElement = document.getElementById("mini-player")
          if (miniPlayerElement) {
            miniPlayerElement.classList.toggle("dj-mode", event.data.enabled)
          }
        } catch (error) {
          console.error("Erro ao processar setMiniDJMode:", error)
        }
        break

      case "playlists":
        if (Array.isArray(event.data.data)) {
          dataCache.favoritos = event.data.data
          if (currentTab === "favoritos") {
            exibirPlaylists(event.data.data)
          }
          const modalEl = document.getElementById('playlist-modal')
          if (modalEl && modalEl.style.display !== 'none') {
            try {
              populatePlaylistModal(event.data.data)
              const createdName = modalEl.dataset.newPlaylistName
              const videoId = modalEl.dataset.videoId
              if (createdName && videoId) {
                const matches = (event.data.data || []).filter(p => p && p.name === createdName)
                const target = matches.length > 0 ? matches[matches.length - 1] : null
                if (target && target.id) {
                  delete modalEl.dataset.newPlaylistName
                  addVideoToPlaylist(target.id, videoId)
                }
              }
            } catch (err) {
              console.error('Erro ao atualizar modal de playlists:', err)
            }
          }
        }
        break

      case "playlistVideos":
        if (Array.isArray(event.data.data)) {
          playlist = event.data.data
          exibirMusicas(event.data.data, "playlist")
        }
        break

      case "favorites":
        if (Array.isArray(event.data.data)) {
          dataCache.curtidas = event.data.data
          if (currentTab === "curtidas") {
            exibirMusicas(event.data.data, "favorites")
          }
        }
        break

      case "history":
        if (Array.isArray(event.data.data)) {
          trackHistory = event.data.data
          dataCache.musicas = event.data.data
          try {
            localStorage.setItem("trackHistory", JSON.stringify(event.data.data))
          } catch (error) {
            console.error("Erro ao salvar histórico no localStorage:", error)
          }
          if (currentTab === "musicas") {
            exibirMusicas(event.data.data, "history")
          }
        }
        break

      case "setVolume":
        const volume = Math.min(100, Math.max(0, event.data.volume))
        if (player && player.setVolume) {
          player.setVolume(isGlobalMuted ? 0 : volume)
          savedVolume = volume
          document.querySelectorAll(".volume-slider, .ep-volume-slider").forEach((s) => {
            s.value = volume
            updateSliderBackground(s)
          })
          const epVal = document.querySelector(".ep-volume-value")
          if (epVal) epVal.textContent = `${Math.round(volume)}%`
          updateVolumeIcon(volume)
        }
        break

      case "setStereoPan":
        const pan = Math.min(1, Math.max(-1, event.data.pan))
        if (player && player.setStereoPan) {
          player.setStereoPan(pan)
        }
        break

      case "addExternalTrack":
        if (typeof YT !== "undefined" && YT.Player) {
          createExternalPlayer(event.data.sourceId, event.data.videoId)
        } else {
          setTimeout(() => {
            if (typeof YT !== "undefined" && YT.Player) {
              createExternalPlayer(event.data.sourceId, event.data.videoId)
            }
          }, 1000)
        }
        break

      case "updateExternalTrack":
        updateExternalPlayer(event.data.sourceId, event.data.volume, event.data.pan)
        break

      case "removeExternalTrack":
        removeExternalPlayer(event.data.sourceId)
        break

      case "addDJTrack":
        if (typeof YT !== "undefined" && YT.Player) {
          createDJPlayer(event.data.sourceId, event.data.videoId)
        } else {
          setTimeout(() => {
            if (typeof YT !== "undefined" && YT.Player) {
              createDJPlayer(event.data.sourceId, event.data.videoId)
            }
          }, 1000)
        }
        break

      case "updateDJTrack":
        console.log("🎧 Atualizando volume DJ via message:", event.data.volume)
        updateDJPlayer(event.data.sourceId, event.data.volume, event.data.pan)
        break

      case "removeDJTrack":
        removeDJPlayer(event.data.sourceId)
        break

      case "pausePlayback":
        if (player && player.pauseVideo) {
          player.pauseVideo()
          isPlaying = false
          try {
            if (ambientPlayer && ambientPlayer.pauseVideo) ambientPlayer.pauseVideo()
          } catch (_) {}
          const playPauseBtn = document.getElementById("play-pause")
          if (playPauseBtn) {
            playPauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5V19L19 12L8 5Z"/>
                </svg>
            `
          }
          MiniPlayer.hide()
        }
        break

      case "resumePlayback":
        if (player && player.playVideo) {
          player.playVideo()
          isPlaying = true
          try {
            if (ambientPlayer && ambientPlayer.playVideo) ambientPlayer.playVideo()
          } catch (_) {}

          try {
            fetch(`https://${safeGetParentResourceName()}/resumePlayback`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }).catch((error) => console.error("Erro ao retomar reprodução (resumePlayback message):", error))
          } catch (error) {
            console.error("Erro ao enviar resumePlayback (message):", error)
          }
          const playPauseBtn = document.getElementById("play-pause")
          if (playPauseBtn) {
            playPauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
            `
          }
          if (MiniPlayer.shouldShow()) {
            MiniPlayer.show()
          }
        }
        break

      case "forceStop":
        if (player && player.stopVideo) {
          player.stopVideo()
          isPlaying = false
          try {
            if (ambientPlayer && ambientPlayer.stopVideo) ambientPlayer.stopVideo()
          } catch (_) {}
          const playPauseBtn = document.getElementById("play-pause")
          if (playPauseBtn) {
            playPauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5V19L19 12L8 5Z"/>
                </svg>
            `
          }
          MiniPlayer.hide()
        }
        break

      case "action":
        if (event.data.action === "mostrarNome" && event.data.nome) {
          const playerNameEl = document.getElementById("player-name")
          if (playerNameEl) {
            playerNameEl.innerText = event.data.nome
          }
        }
        break

      case "updatePlayerProfile":
        {
          console.log("Recebido updatePlayerProfile:", event.data)
          const payload = event.data.profile || event.data.profileData
          console.log("Payload processado:", payload)
          
          if (payload) {
            const playerNameEl = document.getElementById("player-name")
            const profilePicEl = document.querySelector(".profile-pic")
            
            console.log("Elemento player-name encontrado:", playerNameEl)
            console.log("Nome do payload:", payload.name)

            if (playerNameEl && payload.name) {
              playerNameEl.innerText = payload.name
              console.log("Nome atualizado para:", payload.name)
            }

            if (profilePicEl && payload.avatar) {
              console.log("Atualizando avatar para:", payload.avatar)
              if (profilePicEl.tagName === "IMG") {
                profilePicEl.src = payload.avatar
                profilePicEl.onerror = function () {
                  this.src = "https://i.ibb.co/XghQBGw/unknown.png"
                  console.log("Erro ao carregar avatar, usando padrão")
                }
              } else {
                profilePicEl.style.backgroundImage = `url('${payload.avatar}')`
              }
            }
          } else {
            console.log("Payload vazio ou inválido")
          }
        }
        break
    }
  })

  function requestInitialData() {
    ;["getPlaylists", "getFavorites", "getHistory"].forEach((endpoint) => {
      fetch(`https://${safeGetParentResourceName()}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch((error) => console.error(`Erro ao buscar ${endpoint}:`, error))
    })
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      fetch(`https://${safeGetParentResourceName()}/exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch((error) => console.error("Erro ao lidar com saída:", error))
    }
  })

  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      console.log("Dispositivos de áudio alterados")
      fetch(`https://${safeGetParentResourceName()}/audioDeviceChanged`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch((error) => console.error("Erro ao lidar com mudança de dispositivo de áudio:", error))
    })
  }

  configurarBotoesAbas()

  const playlistModal = document.getElementById('playlist-modal')
  const closeModalBtn = document.querySelector('.close-modal')
  const createPlaylistBtn = document.getElementById('create-playlist-btn')
  const newPlaylistInput = document.getElementById('new-playlist-name')

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (playlistModal) {
        playlistModal.style.display = 'none'
      }
    })
  }

  if (playlistModal) {
    playlistModal.addEventListener('click', (e) => {
      if (e.target === playlistModal) {
        playlistModal.style.display = 'none'
      }
    })
  }

  if (createPlaylistBtn && newPlaylistInput) {
    createPlaylistBtn.addEventListener('click', async () => {
      const playlistName = newPlaylistInput.value.trim()
      if (playlistName) {
        try {
          if (playlistModal) {
            playlistModal.dataset.newPlaylistName = playlistName
          }
          const response = await fetch(`https://${safeGetParentResourceName()}/createPlaylist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: playlistName })
          })
          
          if (response.ok) {
            showNotification(`Playlist "${playlistName}" criada com sucesso!`, 'success')
            newPlaylistInput.value = ''
            loadPlaylistsForModal()
            
            if (currentTab === 'favoritos') {
              loadPlaylists()
            }
          } else {
            showNotification('Erro ao criar playlist', 'error')
          }
        } catch (error) {
          console.error('Erro ao criar playlist:', error)
          showNotification('Erro ao criar playlist', 'error')
        }
      } else {
        showNotification('Digite um nome para a playlist', 'warning')
      }
    })

    newPlaylistInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        createPlaylistBtn.click()
      }
    })
  }

  requestInitialData()

  if (typeof setupNowPlayingActions === 'function') {
    setupNowPlayingActions()
  }

  console.log("🎵 PRINCIPAL Music System inicializado!")
  console.log("🔍 Sistema de busca YouTube v3 carregado")
  console.log("📱 Mini player integrado")
  console.log("🎧 Sistema DJ ativo")
})

document.addEventListener("DOMContentLoaded", () => {
  const sliders = document.querySelectorAll(".volume-slider, .ep-volume-slider")
  sliders.forEach((slider) => {
    slider.addEventListener("input", function (e) {
      const userVolume = Number.parseInt(e.target.value, 10)
      const maxVolume = 100

      fetch(`https://${safeGetParentResourceName()}/setUserMaxVolume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxVolume: userVolume === maxVolume,
        }),
      })

      updateSliderBackground(this)
    })

    updateSliderBackground(slider)
  })
})
;(() => {
  try {
    const enabled = localStorage.getItem('principal_debug') === 'true'
    const noop = function () {}
    if (!enabled) {
      console.log = noop
      console.info = noop
      console.warn = noop
    }
    window.setPrincipalDebug = (v) => {
      try {
        localStorage.setItem('principal_debug', v ? 'true' : 'false')
      } catch (_) {}
    }
  } catch (_) {}
})()
