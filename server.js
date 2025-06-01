const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const { MongoClient, ObjectId } = require("mongodb")
const bcrypt = require("bcrypt")
const session = require("express-session")
const MongoStore = require("connect-mongo")
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// MongoDB connection
const MONGODB_URI =
  "mongodb+srv://Danzdevv:HoCKFcNRuQxkrmmj@cluster0.32stkkw.mongodb.net/chatapp?retryWrites=true&w=majority"
let db

MongoClient.connect(MONGODB_URI)
  .then((client) => {
    console.log("✅ Connected to MongoDB")
    db = client.db("chatapp")
  })
  .catch((error) => console.error("❌ MongoDB connection error:", error))

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))

// Session configuration
app.use(
  session({
    secret: "modern-chat-secret-2024",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGODB_URI,
      dbName: "chatapp",
    }),
    cookie: {
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
)

// Routes
app.get("/", (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, "public", "chat.html"))
  } else {
    res.sendFile(path.join(__dirname, "public", "auth.html"))
  }
})

app.get("/chat", (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, "public", "chat.html"))
  } else {
    res.redirect("/")
  }
})

// Register endpoint
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      })
    }

    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters long",
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      })
    }

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    })

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const result = await db.collection("users").insertOne({
      username,
      password: hashedPassword,
      createdAt: new Date(),
      lastSeen: new Date(),
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6366f1&color=fff&size=128`,
      status: "online",
      theme: "light",
    })

    req.session.userId = result.insertedId
    req.session.username = username

    res.json({
      success: true,
      message: "Registration successful",
      user: {
        id: result.insertedId,
        username,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6366f1&color=fff&size=128`,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      })
    }

    // Find user (case insensitive)
    const user = await db.collection("users").findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid username or password",
      })
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: "Invalid username or password",
      })
    }

    // Update last seen
    await db.collection("users").updateOne({ _id: user._id }, { $set: { lastSeen: new Date(), status: "online" } })

    req.session.userId = user._id
    req.session.username = user.username

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Logout endpoint
app.post("/api/logout", async (req, res) => {
  try {
    if (req.session.userId) {
      await db
        .collection("users")
        .updateOne({ _id: new ObjectId(req.session.userId) }, { $set: { status: "offline", lastSeen: new Date() } })
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Could not log out",
        })
      }
      res.json({ success: true, message: "Logout successful" })
    })
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Get user profile
app.get("/api/profile", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    })
  }

  try {
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(req.session.userId) }, { projection: { password: 0 } })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({ success: true, user })
  } catch (error) {
    console.error("Profile error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Update profile
app.post("/api/profile", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    })
  }

  try {
    const { avatar, theme } = req.body
    const updateData = { updatedAt: new Date() }

    if (avatar) updateData.avatar = avatar
    if (theme) updateData.theme = theme

    await db.collection("users").updateOne({ _id: new ObjectId(req.session.userId) }, { $set: updateData })

    res.json({
      success: true,
      message: "Profile updated successfully",
    })
  } catch (error) {
    console.error("Profile update error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Get chat messages
app.get("/api/messages", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    })
  }

  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const messages = await db.collection("messages").find({}).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray()

    res.json({
      success: true,
      messages: messages.reverse(),
      page,
      hasMore: messages.length === limit,
    })
  } catch (error) {
    console.error("Messages error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Get online users
app.get("/api/users/online", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    })
  }

  try {
    const onlineUsers = await db
      .collection("users")
      .find({ status: "online" }, { projection: { password: 0 } })
      .toArray()

    res.json({ success: true, users: onlineUsers })
  } catch (error) {
    console.error("Online users error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Socket.IO connection handling
const connectedUsers = new Map()

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id)

  socket.on("join", async (userData) => {
    try {
      socket.username = userData.username
      socket.userId = userData.userId

      // Store user connection
      connectedUsers.set(userData.userId, {
        socketId: socket.id,
        username: userData.username,
        joinedAt: new Date(),
      })

      // Update user status
      await db
        .collection("users")
        .updateOne({ _id: new ObjectId(userData.userId) }, { $set: { status: "online", lastSeen: new Date() } })

      // Broadcast user joined
      socket.broadcast.emit("userJoined", {
        username: userData.username,
        message: `${userData.username} joined the chat`,
        timestamp: new Date(),
      })

      // Send online users count
      io.emit("onlineCount", connectedUsers.size)

      console.log(`👤 ${userData.username} joined the chat`)
    } catch (error) {
      console.error("Join error:", error)
    }
  })

  socket.on("sendMessage", async (data) => {
    try {
      if (!socket.userId || !socket.username) {
        return
      }

      const message = {
        userId: socket.userId,
        username: socket.username,
        message: data.message.trim(),
        timestamp: new Date(),
        avatar: data.avatar,
        messageId: new ObjectId(),
      }

      // Save message to database
      await db.collection("messages").insertOne(message)

      // Broadcast message to all clients
      io.emit("newMessage", message)

      console.log(`💬 ${socket.username}: ${data.message}`)
    } catch (error) {
      console.error("Message save error:", error)
    }
  })

  socket.on("typing", (data) => {
    socket.broadcast.emit("userTyping", {
      username: socket.username,
      isTyping: data.isTyping,
    })
  })

  socket.on("disconnect", async () => {
    try {
      if (socket.userId) {
        // Remove from connected users
        connectedUsers.delete(socket.userId)

        // Update user status
        await db
          .collection("users")
          .updateOne({ _id: new ObjectId(socket.userId) }, { $set: { status: "offline", lastSeen: new Date() } })

        // Broadcast user left
        if (socket.username) {
          socket.broadcast.emit("userLeft", {
            username: socket.username,
            message: `${socket.username} left the chat`,
            timestamp: new Date(),
          })
        }

        // Send updated online count
        io.emit("onlineCount", connectedUsers.size)

        console.log(`👋 ${socket.username || "Unknown"} left the chat`)
      }
    } catch (error) {
      console.error("Disconnect error:", error)
    }

    console.log("🔌 User disconnected:", socket.id)
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Open http://localhost:${PORT} in your browser`)
})
