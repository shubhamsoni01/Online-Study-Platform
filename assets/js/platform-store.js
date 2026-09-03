// ============================================================
// ONLINE STUDY PLATFORM — DATABASE-DRIVEN DATA STORE
// (ALL MOCK / DEMO DATA COMPLETELY REMOVED)
// ============================================================

const STORAGE_KEY = 'online_study_platform_db_state_v3';

// Clear all legacy mock/demo localStorage keys
try {
  localStorage.removeItem('online_study_platform_data');
  localStorage.removeItem('online_study_platform_data_v2');
  localStorage.removeItem('online_study_platform_db_state');
} catch (e) {}

// Pure empty state — zero hardcoded teachers, students, courses, or subjects
const EMPTY_STATE = {
  teachers: [],
  subjects: [],
  courses: [],
  schedules: [],
  students: [],
  users: [],
  modules: {},
  announcements: [],
  books: [],
  chats: {},
};

let liveServerState = { ...EMPTY_STATE };

const Store = {
  get() {
    return liveServerState;
  },

  save(state) {
    liveServerState = state;
  },

  formatAvatarHtml(photo, name, fallback = 'TR') {
    const isUrl = typeof photo === 'string' && (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('/'));
    const isDemo = isUrl && (photo.includes('cloudinary.com/demo') || photo.includes('sample.jpg') || photo.includes('sample.jpeg'));
    const initials = name ? name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() : fallback;

    if (isUrl && !isDemo) {
      return `<img src="${photo}" alt="${name || 'Avatar'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initials}'"/>`;
    }
    return initials;
  },

  // Central Sync with Real MongoDB Backend APIs
  async syncWithBackend() {
    if (!window.LiveAPI) return liveServerState;

    try {
      const [tRes, sRes, cRes, schRes, stdRes, annRes, bRes] = await Promise.allSettled([
        LiveAPI.getTeachers(),
        LiveAPI.getSubjects(),
        LiveAPI.getCourses(),
        LiveAPI.getSchedules(),
        LiveAPI.getStudents(),
        LiveAPI.getAnnouncements(),
        LiveAPI.getBooks(),
      ]);

      const teachers = (tRes.status === 'fulfilled' && tRes.value?.data) ? tRes.value.data.map(t => {
        const rawPhoto = t.profilePhoto?.url || t.photo || '';
        const isDemo = typeof rawPhoto === 'string' && (rawPhoto.includes('cloudinary.com/demo') || rawPhoto.includes('sample.jpg') || rawPhoto.includes('sample.jpeg'));
        const safePhoto = (!isDemo && rawPhoto && rawPhoto.startsWith('http')) ? rawPhoto : '';
        const initials = t.name ? t.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'TR';

        return {
          id: t._id,
          _id: t._id,
          name: t.name,
          email: t.email,
          department: t.department,
          status: t.status,
          photo: safePhoto || initials,
          profilePhoto: { url: safePhoto, publicId: t.profilePhoto?.publicId || '' },
          assignedSubjects: (t.allocatedSubjects || []).map(s => s._id || s),
          allocatedCourses: t.allocatedCourses || [],
        };
      }) : [];

      const subjects = (sRes.status === 'fulfilled' && sRes.value?.data) ? sRes.value.data.map(s => ({
        id: s._id,
        _id: s._id,
        name: s.name,
        code: s.code,
        semester: s.semester,
        description: s.description,
        modulesCount: s.modulesCount || 0,
      })) : [];

      const courses = (cRes.status === 'fulfilled' && cRes.value?.data) ? cRes.value.data.map(c => ({
        id: c._id,
        _id: c._id,
        title: c.title,
        courseCode: c.courseCode,
        subjectId: c.subjectId?._id || c.subjectId,
        semester: c.semester,
        description: c.description,
        thumbnail: c.thumbnail,
      })) : [];

      const schedules = (schRes.status === 'fulfilled' && schRes.value?.data) ? schRes.value.data.map(sch => ({
        id: sch._id,
        _id: sch._id,
        subjectId: sch.subjectId?._id || sch.subjectId,
        subjectName: sch.subjectName || sch.subjectId?.name || 'Class Session',
        teacherName: sch.teacherName || sch.teacherId?.name || 'Faculty',
        date: sch.date ? new Date(sch.date).toISOString().split('T')[0] : '',
        time: sch.time,
        topic: sch.topic,
      })) : [];

      const students = (stdRes.status === 'fulfilled' && stdRes.value?.data) ? stdRes.value.data.map(st => {
        const rawPhoto = st.photo || '';
        const isDemo = typeof rawPhoto === 'string' && (rawPhoto.includes('cloudinary.com/demo') || rawPhoto.includes('sample.jpg') || rawPhoto.includes('sample.jpeg'));
        const safePhoto = (!isDemo && rawPhoto && rawPhoto.startsWith('http')) ? rawPhoto : '';
        const initials = st.name ? st.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ST';

        return {
          id: st._id,
          _id: st._id,
          name: st.name,
          email: st.email,
          department: st.department,
          semester: st.semester,
          roll: st.rollNumber,
          photo: safePhoto || initials,
          enrolledSubjects: st.enrolledSubjects || [],
          status: st.status,
        };
      }) : [];

      const announcements = (annRes.status === 'fulfilled' && annRes.value?.data) ? annRes.value.data.map(a => ({
        id: a._id,
        _id: a._id,
        title: a.title,
        message: a.message,
        teacher: a.teacherName || a.teacherId?.name || 'Instructor',
        subject: a.subjectName || a.subjectId?.name || '',
        date: a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'Recent',
      })) : [];

      const books = (bRes.status === 'fulfilled' && bRes.value?.data) ? bRes.value.data.map(b => ({
        id: b._id,
        _id: b._id,
        title: b.title,
        author: b.author,
        category: b.category,
        subject: b.subject,
        description: b.description,
        fileUrl: b.fileUrl,
        coverUrl: b.coverUrl,
      })) : [];

      liveServerState.teachers = teachers;
      liveServerState.subjects = subjects;
      liveServerState.courses = courses;
      liveServerState.schedules = schedules;
      liveServerState.students = students;
      liveServerState.announcements = announcements;
      liveServerState.books = books;

      return liveServerState;
    } catch (err) {
      console.warn('[Store.syncWithBackend Error]', err.message);
      return liveServerState;
    }
  },

  // Teachers (Real MongoDB only)
  getTeachers() {
    return liveServerState.teachers;
  },
  async addTeacher(teacherData) {
    if (window.LiveAPI) {
      const res = await LiveAPI.createTeacher(teacherData);
      await this.syncWithBackend();
      return res.data;
    }
  },
  async updateTeacher(id, updates) {
    if (window.LiveAPI) {
      const res = await LiveAPI.updateTeacher(id, updates);
      await this.syncWithBackend();
      return res.data;
    }
  },
  async deleteTeacher(id) {
    if (window.LiveAPI) {
      await LiveAPI.deleteTeacher(id);
      await this.syncWithBackend();
    }
  },

  // Subjects (Real MongoDB only)
  getSubjects() {
    return liveServerState.subjects;
  },
  async addSubject(subData) {
    if (window.LiveAPI) {
      const res = await LiveAPI.createSubject(subData);
      await this.syncWithBackend();
      return res.data;
    }
  },
  async updateSubject(id, updates) {
    if (window.LiveAPI) {
      const res = await LiveAPI.updateSubject(id, updates);
      await this.syncWithBackend();
      return res.data;
    }
  },
  async deleteSubject(id) {
    if (window.LiveAPI) {
      await LiveAPI.deleteSubject(id);
      await this.syncWithBackend();
    }
  },

  // Schedules (Real MongoDB only)
  getSchedules() {
    return liveServerState.schedules;
  },
  async addSchedule(schData) {
    if (window.LiveAPI) {
      const res = await LiveAPI.createSchedule(schData);
      await this.syncWithBackend();
      return res.data;
    }
  },
  async deleteSchedule(id) {
    if (window.LiveAPI) {
      await LiveAPI.deleteSchedule(id);
      await this.syncWithBackend();
    }
  },

  // Students (Real MongoDB only)
  getStudents() {
    return liveServerState.students;
  },

  // Users & Multi-Role (Real MongoDB state)
  getUsers() {
    return liveServerState.users || [];
  },
  setUsers(usersList) {
    liveServerState.users = Array.isArray(usersList) ? usersList : [];
  },

  // Courses (Real MongoDB only)
  getCourses() {
    return liveServerState.courses;
  },

  // Modules & Content (Real MongoDB state)
  getSubjectModules(subjectId) {
    return liveServerState.modules[subjectId] || [];
  },
  setSubjectModules(subjectId, modulesList) {
    liveServerState.modules[subjectId] = Array.isArray(modulesList) ? modulesList : [];
  },

  addModule(subjectId, moduleData) {
    if (!liveServerState.modules[subjectId]) {
      liveServerState.modules[subjectId] = [];
    }
    const list = liveServerState.modules[subjectId];
    const modId = (moduleData._id || moduleData.id || '').toString();
    const existingIdx = list.findIndex(m => (m._id || m.id || '').toString() === modId);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...moduleData };
    } else {
      list.push(moduleData);
    }
  },

  updateModule(subjectId, moduleId, updateData) {
    if (!liveServerState.modules[subjectId]) return;
    const mId = (moduleId || '').toString();
    const mod = liveServerState.modules[subjectId].find(m => (m._id || m.id || '').toString() === mId);
    if (mod) {
      Object.assign(mod, updateData);
    }
  },

  deleteModule(subjectId, moduleId) {
    if (!liveServerState.modules[subjectId]) return;
    const mId = (moduleId || '').toString();
    liveServerState.modules[subjectId] = liveServerState.modules[subjectId].filter(
      m => (m._id || m.id || '').toString() !== mId
    );
  },

  // Videos
  addVideo(subjectId, moduleId, videoData) {
    if (!liveServerState.modules[subjectId]) {
      liveServerState.modules[subjectId] = [];
    }
    const mId = (moduleId || '').toString();
    let mod = liveServerState.modules[subjectId].find(m => (m._id || m.id || '').toString() === mId);
    if (!mod) {
      mod = { _id: moduleId, id: moduleId, title: 'Module', videos: [], notes: [], quizzes: [] };
      liveServerState.modules[subjectId].push(mod);
    }
    if (!Array.isArray(mod.videos)) mod.videos = [];
    const vId = (videoData._id || videoData.id || '').toString();
    const existingIdx = vId ? mod.videos.findIndex(v => (v._id || v.id || '').toString() === vId) : -1;
    if (existingIdx >= 0) {
      mod.videos[existingIdx] = { ...mod.videos[existingIdx], ...videoData };
    } else {
      mod.videos.push(videoData);
    }
  },

  getVideos(subjectId, moduleId) {
    const mods = liveServerState.modules[subjectId] || [];
    const mId = (moduleId || '').toString();
    const mod = mods.find(m => (m._id || m.id || '').toString() === mId);
    return mod && Array.isArray(mod.videos) ? mod.videos : [];
  },

  deleteVideo(subjectId, moduleId, videoId) {
    const mods = liveServerState.modules[subjectId] || [];
    const mId = (moduleId || '').toString();
    const vId = (videoId || '').toString();
    const mod = mods.find(m => (m._id || m.id || '').toString() === mId);
    if (mod && Array.isArray(mod.videos)) {
      mod.videos = mod.videos.filter(v => (v._id || v.id || '').toString() !== vId);
    }
  },

  // Notes
  addNote(subjectId, moduleId, noteData) {
    this.addNotes(subjectId, moduleId, noteData);
  },

  addNotes(subjectId, moduleId, noteData) {
    if (!liveServerState.modules[subjectId]) {
      liveServerState.modules[subjectId] = [];
    }
    const mId = (moduleId || '').toString();
    let mod = liveServerState.modules[subjectId].find(m => (m._id || m.id || '').toString() === mId);
    if (!mod) {
      mod = { _id: moduleId, id: moduleId, title: 'Module', videos: [], notes: [], quizzes: [] };
      liveServerState.modules[subjectId].push(mod);
    }
    if (!Array.isArray(mod.notes)) mod.notes = [];
    const nId = (noteData._id || noteData.id || '').toString();
    const existingIdx = nId ? mod.notes.findIndex(n => (n._id || n.id || '').toString() === nId) : -1;
    if (existingIdx >= 0) {
      mod.notes[existingIdx] = { ...mod.notes[existingIdx], ...noteData };
    } else {
      mod.notes.push(noteData);
    }
  },

  getNotes(subjectId, moduleId) {
    const mods = liveServerState.modules[subjectId] || [];
    const mId = (moduleId || '').toString();
    const mod = mods.find(m => (m._id || m.id || '').toString() === mId);
    return mod && Array.isArray(mod.notes) ? mod.notes : [];
  },

  deleteNote(subjectId, moduleId, noteId) {
    const mods = liveServerState.modules[subjectId] || [];
    const mId = (moduleId || '').toString();
    const nId = (noteId || '').toString();
    const mod = mods.find(m => (m._id || m.id || '').toString() === mId);
    if (mod && Array.isArray(mod.notes)) {
      mod.notes = mod.notes.filter(n => (n._id || n.id || '').toString() !== nId);
    }
  },

  // Quizzes
  addQuiz(subjectId, moduleId, quizData) {
    if (!liveServerState.modules[subjectId]) {
      liveServerState.modules[subjectId] = [];
    }
    const mId = (moduleId || '').toString();
    let mod = liveServerState.modules[subjectId].find(m => (m._id || m.id || '').toString() === mId);
    if (!mod) {
      mod = { _id: moduleId, id: moduleId, title: 'Module', videos: [], notes: [], quizzes: [] };
      liveServerState.modules[subjectId].push(mod);
    }
    if (!Array.isArray(mod.quizzes)) mod.quizzes = [];
    const qId = (quizData._id || quizData.id || '').toString();
    const existingIdx = qId ? mod.quizzes.findIndex(q => (q._id || q.id || '').toString() === qId) : -1;
    if (existingIdx >= 0) {
      mod.quizzes[existingIdx] = { ...mod.quizzes[existingIdx], ...quizData };
    } else {
      mod.quizzes.push(quizData);
    }
  },

  deleteQuiz(subjectId, moduleId, quizId) {
    const mods = liveServerState.modules[subjectId] || [];
    const mId = (moduleId || '').toString();
    const qId = (quizId || '').toString();
    const mod = mods.find(m => (m._id || m.id || '').toString() === mId);
    if (mod && Array.isArray(mod.quizzes)) {
      mod.quizzes = mod.quizzes.filter(q => (q._id || q.id || '').toString() !== qId);
    }
  },

  // Announcements (Real MongoDB only)
  getAnnouncements() {
    return liveServerState.announcements;
  },

  // E-Library Books (Real MongoDB only)
  getBooks() {
    return liveServerState.books;
  },
  deleteBook(bookId) {
    const bId = (bookId || '').toString();
    liveServerState.books = (liveServerState.books || []).filter(b => (b._id || b.id || '').toString() !== bId);
  },

  // Video Comments
  addVideoComment(subjectId, moduleId, videoId, commentData) {
    const mods = liveServerState.modules[subjectId] || [];
    const mId = (moduleId || '').toString();
    const vId = (videoId || '').toString();
    const mod = mods.find(m => (m._id || m.id || '').toString() === mId);
    if (mod && Array.isArray(mod.videos)) {
      const vid = mod.videos.find(v => (v._id || v.id || '').toString() === vId);
      if (vid) {
        if (!Array.isArray(vid.comments)) vid.comments = [];
        const comment = {
          _id: `c_${Date.now()}`,
          id: `c_${Date.now()}`,
          createdAt: new Date().toISOString(),
          ...commentData,
        };
        vid.comments.push(comment);
        return comment;
      }
    }
    return null;
  },

  deleteVideoComment(subjectId, moduleId, videoId, commentId) {
    const mods = liveServerState.modules[subjectId] || [];
    const mId = (moduleId || '').toString();
    const vId = (videoId || '').toString();
    const cId = (commentId || '').toString();
    const mod = mods.find(m => (m._id || m.id || '').toString() === mId);
    if (mod && Array.isArray(mod.videos)) {
      const vid = mod.videos.find(v => (v._id || v.id || '').toString() === vId);
      if (vid && Array.isArray(vid.comments)) {
        vid.comments = vid.comments.filter(c => (c._id || c.id || '').toString() !== cId);
      }
    }
  },

  // Chat Conversations
  getChat(user1, user2) {
    return { messages: [] };
  },
  sendChatMessage(senderId, receiverId, msg) {
    if (window.LiveAPI) {
      LiveAPI.sendMessage({ receiverId, text: msg.text }).catch(() => {});
    }
  },
};

window.Store = Store;
