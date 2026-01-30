const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use(session({
  secret: 'chat-app-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|mp3|wav|ogg|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'));
    }
  }
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  }
}

// ============= API Routes =============

// Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
  }

  try {
    // Check if user already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(username, email, hashedPassword);

    res.json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      userId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body; // Changed from email to identifier

  if (!identifier || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  try {
    // Check for both email or username
    const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(identifier, identifier);

    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.email = user.email;

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get user profile
app.get('/api/profile', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, avatar FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل البروفايل' });
  }
});

// Update user profile
app.put('/api/profile', requireAuth, (req, res) => {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'اسم المستخدم مطلوب' });
  }

  try {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username.trim(), req.session.userId);

    // Update session
    req.session.username = username.trim();

    res.json({
      success: true,
      message: 'تم تحديث البروفايل بنجاح'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث البروفايل' });
  }
});

// Upload profile avatar
app.post('/api/profile/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم رفع أي صورة' });
  }

  const avatarUrl = `/uploads/${req.file.filename}`;

  try {
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.session.userId);

    res.json({
      success: true,
      avatarUrl: avatarUrl
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء رفع الصورة' });
  }
});

// Search users
app.get('/api/users/search', requireAuth, (req, res) => {
  const query = req.query.q || '';

  if (!query) {
    return res.json([]);
  }

  try {
    const users = db.prepare(`
            SELECT id, username, email 
            FROM users 
            WHERE (username LIKE ? OR email LIKE ?) AND id != ?
            LIMIT 20
        `).all(`%${query}%`, `%${query}%`, req.session.userId);

    res.json(users);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء البحث' });
  }
});

// Get user's rooms
app.get('/api/rooms', requireAuth, (req, res) => {
  try {
    const rooms = db.prepare(`
            SELECT 
                r.id, 
                r.name, 
                r.invite_code,
                r.creator_id,
                rm.is_admin,
                (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count,
                (SELECT COUNT(*) FROM notifications WHERE user_id = ? AND room_id = r.id AND is_read = 0) as unread_count
            FROM rooms r
            JOIN room_members rm ON r.id = rm.room_id
            WHERE rm.user_id = ?
            ORDER BY r.created_at DESC
        `).all(req.session.userId, req.session.userId);

    // Hide invite code if not admin
    rooms.forEach(room => {
      if (!room.is_admin) {
        delete room.invite_code;
      }
    });

    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل الغرف' });
  }
});

// Create room
app.post('/api/rooms', requireAuth, (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'اسم الغرفة مطلوب' });
  }

  try {
    const roomId = uuidv4();
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Create room
    db.prepare('INSERT INTO rooms (id, name, invite_code, creator_id) VALUES (?, ?, ?, ?)').run(roomId, name, inviteCode, req.session.userId);

    // Add creator as admin member
    db.prepare('INSERT INTO room_members (room_id, user_id, is_admin) VALUES (?, ?, 1)').run(roomId, req.session.userId);

    // Emit event to all connected clients
    io.emit('room_created', { roomId, name });

    res.json({
      success: true,
      roomId,
      name,
      inviteCode
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الغرفة' });
  }
});

// Update room settings (Admin only)
app.put('/api/rooms/:roomId', requireAuth, (req, res) => {
  const { roomId } = req.params;
  const { name, inviteCode } = req.body;

  try {
    // Check if is admin
    const membership = db.prepare('SELECT is_admin FROM room_members WHERE room_id = ? AND user_id = ?').get(roomId, req.session.userId);
    if (!membership || !membership.is_admin) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لتغيير إعدادات الغرفة' });
    }

    if (name) {
      db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(name, roomId);
    }

    if (inviteCode) {
      // Check if code is already used
      const exists = db.prepare('SELECT id FROM rooms WHERE invite_code = ? AND id != ?').get(inviteCode, roomId);
      if (exists) {
        return res.status(400).json({ error: 'كود الدعوة هذا مستخدم بالفعل' });
      }
      db.prepare('UPDATE rooms SET invite_code = ? WHERE id = ?').run(inviteCode.toUpperCase(), roomId);
    }

    res.json({ success: true, message: 'تم تحديث الإعدادات بنجاح' });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الإعدادات' });
  }
});

