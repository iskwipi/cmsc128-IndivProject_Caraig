// Firebase configuration
import { db } from "./firebase-config.js"
import { showToast, hideToast, formatDateTime, formatDate, escapeHtml } from "./utils.js"
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

// Global variables
let tasks = []
let currentSort = "dateAdded"
let deletedTask = null
let editingTaskId = null
let taskToDelete = null

// DOM elements
const taskForm = document.getElementById("taskForm")
const tasksList = document.getElementById("tasksList")
const emptyState = document.getElementById("emptyState")
const sortButtons = document.querySelectorAll(".btn-sort")
const toast = document.getElementById("toast")
const toastMessage = document.getElementById("toastMessage")
const undoBtn = document.getElementById("undoBtn")
const confirmDialog = document.getElementById("confirmDialog")
const editDialog = document.getElementById("editDialog")
const editTaskForm = document.getElementById("editTaskForm")

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  loadTasks()
  setupEventListeners()
})

// Setup event listeners
function setupEventListeners() {
  taskForm.addEventListener("submit", handleAddTask)
  editTaskForm.addEventListener("submit", handleEditTask)
  sortButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSort = btn.dataset.sort
      sortButtons.forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")
      renderTasks()
    })
  })
  undoBtn.addEventListener("click", handleUndo)
  document.getElementById("cancelDelete").addEventListener("click", () => {
    confirmDialog.classList.remove("show")
    taskToDelete = null
  })
  document.getElementById("confirmDelete").addEventListener("click", handleConfirmDelete)
  document.getElementById("cancelEdit").addEventListener("click", () => {
    editDialog.classList.remove("show")
    editingTaskId = null
  })
}

// Load tasks from Firestore
async function loadTasks() {
  try {
    const q = query(collection(db, "tasks"))
    const querySnapshot = await getDocs(q)
    tasks = []
    querySnapshot.forEach((doc) => {
      tasks.push({
        id: doc.id,
        ...doc.data(),
      })
    })
    renderTasks()
  } catch (error) {
    console.error("Error loading tasks:", error)
    showToast("Error loading tasks. Please check your Firebase configuration.")
  }
}

// Add new task
async function handleAddTask(e) {
  e.preventDefault()
  const title = document.getElementById("taskTitle").value
  const date = document.getElementById("taskDate").value
  const time = document.getElementById("taskTime").value
  const priority = document.getElementById("taskPriority").value
  const dueDateTime = `${date} ${time}`
  try {
    const docRef = await addDoc(collection(db, "tasks"), {
      title,
      dueDateTime,
      priority,
      completed: false,
      createdAt: serverTimestamp(),
    })
    tasks.push({
      id: docRef.id,
      title,
      dueDateTime,
      priority,
      completed: false,
      createdAt: new Date(),
    })
    taskForm.reset()
    renderTasks()
    showToast("Task added successfully!")
  } catch (error) {
    console.error("Error adding task:", error)
    showToast("Error adding task. Please try again.")
  }
}

// Toggle task completion
async function toggleTaskComplete(taskId) {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return
  try {
    const taskRef = doc(db, "tasks", taskId)
    await updateDoc(taskRef, {
      completed: !task.completed,
    })
    task.completed = !task.completed
    renderTasks()
  } catch (error) {
    console.error("Error updating task:", error)
    showToast("Error updating task. Please try again.")
  }
}

// Show delete confirmation
function showDeleteConfirmation(taskId) {
  taskToDelete = taskId
  confirmDialog.classList.add("show")
}

// Handle confirmed delete
async function handleConfirmDelete() {
  if (!taskToDelete) return
  const task = tasks.find((t) => t.id === taskToDelete)
  if (!task) return
  try {
    await deleteDoc(doc(db, "tasks", taskToDelete))
    deletedTask = { ...task }
    tasks = tasks.filter((t) => t.id !== taskToDelete)
    confirmDialog.classList.remove("show")
    renderTasks()
    showToast("Task deleted", true)
    taskToDelete = null
  } catch (error) {
    console.error("Error deleting task:", error)
    showToast("Error deleting task. Please try again.")
  }
}

