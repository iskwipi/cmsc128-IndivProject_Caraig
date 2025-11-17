// Firebase configuration
import { auth, db } from "./firebase-config.js"
import { showToast } from "./utils.js"
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"
import { doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

// Global variables
let currentUser = null

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkAuthState()
  setupEventListeners()
})

// Check authentication state
function checkAuthState() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (!user.emailVerified) {
        showToast("Please verify your email before accessing your account.")
        signOut(auth)
        setTimeout(() => {
          window.location.href = "auth.html"
        }, 2000)
        return
      }
      currentUser = user
      loadUserProfile()
    } else {
      // Redirect to login if not authenticated
      window.location.href = "auth.html"
    }
  })
}

// Load user profile
async function loadUserProfile() {
  try {
    // Load user data from Firestore
    const userDoc = await getDoc(doc(db, "users", currentUser.uid))
    if (userDoc.exists()) {
      const userData = userDoc.data()
      if (userData.username && userData.email) {
        document.getElementById("greeting").textContent = `Hello, ${userData.username}!`
        document.getElementById("displayUsername").textContent = userData.username
        document.getElementById("displayEmail").textContent = userData.email
      }
    }
  } catch (error) {
    console.error("Error loading profile:", error)
    showToast("Error loading profile data")
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    document.getElementById("confirmDialog").classList.add("show")
  })
  document.getElementById("confirmLogout").addEventListener("click", handleLogout)
  document.getElementById("cancelLogout").addEventListener("click", () => {
    document.getElementById("confirmDialog").classList.remove("show")
  })
  document.getElementById("passwordChangeForm").addEventListener("submit", handlePasswordChange)
  document.getElementById("changeNameForm").addEventListener("submit", handleChangeName)
  document.getElementById("deleteAccountForm").addEventListener("submit", handleDeleteAccount)
}

// Handle logout
async function handleLogout() {
  try {
    await signOut(auth)
    showToast("Logged out successfully!")
    setTimeout(() => {
      window.location.href = "auth.html"
    }, 1000)
  } catch (error) {
    console.error("Logout error:", error)
    showToast("Error logging out. Please try again.")
  }
}

// Show password change form
function showPasswordChangeForm() {
  document.getElementById("passwordChangeFormDialog").classList.add("show")
}

// Close password change form
function closePasswordChangeForm() {
  document.getElementById("passwordChangeFormDialog").classList.remove("show")
  document.getElementById("passwordChangeForm").reset()
}

// Handle password change
async function handlePasswordChange(e) {
  e.preventDefault()
  const currentPassword = document.getElementById("currentPassword").value
  const newPassword = document.getElementById("newPasswordChange").value
  const confirmPassword = document.getElementById("confirmPasswordChange").value
  // Validation
  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match!")
    return
  }
  if (newPassword.length < 6) {
    showToast("Password must be at least 6 characters long!")
    return
  }
  try {
    // Reauthenticate user
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
    await reauthenticateWithCredential(currentUser, credential)
    // Update password
    await updatePassword(currentUser, newPassword)
    showToast("Password changed successfully!")
    closePasswordChangeForm()
  } catch (error) {
    console.error("Password change error:", error)
    let errorMessage = "Failed to change password. Please try again."
    switch (error.code) {
      case "auth/wrong-password":
        errorMessage = "Current password is incorrect."
        break
      case "auth/weak-password":
        errorMessage = "New password is too weak."
        break
      case "auth/requires-recent-login":
        errorMessage = "Please logout and login again before changing password."
        break
    }
    showToast(errorMessage)
  }
}


// Show change name form
function showChangeNameForm() {
  document.getElementById("changeNameDialog").classList.add("show")
  document.getElementById("newUsername").value = document.getElementById("displayUsername").textContent
}

// Close change name form
function closeChangeNameForm() {
  document.getElementById("changeNameDialog").classList.remove("show")
  document.getElementById("changeNameForm").reset()
}

async function handleChangeName(e) {
  e.preventDefault()
  const newName = document.getElementById("newUsername").value
  if (!newName.trim()) {
    showToast("Display name cannot be empty!")
    return
  }
  try {
    // Update Firestore user document
    await updateDoc(doc(db, "users", currentUser.uid), {
      username: newName,
    })
    // Update Auth profile display name
    await updatePassword(currentUser, currentUser.password)
    // Reload profile to reflect changes
    await currentUser.reload()
    loadUserProfile()
    showToast("Name updated successfully!")
    closeChangeNameForm()
  } catch (error) {
    console.error("Error changing name:", error)
    showToast("Failed to update name. Please try again.")
  }
}

// Show delete account confirmation
function showDeleteAccountConfirm() {
  document.getElementById("deleteAccountDialog").classList.add("show")
}

// Close delete account form
function closeDeleteAccountForm() {
  document.getElementById("deleteAccountDialog").classList.remove("show")
  document.getElementById("deleteAccountForm").reset()
}

async function handleDeleteAccount(e) {
  e.preventDefault()
  const password = document.getElementById("deletePassword").value
  if (!password) {
    showToast("Password is required to delete account!")
    return
  }
  try {
    // Reauthenticate user before deletion
    const credential = EmailAuthProvider.credential(currentUser.email, password)
    await reauthenticateWithCredential(currentUser, credential)
    // Delete user data from Firestore
    await deleteDoc(doc(db, "users", currentUser.uid))
    // Delete user from Auth
    await deleteUser(currentUser)
    showToast("Account deleted successfully!")
    setTimeout(() => {
      window.location.href = "auth.html"
    }, 2000)
  } catch (error) {
    console.error("Error deleting account:", error)
    let errorMessage = "Failed to delete account. Please try again."
    switch (error.code) {
      case "auth/wrong-password":
        errorMessage = "Password is incorrect."
        break
      case "auth/requires-recent-login":
        errorMessage = "Please logout and login again before deleting account."
        break
    }
    showToast(errorMessage)
  }
}

// Make functions globally accessible
window.showPasswordChangeForm = showPasswordChangeForm
window.closePasswordChangeForm = closePasswordChangeForm
window.showChangeNameForm = showChangeNameForm
window.closeChangeNameForm = closeChangeNameForm
window.showDeleteAccountConfirm = showDeleteAccountConfirm
window.closeDeleteAccountForm = closeDeleteAccountForm