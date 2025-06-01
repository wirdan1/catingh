class AuthManager {
  constructor() {
    this.initializeElements()
    this.attachEventListeners()
    this.initializeTheme()
  }

  initializeElements() {
    this.loginForm = document.getElementById("login-form")
    this.registerForm = document.getElementById("register-form")
    this.tabButtons = document.querySelectorAll(".tab-btn")
    this.notification = document.getElementById("notification")
  }

  attachEventListeners() {
    // Tab switching
    this.tabButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => this.switchTab(e.target.dataset.tab))
    })

    // Form submissions
    this.loginForm.addEventListener("submit", (e) => this.handleLogin(e))
    this.registerForm.addEventListener("submit", (e) => this.handleRegister(e))

    // Real-time validation
    this.setupRealTimeValidation()
  }

  initializeTheme() {
    const savedTheme = localStorage.getItem("theme") || "light"
    document.documentElement.setAttribute("data-theme", savedTheme)
  }

  switchTab(tab) {
    // Update tab buttons
    this.tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab)
    })

    // Update forms
    this.loginForm.classList.toggle("active", tab === "login")
    this.registerForm.classList.toggle("active", tab === "register")

    // Clear notifications
    this.hideNotification()
  }

  setupRealTimeValidation() {
    const usernameInputs = document.querySelectorAll('input[name="username"]')
    const passwordInputs = document.querySelectorAll('input[name="password"]')
    const confirmPasswordInput = document.getElementById("confirm-password")

    usernameInputs.forEach((input) => {
      input.addEventListener("input", () => this.validateUsername(input))
    })

    passwordInputs.forEach((input) => {
      input.addEventListener("input", () => this.validatePassword(input))
    })

    if (confirmPasswordInput) {
      confirmPasswordInput.addEventListener("input", () => this.validatePasswordMatch())
    }
  }

  validateUsername(input) {
    const value = input.value.trim()
    const isValid = value.length >= 3

    input.style.borderColor = isValid
      ? "var(--success-color)"
      : value.length > 0
        ? "var(--error-color)"
        : "var(--border-color)"

    return isValid
  }

  validatePassword(input) {
    const value = input.value
    const isValid = value.length >= 6

    input.style.borderColor = isValid
      ? "var(--success-color)"
      : value.length > 0
        ? "var(--error-color)"
        : "var(--border-color)"

    return isValid
  }

  validatePasswordMatch() {
    const password = document.getElementById("register-password").value
    const confirmPassword = document.getElementById("confirm-password").value
    const isValid = password === confirmPassword && confirmPassword.length > 0

    document.getElementById("confirm-password").style.borderColor = isValid
      ? "var(--success-color)"
      : confirmPassword.length > 0
        ? "var(--error-color)"
        : "var(--border-color)"

    return isValid
  }

  async handleLogin(e) {
    e.preventDefault()

    const formData = new FormData(this.loginForm)
    const data = Object.fromEntries(formData)

    if (!this.validateLoginForm(data)) return

    const submitBtn = this.loginForm.querySelector(".btn")
    this.setLoadingState(submitBtn, true)

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        this.showNotification("Login successful! Redirecting...", "success")
        setTimeout(() => (window.location.href = "/chat"), 1000)
      } else {
        this.showNotification(result.message, "error")
      }
    } catch (error) {
      console.error("Login error:", error)
      this.showNotification("Network error. Please try again.", "error")
    } finally {
      this.setLoadingState(submitBtn, false)
    }
  }

  async handleRegister(e) {
    e.preventDefault()

    const formData = new FormData(this.registerForm)
    const data = Object.fromEntries(formData)

    if (!this.validateRegisterForm(data)) return

    const submitBtn = this.registerForm.querySelector(".btn")
    this.setLoadingState(submitBtn, true)

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        this.showNotification("Registration successful! Redirecting...", "success")
        setTimeout(() => (window.location.href = "/chat"), 1000)
      } else {
        this.showNotification(result.message, "error")
      }
    } catch (error) {
      console.error("Registration error:", error)
      this.showNotification("Network error. Please try again.", "error")
    } finally {
      this.setLoadingState(submitBtn, false)
    }
  }

  validateLoginForm(data) {
    if (!data.username.trim()) {
      this.showNotification("Username is required", "error")
      return false
    }
    if (!data.password) {
      this.showNotification("Password is required", "error")
      return false
    }
    return true
  }

  validateRegisterForm(data) {
    if (!data.username.trim()) {
      this.showNotification("Username is required", "error")
      return false
    }
    if (data.username.trim().length < 3) {
      this.showNotification("Username must be at least 3 characters long", "error")
      return false
    }
    if (!data.password) {
      this.showNotification("Password is required", "error")
      return false
    }
    if (data.password.length < 6) {
      this.showNotification("Password must be at least 6 characters long", "error")
      return false
    }
    if (data.password !== data.confirmPassword) {
      this.showNotification("Passwords do not match", "error")
      return false
    }
    return true
  }

  setLoadingState(button, isLoading) {
    const btnText = button.querySelector(".btn-text")
    const btnLoader = button.querySelector(".btn-loader")

    if (isLoading) {
      btnText.classList.add("hidden")
      btnLoader.classList.remove("hidden")
      button.disabled = true
    } else {
      btnText.classList.remove("hidden")
      btnLoader.classList.add("hidden")
      button.disabled = false
    }
  }

  showNotification(message, type = "info") {
    this.notification.textContent = message
    this.notification.className = `notification ${type}`
    this.notification.classList.remove("hidden")

    setTimeout(() => this.hideNotification(), 5000)
  }

  hideNotification() {
    this.notification.classList.add("hidden")
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new AuthManager()
})
