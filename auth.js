// Firebase configuration
import { auth, db } from "./firebase-config.js"
import { showToast } from "./utils.js"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

// Global variables
let currentView = "loginView"

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners()
})

// Setup event listeners
function setupEventListeners() {
  document.getElementById("loginForm").addEventListener("submit", handleLogin)
  document.getElementById("registerForm").addEventListener("submit", handleRegister)
  document.getElementById("emailRecoveryForm").addEventListener("submit", handleEmailRecovery)
}

// View management
function showView(viewId) {
  document.querySelectorAll(".auth-view").forEach((view) => {
    view.classList.remove("active")
  })
  document.getElementById(viewId).classList.add("active")
  currentView = viewId
}

// Handle login
async function handleLogin(e) {
  e.preventDefault()
  const email = document.getElementById("loginEmail").value
  const password = document.getElementById("loginPassword").value
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    if (!userCredential.user.emailVerified) {
      showToast("Please verify your email before logging in. Check your inbox.")
      await auth.signOut()
      return
    }
    showToast("Login successful! Redirecting...")
    setTimeout(() => {
      window.location.href = "index.html"
    }, 1500)
  } catch (error) {
    console.error("Login error:", error)
    let errorMessage = "Login failed. Please try again."
    switch (error.code) {
      case "auth/user-not-found":
        errorMessage = "No account found with this email."
        break
      case "auth/wrong-password":
        errorMessage = "Incorrect password."
        break
      case "auth/invalid-email":
        errorMessage = "Invalid email address."
        break
      case "auth/user-disabled":
        errorMessage = "This account has been disabled."
        break
      case "auth/invalid-credential":
        errorMessage = "Invalid email or password."
        break
    }
    showToast(errorMessage)
  }
}

// Handle register
async function handleRegister(e) {
  e.preventDefault()
  const username = document.getElementById("registerUsername").value
  const email = document.getElementById("registerEmail").value
  const password = document.getElementById("registerPassword").value
  const confirmPassword = document.getElementById("registerConfirmPassword").value
  // Validation
  if (password !== confirmPassword) {
    showToast("Passwords do not match!")
    return
  }
  if (password.length < 6) {
    showToast("Password must be at least 6 characters long!")
    return
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    // Update profile with username
    await updateProfile(userCredential.user, {
      displayName: username,
    })
    // Store additional user data in Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
      username: username,
      email: email,
      createdAt: serverTimestamp(),
    })
    const personalListId = `personal-${userCredential.user.uid}`
    await setDoc(doc(db, "lists", personalListId), {
      name: "My Tasks",
      ownerId: userCredential.user.uid,
      type: "personal",
      createdAt: serverTimestamp(),
    })
    await sendEmailVerification(userCredential.user)
    showToast("Account created! Please check your email to verify your account.")
    await auth.signOut()
    setTimeout(() => {
      showView("loginView")
    }, 3000)
  } catch (error) {
    console.error("Registration error:", error)
    let errorMessage = "Registration failed. Please try again."
    switch (error.code) {
      case "auth/email-already-in-use":
        errorMessage = "An account with this email already exists."
        break
      case "auth/invalid-email":
        errorMessage = "Invalid email address."
        break
      case "auth/weak-password":
        errorMessage = "Password is too weak. Use at least 6 characters."
        break
    }
    showToast(errorMessage)
  }
}

// Handle email recovery
async function handleEmailRecovery(e) {
  e.preventDefault()
  const email = document.getElementById("recoveryEmail").value
  try {
    await sendPasswordResetEmail(auth, email)
    showToast("Password reset link sent to your email!")
    setTimeout(() => {
      showView("loginView")
    }, 2000)
  } catch (error) {
    console.error("Email recovery error:", error)
    let errorMessage = "Failed to send reset email. Please try again."
    switch (error.code) {
      case "auth/user-not-found":
        errorMessage = "No account found with this email."
        break
      case "auth/invalid-email":
        errorMessage = "Invalid email address."
        break
    }
    showToast(errorMessage)
  }
}

// Make showView globally accessible
window.showView = showView