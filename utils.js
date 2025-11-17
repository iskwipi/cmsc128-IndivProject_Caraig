// Toast notification
export function showToast(message, showUndo = false) {
  const toast = document.getElementById("toast")
  const toastMessage = document.getElementById("toastMessage")
  const undoBtn = document.getElementById("undoBtn")
  toastMessage.textContent = message
  if (undoBtn) {
    undoBtn.style.display = showUndo ? "block" : "none"
  }
  toast.classList.add("show")
  setTimeout(() => {
    hideToast()
  }, 5000)
}

export function hideToast() {
  const toast = document.getElementById("toast")
  toast.classList.remove("show")
}

// Utility functions for date formatting
export function formatDateTime(dateTimeString) {
  const date = new Date(dateTimeString)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatDate(timestamp) {
  if (!timestamp) return "Just now"
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}