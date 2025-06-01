class ChatApp {
  constructor() {
    this.socket = null
    this.currentUser = null
    this.typingTimeout = null
    this.isTyping = false
    this.onlineUsers = new Map()

    this.initializeElements()
    this.initializeSocket()
    this.attachEventListeners()
    this.initializeApp()
  }

  initializeElements() {
    // Main elements
    this.messagesContainer = document.getElementById("messages")
    this.messageInput = document.getElementById("message-input")
    this.sendBtn = document.getElementById("send-btn")
    this.charCount = document.getElementById("char-count")

    // User info elements
    this.userAvatar = document.getElementById("user-avatar")
    this.userName = document.getElementById("user-name")
    this.onlineCount = document.getElementById("online-count")
    this.onlineText = document.getElementById("online-text")
    this.onlineList = document.getElementById("online-list")

    // Modal elements
    this.settingsModal = document.getElementById("settings-modal")
    this.settingsAvatar = document.getElementById("settings-avatar")
    this.avatarInput = document.getElementById("avatar-input")

    // Control elements
    this.themeToggle = document.getElementById("theme-toggle")
    this.settingsBtn = document.getElementById("settings-btn")
    this.logoutBtn = document.getElementById("logout-btn")
    this.closeSettings = document.getElementById("close-settings")
    this.updateAvatar = document.getElementById("update-avatar")

    // Typing indicator
    this.typingIndicator = document.getElementById("typing-indicator")
    this.typingText = document.getElementById("typing-text")

    // Notification
    this.notification = document.getElementById("notification")
  }

  initializeSocket() {
    this.socket = io()

    this.socket.on("connect", () => {
      console.log("Connected to server")
      if (this.currentUser) {
        this.socket.emit("join", {
          username: this.currentUser.username,
          userId: this.currentUser._id,
        })
      }
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server")
    })

    this.socket.on("newMessage", (message) => {
      this.displayMessage(message)
      this.scrollToBottom()
    })

    this.socket.on("userJoined", (data) => {
      this.displaySystemMessage(data.message)
    })

    this.socket.on("userLeft", (data) => {
      this.displaySystemMessage(data.message)
    })

    this.socket.on("onlineCount", (count) => {
      this.updateOnlineCount(count)
    })

    this.socket.on("userTyping", (data) => {
      this.handleTypingIndicator(data)
    })
  }

  attachEventListeners() {
    // Message input
    this.messageInput.addEventListener("input", () => {
      this.updateCharCount()
      this.updateSendButton()
      this.handleTyping()
    })

    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    // Send button
    this.sendBtn.addEventListener("click", () => this.sendMessage())

    // Theme toggle
    this.themeToggle.addEventListener("click", () => this.toggleTheme())

    // Settings
    this.settingsBtn.addEventListener("click", () => this.openSettings())
    this.closeSettings.addEventListener("click", () => this.closeSettingsModal())
    this.updateAvatar.addEventListener("click", () => this.updateUserAvatar())

    // Logout
    this.logoutBtn.addEventListener("click", () => this.logout())

    // Modal close on outside click
    this.settingsModal.addEventListener("click", (e) => {
      if (e.target === this.settingsModal) {
        this.closeSettingsModal()
      }
    })

    // Theme selector
    document.querySelectorAll('input[name="theme"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.setTheme(e.target.value)
        }
      })
    })

    // Avatar input validation
    this.avatarInput.addEventListener("input", () => {
      const url = this.avatarInput.value.trim()
      if (url && this.isValidImageUrl(url)) {
        this.settingsAvatar.src = url
      }
    })
  }

  async initializeApp() {
    try {
      await this.loadUserProfile()
      await this.loadMessages()
      this.initializeTheme()
      this.scrollToBottom()
    } catch (error) {
      console.error("App initialization error:", error)
      this.showNotification("Failed to initialize app", "error")
      setTimeout(() => (window.location.href = "/"), 2000)
    }
  }

  async loadUserProfile() {
    try {
      const response = await fetch("/api/profile")
      if (!response.ok) {
        throw new Error("Failed to load profile")
      }

      const result = await response.json()
      if (result.success) {
        this.currentUser = result.user
        this.updateUserInfo()

        // Join chat room
        if (this.socket.connected) {
          this.socket.emit("join", {
            username: this.currentUser.username,
            userId: this.currentUser._id,
          })
        }
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      console.error("Profile loading error:", error)
      throw error
    }
  }

  async loadMessages() {
    try {
      this.messagesContainer.innerHTML =
        '<div class="loading-messages"><div class="loader"></div><p>Loading messages...</p></div>'

      const response = await fetch("/api/messages")
      if (!response.ok) {
        throw new Error("Failed to load messages")
      }

      const result = await response.json()
      if (result.success) {
        this.messagesContainer.innerHTML = ""
        result.messages.forEach((message) => {
          this.displayMessage(message, false)
        })
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      console.error("Messages loading error:", error)
      this.messagesContainer.innerHTML = '<div class="loading-messages"><p>Failed to load messages</p></div>'
    }
  }

  updateUserInfo() {
    if (!this.currentUser) return

    this.userName.textContent = this.currentUser.username
    this.userAvatar.src = this.currentUser.avatar
    this.settingsAvatar.src = this.currentUser.avatar
    this.avatarInput.value = this.currentUser.avatar

    // Set theme radio button
    const themeRadio = document.querySelector(`input[name="theme"][value="${this.currentUser.theme || "light"}"]`)
    if (themeRadio) {
      themeRadio.checked = true
    }
  }

  sendMessage() {
    const message = this.messageInput.value.trim()
    if (!message || !this.currentUser) return

    this.socket.emit("sendMessage", {
      message: message,
      avatar: this.currentUser.avatar,
    })

    this.messageInput.value = ""
    this.updateCharCount()
    this.updateSendButton()
    this.stopTyping()
  }

  displayMessage(message, animate = true) {
    const messageDiv = document.createElement("div")
    messageDiv.className = `message ${message.userId === this.currentUser._id ? "own" : ""}`

    if (!animate) {
      messageDiv.style.animation = "none"
    }

    const time = new Date(message.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    messageDiv.innerHTML = `
            <img src="${message.avatar}" alt="${message.username}" class="message-avatar" loading="lazy">
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${this.escapeHtml(message.username)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${this.escapeHtml(message.message)}</div>
            </div>
        `

    this.messagesContainer.appendChild(messageDiv)

    // Auto-scroll if user is near bottom
    if (this.isNearBottom()) {
      this.scrollToBottom()
    }
  }

  displaySystemMessage(message) {
    const messageDiv = document.createElement("div")
    messageDiv.className = "system-message"
    messageDiv.textContent = message
    this.messagesContainer.appendChild(messageDiv)

    if (this.isNearBottom()) {
      this.scrollToBottom()
    }
  }

  handleTyping() {
    if (!this.isTyping) {
      this.isTyping = true
      this.socket.emit("typing", { isTyping: true })
    }

    clearTimeout(this.typingTimeout)
    this.typingTimeout = setTimeout(() => {
      this.stopTyping()
    }, 1000)
  }

  stopTyping() {
    if (this.isTyping) {
      this.isTyping = false
      this.socket.emit("typing", { isTyping: false })
    }
    clearTimeout(this.typingTimeout)
  }

  handleTypingIndicator(data) {
    if (data.isTyping) {
      this.typingText.textContent = `${data.username} is typing...`
      this.typingIndicator.classList.add("show")
    } else {
      this.typingIndicator.classList.remove("show")
    }
  }

  updateCharCount() {
    const count = this.messageInput.value.length
    this.charCount.textContent = `${count}/500`

    if (count > 450) {
      this.charCount.style.color = "var(--warning-color)"
    } else if (count === 500) {
      this.charCount.style.color = "var(--error-color)"
    } else {
      this.charCount.style.color = "var(--text-muted)"
    }
  }

  updateSendButton() {
    const hasText = this.messageInput.value.trim().length > 0
    this.sendBtn.disabled = !hasText
  }

  updateOnlineCount(count) {
    this.onlineCount.textContent = count
    this.onlineText.textContent = `${count} online`
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
  }

  isNearBottom() {
    const threshold = 100
    return (
      this.messagesContainer.scrollTop + this.messagesContainer.clientHeight >=
      this.messagesContainer.scrollHeight - threshold
    )
  }

  initializeTheme() {
    const savedTheme = localStorage.getItem("theme") || this.currentUser?.theme || "light"
    this.setTheme(savedTheme)
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light"
    const newTheme = currentTheme === "light" ? "dark" : "light"
    this.setTheme(newTheme)
  }

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("theme", theme)

    // Update theme toggle icon
    const icon = this.themeToggle.querySelector(".icon")
    icon.textContent = theme === "light" ? "🌙" : "☀️"

    // Update user theme preference
    if (this.currentUser) {
      this.updateUserTheme(theme)
    }
  }

  async updateUserTheme(theme) {
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      })
    } catch (error) {
      console.error("Theme update error:", error)
    }
  }

  openSettings() {
    this.settingsModal.classList.add("show")
    this.settingsModal.style.display = "flex"
  }

  closeSettingsModal() {
    this.settingsModal.classList.remove("show")
    setTimeout(() => {
      this.settingsModal.style.display = "none"
    }, 300)
  }

  async updateUserAvatar() {
    const newAvatar = this.avatarInput.value.trim()
    if (!newAvatar) {
      this.showNotification("Please enter an avatar URL", "warning")
      return
    }

    if (!this.isValidImageUrl(newAvatar)) {
      this.showNotification("Please enter a valid image URL", "error")
      return
    }

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: newAvatar }),
      })

      const result = await response.json()
      if (result.success) {
        this.currentUser.avatar = newAvatar
        this.userAvatar.src = newAvatar
        this.settingsAvatar.src = newAvatar
        this.closeSettingsModal()
        this.showNotification("Avatar updated successfully!", "success")
      } else {
        this.showNotification(result.message, "error")
      }
    } catch (error) {
      console.error("Avatar update error:", error)
      this.showNotification("Failed to update avatar", "error")
    }
  }

  async logout() {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
      })

      if (response.ok) {
        this.socket.disconnect()
        window.location.href = "/"
      } else {
        this.showNotification("Failed to logout", "error")
      }
    } catch (error) {
      console.error("Logout error:", error)
      this.showNotification("Network error during logout", "error")
    }
  }

  isValidImageUrl(url) {
    try {
      new URL(url)
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || url.includes("ui-avatars.com")
    } catch {
      return false
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  showNotification(message, type = "info") {
    this.notification.textContent = message
    this.notification.className = `notification ${type}`
    this.notification.classList.remove("hidden")

    setTimeout(() => {
      this.notification.classList.add("hidden")
    }, 5000)
  }
}

// Initialize chat app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp()
})
