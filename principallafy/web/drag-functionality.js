
let isDragging = false
let initialX = 0
let initialY = 0
let xOffset = 0
let yOffset = 0

function getCurrentTransform(element) {
  try {
    if (!element) return { x: 0, y: 0 }

    const style = window.getComputedStyle(element)
    const transform = style.transform

    if (transform === "none" || !transform) {
      return { x: 0, y: 0 }
    }

    if (window.DOMMatrix) {
      try {
        const matrix = new DOMMatrix(transform)
        return {
          x: matrix.m41 || 0,
          y: matrix.m42 || 0,
        }
      } catch (e) {
      }
    }

    const matrix = transform.match(/matrix.*$$(.+)$$/)
    if (matrix && matrix[1]) {
      const values = matrix[1].split(", ")
      if (values.length >= 6) {
        return {
          x: Number.parseFloat(values[4]) || 0,
          y: Number.parseFloat(values[5]) || 0,
        }
      }
    }

    return { x: 0, y: 0 }
  } catch (error) {
    console.warn("⚠️ Erro ao obter transformação:", error)
    return { x: 0, y: 0 }
  }
}

function safeElementAccess(selector, callback, fallback = null) {
  try {
    const element = typeof selector === "string" ? document.querySelector(selector) : selector
    if (element && typeof callback === "function") {
      return callback(element)
    }
    return fallback
  } catch (error) {
    console.warn(`⚠️ Erro ao acessar elemento:`, error)
    return fallback
  }
}

function initDragSystem() {
  try {
    const app = document.getElementById("app")
    const dragHandle = document.querySelector(".drag-handle")

    if (!app) {
      console.warn("⚠️ Elemento #app não encontrado")
      return
    }

    if (!dragHandle) {
      console.warn("⚠️ Elemento .drag-handle não encontrado")
      return
    }

    if (app.dataset.dragInitialized === "true") {
      return
    }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const appWidth = app.offsetWidth || 400
    const appHeight = app.offsetHeight || 600

    if (!app.style.transform || app.style.transform === "none") {
      xOffset = (viewportWidth - appWidth) / 2
      yOffset = (viewportHeight - appHeight) / 2
      setTranslate(xOffset, yOffset, app)
    } else {
      const currentPos = getCurrentTransform(app)
      xOffset = currentPos.x
      yOffset = currentPos.y
    }

    dragHandle.removeEventListener("mousedown", dragStart)
    dragHandle.removeEventListener("touchstart", dragStart)

    dragHandle.addEventListener("mousedown", dragStart, { passive: false })
    dragHandle.addEventListener("touchstart", dragStart, { passive: false })

    document.removeEventListener("mousemove", drag)
    document.removeEventListener("touchmove", drag)
    document.removeEventListener("mouseup", dragEnd)
    document.removeEventListener("touchend", dragEnd)

    document.addEventListener("mousemove", drag, { passive: false })
    document.addEventListener("touchmove", drag, { passive: false })
    document.addEventListener("mouseup", dragEnd)
    document.addEventListener("touchend", dragEnd)

    app.dataset.dragInitialized = "true"

    console.log("✅ Sistema de arrastar inicializado")
  } catch (error) {
    console.error("❌ Erro ao inicializar sistema de arrastar:", error)
  }
}

function dragStart(e) {
  try {
    e.preventDefault()

    const target = e.target
    if (
      target.closest(".window-controls") ||
      target.closest("button") ||
      target.tagName === "INPUT" ||
      target.tagName === "SELECT" ||
      target.closest(".volume-slider") ||
      target.closest(".progress")
    ) {
      return
    }

    const app = document.getElementById("app")
    if (!app) return

    const currentPosition = getCurrentTransform(app)
    xOffset = currentPosition.x
    yOffset = currentPosition.y

    if (e.type === "touchstart" && e.touches && e.touches[0]) {
      initialX = e.touches[0].clientX - xOffset
      initialY = e.touches[0].clientY - yOffset
    } else {
      initialX = e.clientX - xOffset
      initialY = e.clientY - yOffset
    }

    isDragging = true

    app.classList.add("dragging")

    document.body.style.cursor = "grabbing"
    document.body.style.userSelect = "none"
  } catch (error) {
    console.error("❌ Erro ao iniciar arrastar:", error)
  }
}

function drag(e) {
  try {
    if (!isDragging) return

    e.preventDefault()

    const app = document.getElementById("app")
    if (!app) return

    if (e.type === "touchmove" && e.touches && e.touches[0]) {
      xOffset = e.touches[0].clientX - initialX
      yOffset = e.touches[0].clientY - initialY
    } else {
      xOffset = e.clientX - initialX
      yOffset = e.clientY - initialY
    }

    setTranslate(xOffset, yOffset, app)
  } catch (error) {
    console.error("❌ Erro durante arrastar:", error)
  }
}

function dragEnd(e) {
  try {
    if (!isDragging) return

    const app = document.getElementById("app")
    if (!app) return

    app.classList.remove("dragging")

    document.body.style.cursor = "default"
    document.body.style.userSelect = "auto"

    isDragging = false
  } catch (error) {
    console.error("❌ Erro ao finalizar arrastar:", error)
  }
}

function setTranslate(xPos, yPos, el) {
  try {
    if (!el) return
    el.style.transform = `translate(${xPos}px, ${yPos}px)`
  } catch (error) {
    console.error("❌ Erro ao aplicar transformação:", error)
  }
}

function resetPosition() {
  try {
    const app = document.getElementById("app")
    if (!app) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const appRect = app.getBoundingClientRect()

    xOffset = (viewportWidth - appRect.width) / 2
    yOffset = (viewportHeight - appRect.height) / 2

    setTranslate(xOffset, yOffset, app)

    console.log("🎯 Posição resetada para o centro")
  } catch (error) {
    console.error("❌ Erro ao resetar posição:", error)
  }
}

function initWhenReady() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDragSystem)
  } else {
    initDragSystem()
  }
}

window.addEventListener("resize", () => {
  setTimeout(() => {
    const app = document.getElementById("app")
    if (app && app.classList.contains("visible")) {
      const rect = app.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (rect.right < 100 || rect.left > viewportWidth - 100 || rect.bottom < 100 || rect.top > viewportHeight - 100) {
        resetPosition()
      }
    }
  }, 100)
})

window.dragSystem = {
  init: initDragSystem,
  reset: resetPosition,
  getCurrentPos: () => {
    const app = document.getElementById("app")
    return app ? getCurrentTransform(app) : { x: 0, y: 0 }
  },
}

initWhenReady()

console.log("🖱️ Sistema de arrastar carregado!")
