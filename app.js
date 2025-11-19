// Firebase configuration
import { auth, db } from "./firebase-config.js"
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
  where,
  getDoc,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"

// Global variables
let tasks = []
let lists = []
let currentUser = null
let currentListId = null
let currentSort = "dateAdded"
let deletedTask = null
let editingTaskId = null
let taskToDelete = null
let collaboratorEmails = {}

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
const listsTabs = document.getElementById("listsTabs")
const newListBtn = document.getElementById("newListBtn")
const collaboratorsBtn = document.getElementById("collaboratorsBtn")
const newListDialog = document.getElementById("newListDialog")
const collaboratorsDialog = document.getElementById("collaboratorsDialog")
const editCollaboratorsDialog = document.getElementById("editCollaboratorsDialog")
const editCollaboratorsList = document.getElementById("editCollaboratorsList")

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  checkAuthState()
})

// Check authentication state
function checkAuthState() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user
      console.log(currentUser)
      document.getElementById("greeting").textContent = `Hello, ${currentUser.displayName}!`
      loadLists()
      setupEventListeners()
    } else {
      window.location.href = "auth.html"
    }
  })
}

// Load all lists for current user
async function loadLists() {
  try {
    const personalListId = `personal-${currentUser.uid}`
    const q = query(collection(db, "lists"), where("ownerId", "==", currentUser.uid), orderBy("createdAt"))
    
    const querySnapshot = await getDocs(q)
    lists = []
    querySnapshot.forEach((doc) => {
      lists.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    // Also load lists where user is collaborator
    const collaboratorsQuery = query(collection(db, "collaborators"), where("userId", "==", currentUser.uid))
    const collaboratorsSnapshot = await getDocs(collaboratorsQuery)
    const collaboratorListIds = collaboratorsSnapshot.docs.map((doc) => doc.data().listId)

    for (const listId of collaboratorListIds) {
      const listDoc = await getDoc(doc(db, "lists", listId))
      if (listDoc.exists()) {
        lists.push({
          id: listDoc.id,
          ...listDoc.data(),
        })
      }
    }

    if (!currentListId) {
      currentListId = personalListId
    }

    renderListTabs()
    loadTasks()
  } catch (error) {
    console.error("Error loading lists:", error)
    showToast("Error loading lists")
  }
}

// Render list tabs
function renderListTabs() {
  listsTabs.innerHTML = lists
    .map(
      (list) => `
      <button 
        class="list-tab ${list.id === currentListId ? "active" : ""}" 
        onclick="switchList('${list.id}')"
        title="${list.name}"
      >
        ${list.name}
      </button>
    `,
    )
    .join("")
}

// Switch to a different list
function switchList(listId) {
  currentListId = listId
  renderListTabs()
  loadTasks()
  collaboratorsBtn.style.display = currentListId.search("personal") != 0 ? "block" : "none"
}

// Check if current user is the owner of current list
function isUserListOwner() {
  const currentList = lists.find((l) => l.id === currentListId)
  return currentList && currentList.ownerId === currentUser.uid
}

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

  newListBtn.addEventListener("click", showNewListDialog)
  document.getElementById("cancelNewList").addEventListener("click", closeNewListDialog)
  document.getElementById("createListForm").addEventListener("submit", handleCreateNewList)

  collaboratorsBtn.addEventListener("click", showCollaboratorsDialog)
  document.getElementById("closeCollaborators").addEventListener("click", closeCollaboratorsDialog)
  document.getElementById("editCollaboratorsBtn").addEventListener("click", showEditCollaboratorsDialog)
  document.getElementById("closeEditCollaborators").addEventListener("click", closeEditCollaboratorsDialog)
  document.getElementById("addCollaboratorForm").addEventListener("submit", handleAddCollaborator)
  document.getElementById("accountBtn").addEventListener("click", handleAccount)
}

// Load tasks from Firestore
async function loadTasks() {
  try {
    const q = query(collection(db, "tasks"), where("listId", "==", currentListId))
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
      listId: currentListId,
    })
    tasks.push({
      id: docRef.id,
      title,
      dueDateTime,
      priority,
      completed: false,
      createdAt: serverTimestamp(),
      listId: currentListId,
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
      listId: deletedTask.listId,
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
        const dateA = new Date(a.dueDateTime)
        const dateB = new Date(b.dueDateTime)
        return dateA - dateB
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

// Show new list dialog
function showNewListDialog() {
  newListDialog.classList.add("show")
}

// Close new list dialog
function closeNewListDialog() {
  newListDialog.classList.remove("show")
  document.getElementById("createListForm").reset()
}

// Handle create new list
async function handleCreateNewList(e) {
  e.preventDefault()
  const listName = document.getElementById("listName").value

  if (!listName.trim()) {
    showToast("List name cannot be empty!")
    return
  }

  try {
    // Create the list
    const listRef = await addDoc(collection(db, "lists"), {
      name: listName,
      ownerId: currentUser.uid,
      type: "shared",
      createdAt: serverTimestamp(),
    })

    lists.push({
      id: listRef.id,
      name: listName,
      ownerId: currentUser.uid,
      type: "shared",
      createdAt: serverTimestamp(),
    })

    renderListTabs()
    closeNewListDialog()
    showToast("List created successfully!")
  } catch (error) {
    console.error("Error creating list:", error)
    showToast("Error creating list. Please try again.")
  }
}

// Find user by email
async function findUserByEmail(email) {
  try {
    const q = query(collection(db, "users"), where("email", "==", email))
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null
    const userDoc = snapshot.docs[0]
    return { uid: userDoc.id, ...userDoc.data() }
  } catch (error) {
    console.error("Error finding user:", error)
    return null
  }
}


// Show collaborators dialog
async function showCollaboratorsDialog() {
  const currentList = lists.find((l) => l.id === currentListId)
  if (!currentList) return

  // Get collaborators for current list
  const q = query(collection(db, "collaborators"), where("listId", "==", currentListId))
  const snapshot = await getDocs(q)
  const collaborators = []

  for (const item of snapshot.docs) {
    const userDoc = await getDoc(doc(db, "users", item.data().userId))
    if (userDoc.exists()) {
      collaborators.push({
        uid: userDoc.data().userId,
        email: userDoc.data().email,
      })
    }
  }

  // Display collaborators info
  const ownerUserDoc = await getDoc(doc(db, "users", currentList.ownerId))
  let collaboratorsHtml = `<div class="collaborator-item">
    <strong>${ownerUserDoc.data().email}</strong> (Owner)
  </div>`

  collaborators.forEach((collab) => {
    collaboratorsHtml += `<div class="collaborator-item">${collab.email}</div>`
  })

  document.getElementById("collaboratorsList").innerHTML = collaboratorsHtml

  // Show edit button only if user is owner
  document.getElementById("editCollaboratorsBtn").style.display = isUserListOwner() ? "block" : "none"

  collaboratorsDialog.classList.add("show")
}

// Close collaborators dialog
function closeCollaboratorsDialog() {
  collaboratorsDialog.classList.remove("show")
}

// Show edit collaborators dialog
async function showEditCollaboratorsDialog() {
  const q = query(collection(db, "collaborators"), where("listId", "==", currentListId))
  const snapshot = await getDocs(q)
  const collaborators = []

  for (const item of snapshot.docs) {
    const userDoc = await getDoc(doc(db, "users", item.data().userId))
    if (userDoc.exists()) {
      collaborators.push({
        docId: item.id,
        uid: userDoc.data().userId,
        email: userDoc.data().email,
      })
    }
  }

  let collaboratorsListHtml = collaborators
    .map(
      (collab) => `
    <div class="collaborator-item-edit">
      <span>${collab.email}</span>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeCollaborator('${collab.docId}', '${collab.email}')">Remove</button>
    </div>
  `,
    )
    .join("")

  document.getElementById("editCollaboratorsList").innerHTML = collaboratorsListHtml
  console.log(collaborators)
  editCollaboratorsList.style.display = collaborators.length === 0 ? "none" : "block"
  editCollaboratorsDialog.classList.add("show")
  closeCollaboratorsDialog()
}

// Close edit collaborators dialog
function closeEditCollaboratorsDialog() {
  editCollaboratorsDialog.classList.remove("show")
  document.getElementById("addCollaboratorForm").reset()
}

// Handle add collaborator
async function handleAddCollaborator(e) {
  e.preventDefault()
  const email = document.getElementById("newCollaboratorEmail").value

  if (!email.trim()) {
    showToast("Email cannot be empty!")
    return
  }

  try {
    const userDoc = await findUserByEmail(email)
    console.log(currentUser)
    console.log(userDoc)
    if (!userDoc) {
      showToast("User not found with that email")
      return
    }

    // Check if email is from current user
    if (userDoc.email == currentUser.email) {
      showToast("User is already the list owner")
      return
    }

    // Check if already a collaborator
    const q = query(
      collection(db, "collaborators"),
      where("listId", "==", currentListId),
      where("userId", "==", userDoc.uid),
    )
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      showToast("User is already a collaborator on this list")
      return
    }

    // Add collaborator
    await addDoc(collection(db, "collaborators"), {
      listId: currentListId,
      userId: userDoc.uid,
      addedAt: serverTimestamp(),
    })

    // Reload lists to reflect changes
    await loadLists()
    document.getElementById("addCollaboratorForm").reset()
    showToast("Collaborator added successfully!")

    // Refresh edit dialog
    await showEditCollaboratorsDialog()
  } catch (error) {
    console.error("Error adding collaborator:", error)
    showToast("Error adding collaborator. Please try again.")
  }
}

// Remove collaborator
async function removeCollaborator(docId, email) {
  try {
    await deleteDoc(doc(db, "collaborators", docId))
    showToast(`${email} removed from collaborators`)
    await showEditCollaboratorsDialog()
  } catch (error) {
    console.error("Error removing collaborator:", error)
    showToast("Error removing collaborator. Please try again.")
  }
}

// Handle account menu
async function handleAccount() {
  try {
    window.location.href = "account.html"
  } catch (error) {
    console.error("Account page error:", error)
    showToast("Error accessing account page. Please try again.")
  }
}

// Make functions globally accessible
window.toggleTaskComplete = toggleTaskComplete
window.showDeleteConfirmation = showDeleteConfirmation
window.showEditDialog = showEditDialog

window.switchList = switchList
window.showNewListDialog = showNewListDialog
window.closeNewListDialog = closeNewListDialog
window.showCollaboratorsDialog = showCollaboratorsDialog
window.closeCollaboratorsDialog = closeCollaboratorsDialog
window.showEditCollaboratorsDialog = showEditCollaboratorsDialog
window.closeEditCollaboratorsDialog = closeEditCollaboratorsDialog
window.removeCollaborator = removeCollaborator
window.handleAccount = handleAccount