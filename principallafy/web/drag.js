document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app")
  const dragHeader = document.querySelector(".drag-header")

  let isDragging = false
  let currentX = 0
  let currentY = 0
  let initialX = 0
  let initialY = 0
  let xOffset = 0
  let yOffset = 0

  function getCurrentTransform(el) {
    const style = window.getComputedStyle(el)
    const matrix = style.transform

    if (matrix === "none" || matrix === undefined) {
      return { x: 0, y: 0 }
    }

    let x = 0
    let y = 0

    if (matrix.startsWith("matrix3d(")) {
      const match = matrix.match(/matrix3d\(([^)]+)\)/)
      if (match && match[1]) {
        const values = match[1].split(", ")
        x = Number.parseFloat(values[12]) || 0
        y = Number.parseFloat(values[13]) || 0
      }
    } else {
      const match = matrix.match(/matrix\(([^)]+)\)/)
      if (match && match[1]) {
        const values = match[1].split(", ")
        x = Number.parseFloat(values[4]) || 0
        y = Number.parseFloat(values[5]) || 0
      } else {
        return { x: 0, y: 0 }
      }
    }

    return { x, y }
  }

  function dragStart(e) {
    if (
      e.target.closest(".window-controls") ||
      e.target.tagName === "BUTTON" ||
      e.target.tagName === "INPUT" ||
      e.target.closest("button") ||
      e.target.closest("input")
    ) {
      return
    }

    if (!e.target.closest(".drag-header")) {
      return
    }

    const currentTransform = getCurrentTransform(app)
    xOffset = currentTransform.x
    yOffset = currentTransform.y

    if (e.type === "touchstart") {
      initialX = e.touches[0].clientX - xOffset
      initialY = e.touches[0].clientY - yOffset
    } else {
      initialX = e.clientX - xOffset
      initialY = e.clientY - yOffset
    }

    isDragging = true

    if (dragHeader) {
      dragHeader.style.cursor = "grabbing"
      app.style.userSelect = "none"
    }

    e.preventDefault()
  }

  function drag(e) {
    if (!isDragging) return

    e.preventDefault()

    if (e.type === "touchmove") {
      currentX = e.touches[0].clientX - initialX
      currentY = e.touches[0].clientY - initialY
    } else {
      currentX = e.clientX - initialX
      currentY = e.clientY - initialY
    }

    xOffset = currentX
    yOffset = currentY

    setTranslate(currentX, currentY, app)
  }

  function dragEnd(e) {
    if (!isDragging) return

    initialX = currentX
    initialY = currentY
    isDragging = false

    if (dragHeader) {
      dragHeader.style.cursor = "move"
      app.style.userSelect = ""
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(calc(-50% + ${xPos}px), calc(-50% + ${yPos}px))`
  }

  if (dragHeader) {
    dragHeader.addEventListener("mousedown", dragStart, false)
  }

  document.addEventListener("mousemove", drag, false)
  document.addEventListener("mouseup", dragEnd, false)

  if (dragHeader) {
    dragHeader.addEventListener("touchstart", dragStart, { passive: false })
  }

  document.addEventListener("touchmove", drag, { passive: false })
  document.addEventListener("touchend", dragEnd, false)

  const minimizeBtn = document.querySelector(".minimize-btn")
  const closeBtn = document.querySelector(".close-btn")

  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      app.classList.remove("visible")

      fetch(`https://${getResourceName()}/minimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch((err) => console.error("Erro ao minimizar:", err))
    })
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      app.classList.remove("visible")

      fetch(`https://${getResourceName()}/exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch((err) => console.error("Erro ao fechar:", err))
    })
  }

  function getResourceName() {
    if (typeof window.GetParentResourceName === "function") {
      return window.GetParentResourceName()
    }
    return "principal"
  }

  if (dragHeader) {
    dragHeader.style.cursor = "move"
  }

  console.log("✅ Sistema de arrastar inicializado sem pulo inicial")
})