// Undo delete
async function handleUndo() {
  if (!deletedTask) return
  try {
    const docRef = await addDoc(collection(db, "tasks"), {
      title: deletedTask.title,
      dueDateTime: deletedTask.dueDateTime,
      priority: deletedTask.priority,
      completed: deletedTask.completed,
      createdAt: deletedTask.createdAt,
    })
    tasks.push({
      ...deletedTask,
      id: docRef.id,
    })
    deletedTask = null
    hideToast()
    renderTasks()
  } catch (error) {
    console.error("Error restoring task:", error)
    showToast("Error restoring task. Please try again.")
  }
}

// Show edit dialog
function showEditDialog(taskId) {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return
  editingTaskId = taskId
  const [date, time] = task.dueDateTime.split(" ")
  document.getElementById("editTaskTitle").value = task.title
  document.getElementById("editTaskDate").value = date
  document.getElementById("editTaskTime").value = time
  document.getElementById("editTaskPriority").value = task.priority
  editDialog.classList.add("show")
}

// Handle edit task
async function handleEditTask(e) {
  e.preventDefault()
  if (!editingTaskId) return
  const title = document.getElementById("editTaskTitle").value
  const date = document.getElementById("editTaskDate").value
  const time = document.getElementById("editTaskTime").value
  const priority = document.getElementById("editTaskPriority").value
  const dueDateTime = `${date} ${time}`
  try {
    const taskRef = doc(db, "tasks", editingTaskId)
    await updateDoc(taskRef, {
      title,
      dueDateTime,
      priority,
    })
    const task = tasks.find((t) => t.id === editingTaskId)
    if (task) {
      task.title = title
      task.dueDateTime = dueDateTime
      task.priority = priority
    }
    editDialog.classList.remove("show")
    editingTaskId = null
    renderTasks()
    showToast("Task updated successfully!")
  } catch (error) {
    console.error("Error updating task:", error)
    showToast("Error updating task. Please try again.")
  }
}

// Sort tasks
function sortTasks(tasksToSort) {
  const sorted = [...tasksToSort]
  switch (currentSort) {
    case "dateAdded":
      sorted.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0)
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0)
        return dateB - dateA
      })
      break
    case "dueDate":
      sorted.sort((a, b) => {
        return new Date(a.dueDateTime) - new Date(b.dueDateTime)
      })
      break
    case "priority":
      const priorityOrder = { High: 0, Mid: 1, Low: 2 }
      sorted.sort((a, b) => {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
      break
  }
  return sorted
}

// Render tasks
function renderTasks() {
  if (tasks.length === 0) {
    tasksList.style.display = "none"
    emptyState.style.display = "block"
    return
  }
  tasksList.style.display = "flex"
  emptyState.style.display = "none"
  const sortedTasks = sortTasks(tasks)
  tasksList.innerHTML = sortedTasks
    .map(
      (task) => `
        <div class="task-item ${task.completed ? "completed" : ""}">
            <input 
                type="checkbox" 
                class="task-checkbox" 
                ${task.completed ? "checked" : ""}
                onchange="toggleTaskComplete('${task.id}')"
            >
            <div class="task-content">
                <div class="task-header">
                    <span class="task-title"><div>${task.title}</div></span>
                </div>
                <div class="task-meta">
                    <span class="priority-badge priority-${task.priority.toLowerCase()}">Priority: ${task.priority}</span>
                    <span>Due: ${formatDateTime(task.dueDateTime)}</span>
                </div>
            </div>
            <div class="task-actions">
                <button class="btn btn-primary" onclick="showEditDialog('${task.id}')" title="Edit task">
                    Edit
                </button>
                <button class="btn btn-danger" onclick="showDeleteConfirmation('${task.id}')" title="Delete task">
                    Delete
                </button>
            </div>
        </div>
    `,
    )
    .join("")
}

// Make functions globally accessible
window.toggleTaskComplete = toggleTaskComplete
window.showDeleteConfirmation = showDeleteConfirmation
window.showEditDialog = showEditDialog