// Join room by invite code
app.post('/api/rooms/join', requireAuth, (req, res) => {
  const { inviteCode } = req.body;

  if (!inviteCode) {
    return res.status(400).json({ error: 'كود الدعوة مطلوب' });
  }

  try {
    const room = db.prepare('SELECT id, name FROM rooms WHERE invite_code = ?').get(inviteCode.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: 'كود الدعوة غير صحيح' });
    }

    // Add member
    db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(room.id, req.session.userId);

    res.json({
      success: true,
      roomId: room.id,
      roomName: room.name
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء الانضمام للغرفة' });
  }
});

// Add member to room
app.post('/api/rooms/:roomId/members', requireAuth, (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.body;

  try {
    // Check if requester is admin
    const membership = db.prepare('SELECT is_admin FROM room_members WHERE room_id = ? AND user_id = ?').get(roomId, req.session.userId);

    if (!membership || !membership.is_admin) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لإضافة أعضاء' });
    }

    // Add member
    db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(roomId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة العضو' });
  }
});

// Get room messages
app.get('/api/rooms/:roomId/messages', requireAuth, (req, res) => {
  const { roomId } = req.params;

  try {
    // Check if user is member
    const membership = db.prepare('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?').get(roomId, req.session.userId);

    if (!membership) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لعرض هذه الغرفة' });
    }

    const messages = db.prepare(`
            SELECT 
                m.id,
                m.text,
                m.media_type,
                m.media_url,
                m.timestamp,
                u.id as sender_id,
                u.username as sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.room_id = ?
            ORDER BY m.timestamp ASC
            LIMIT 100
        `).all(roomId);

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل الرسائل' });
  }
});

// Upload file
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const mediaType = req.file.mimetype.split('/')[0]; // image, video, audio, etc.

  res.json({
    success: true,
    url: fileUrl,
    type: mediaType,
    filename: req.file.originalname
  });
});

// Mark notifications as read
app.post('/api/notifications/read', requireAuth, (req, res) => {
  const { roomId } = req.body;

  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND room_id = ?').run(req.session.userId, roomId);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ============= Socket.IO =============

const connectedUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', (userId) => {
    socket.userId = userId;
    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} authenticated`);
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.userId} joined room ${roomId}`);
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.userId} left room ${roomId}`);
  });

  socket.on('send_message', async (data) => {
    const { roomId, text, mediaUrl, mediaType } = data;

    try {
      // Save message
      const result = db.prepare('INSERT INTO messages (sender_id, room_id, text, media_url, media_type) VALUES (?, ?, ?, ?, ?)').run(
        socket.userId,
        roomId,
        text || null,
        mediaUrl || null,
        mediaType || null
      );

      const messageId = result.lastInsertRowid;

      // Get sender info
      const sender = db.prepare('SELECT username FROM users WHERE id = ?').get(socket.userId);

      // Get room members
      const members = db.prepare('SELECT user_id FROM room_members WHERE room_id = ?').all(roomId);

      // Create notifications for other members
      const notificationStmt = db.prepare('INSERT INTO notifications (user_id, room_id, message_id) VALUES (?, ?, ?)');
      members.forEach(member => {
        if (member.user_id !== socket.userId) {
          notificationStmt.run(member.user_id, roomId, messageId);
        }
      });

      // Broadcast message to room
      io.to(roomId).emit('new_message', {
        id: messageId,
        senderId: socket.userId,
        senderName: sender.username,
        text,
        mediaUrl,
        mediaType,
        timestamp: new Date().toISOString()
      });

      // Notify users not in room
      members.forEach(member => {
        if (member.user_id !== socket.userId) {
          const memberSocketId = connectedUsers.get(member.user_id);
          if (memberSocketId) {
            io.to(memberSocketId).emit('notification', {
              roomId,
              message: 'رسالة جديدة'
            });
          }
        }
      });

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'فشل إرسال الرسالة' });
    }
  });

  // WebRTC signaling for voice calls
  socket.on('call_user', (data) => {
    const { to, offer } = data;
    const toSocketId = connectedUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('incoming_call', {
        from: socket.userId,
        offer
      });
    }
  });

  socket.on('call_answer', (data) => {
    const { to, answer } = data;
    const toSocketId = connectedUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('call_answered', {
        from: socket.userId,
        answer
      });
    }
  });

  socket.on('ice_candidate', (data) => {
    const { to, candidate } = data;
    const toSocketId = connectedUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('ice_candidate', {
        from: socket.userId,
        candidate
      });
    }
  });

  socket.on('end_call', (data) => {
    const { to } = data;
    const toSocketId = connectedUsers.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('call_ended', {
        from: socket.userId
      });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
