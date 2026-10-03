const express = require('express');
const path = require('node:path');
const database = require('./database');

const app = express();
const requiredFields = ['name', 'email', 'department', 'designation'];
const requiredNoteFields = ['title', 'category', 'content'];
const timetableDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timetableIcons = ['📚', '💻', '📊', '🧠', '🧮', '🧪', '🎨', '🔬'];
const timetableColors = ['purple', 'blue', 'green', 'orange', 'pink', 'teal'];
const subjectIcons = ['📚', '💻', '🧠', '📊', '🧮', '🧪', '🔬', '🎨'];
const certificateCategories = ['Academic', 'Workshops', 'FDP / Training', 'Conferences', 'Awards', 'Other'];

app.use(express.json());

function validateFaculty(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const faculty = {};
  for (const field of requiredFields) {
    if (typeof body[field] !== 'string' || body[field].trim() === '') {
      return { error: `${field} is required.` };
    }
    faculty[field] = body[field].trim();
  }

  if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') {
    return { error: 'phone must be a string.' };
  }
  faculty.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;

  return { faculty };
}

function parseId(value) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validateNote(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const note = {};
  for (const field of requiredNoteFields) {
    if (typeof body[field] !== 'string' || body[field].trim() === '') {
      return { error: `${field} is required.` };
    }
    note[field] = body[field].trim();
  }

  for (const field of ['important', 'highlighted']) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      return { error: `${field} must be a boolean.` };
    }
    note[field] = body[field] === true ? 1 : 0;
  }

  return { note };
}

function formatNote(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    important: Boolean(row.important),
    highlighted: Boolean(row.highlighted),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateTimetable(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return { error: 'name is required.' };
  }
  if (!Array.isArray(body.days) || body.days.length === 0 || body.days.some(day => !timetableDays.includes(day))) {
    return { error: 'days must contain at least one valid working day.' };
  }
  if (new Set(body.days).size !== body.days.length) {
    return { error: 'days must not contain duplicates.' };
  }
  if (!Array.isArray(body.periods) || body.periods.length < 4 || body.periods.length > 10) {
    return { error: 'periods must contain between 4 and 10 periods.' };
  }

  const periods = [];
  for (let index = 0; index < body.periods.length; index += 1) {
    const period = body.periods[index];
    if (
      !period ||
      typeof period !== 'object' ||
      Array.isArray(period) ||
      period.number !== index + 1 ||
      typeof period.start !== 'string' ||
      typeof period.end !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.end) ||
      period.end <= period.start
    ) {
      return { error: `period ${index + 1} must have valid start and end times.` };
    }
    periods.push({ number: period.number, start: period.start, end: period.end });
  }

  if (!body.classes || typeof body.classes !== 'object' || Array.isArray(body.classes)) {
    return { error: 'classes must be an object.' };
  }

  const classes = {};
  for (const [key, value] of Object.entries(body.classes)) {
    const slot = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)-(\d{1,2})$/.exec(key);
    if (
      !slot ||
      Number(slot[2]) < 1 ||
      Number(slot[2]) > 10 ||
      !body.days.includes(slot[1]) ||
      Number(slot[2]) > periods.length
    ) {
      return { error: `class slot ${key} is invalid.` };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { error: `class at ${key} must be an object.` };
    }
    if (typeof value.subject !== 'string' || value.subject.trim() === '') {
      return { error: `class at ${key} requires a subject.` };
    }
    for (const field of ['section', 'room']) {
      if (value[field] !== undefined && typeof value[field] !== 'string') {
        return { error: `class ${field} at ${key} must be a string.` };
      }
    }
    if (value.icon !== undefined && !timetableIcons.includes(value.icon)) {
      return { error: `class icon at ${key} is invalid.` };
    }
    if (value.color !== undefined && !timetableColors.includes(value.color)) {
      return { error: `class color at ${key} is invalid.` };
    }

    classes[key] = {
      subject: value.subject.trim(),
      section: value.section || '',
      room: value.room || '',
      icon: value.icon || '📚',
      color: value.color || 'purple'
    };
  }

  if (typeof body.showOnDashboard !== 'boolean') {
    return { error: 'showOnDashboard must be a boolean.' };
  }

  return {
    timetable: {
      name: body.name.trim(),
      days: body.days,
      periods,
      classes,
      showOnDashboard: body.showOnDashboard
    }
  };
}

function formatTimetable(row) {
  return {
    id: row.id,
    name: row.name,
    days: JSON.parse(row.days),
    periods: JSON.parse(row.periods),
    classes: JSON.parse(row.classes),
    showOnDashboard: Boolean(row.show_on_dashboard)
  };
}

function saveTimetableRow(timetable) {
  return {
    name: timetable.name,
    days: JSON.stringify(timetable.days),
    periods: JSON.stringify(timetable.periods),
    classes: JSON.stringify(timetable.classes),
    show_on_dashboard: timetable.showOnDashboard ? 1 : 0
  };
}

function validateSubject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return { error: 'name is required.' };
  }

  const subject = { name: body.name.trim() };
  for (const field of ['code', 'className', 'section', 'description']) {
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      return { error: `${field} must be a string.` };
    }
    subject[field] = typeof body[field] === 'string' ? body[field].trim() : '';
  }

  const icon = body.icon === undefined ? '📚' : body.icon;
  if (typeof icon !== 'string' || !subjectIcons.includes(icon)) {
    return { error: 'icon is invalid.' };
  }
  subject.icon = icon;

  return { subject };
}

function formatSubject(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    className: row.class_name,
    section: row.section,
    icon: row.icon,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function saveSubjectRow(subject) {
  return {
    name: subject.name,
    code: subject.code,
    class_name: subject.className,
    section: subject.section,
    icon: subject.icon,
    description: subject.description
  };
}

function validatePendingWork(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  if (typeof body.task !== 'string' || body.task.trim() === '') {
    return { error: 'task is required.' };
  }
  if (typeof body.deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.deadline)) {
    return { error: 'deadline is required and must use YYYY-MM-DD format.' };
  }
  if (typeof body.category !== 'string' || !['Academic', 'Teaching', 'Department', 'Meeting', 'Personal', 'Other'].includes(body.category)) {
    return { error: 'category is required and must be valid.' };
  }
  if (body.priority !== undefined && typeof body.priority !== 'string') {
    return { error: 'priority must be a string.' };
  }
  if (body.status !== undefined && typeof body.status !== 'string') {
    return { error: 'status must be a string.' };
  }
  if (body.description !== undefined && typeof body.description !== 'string') {
    return { error: 'description must be a string.' };
  }

  const priority = body.priority || 'Medium';
  if (!['Low', 'Medium', 'High'].includes(priority)) {
    return { error: 'priority is invalid.' };
  }

  const status = body.status || 'Pending';
  if (!['Pending', 'In Progress', 'Completed'].includes(status)) {
    return { error: 'status is invalid.' };
  }

  return {
    work: {
      task: body.task.trim(),
      deadline: body.deadline,
      category: body.category,
      priority,
      status,
      description: (body.description || '').trim()
    }
  };
}

function formatPendingWork(row) {
  return {
    id: row.id,
    task: row.task,
    deadline: row.deadline,
    category: row.category,
    priority: row.priority,
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateDocument(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return { error: 'name is required.' };
  }
  if (typeof body.category !== 'string' || !['General', 'Academic', 'Teaching', 'Department', 'Schedules', 'Reports', 'Other'].includes(body.category)) {
    return { error: 'category is required and must be valid.' };
  }
  if (typeof body.fileName !== 'string' || body.fileName.trim() === '') {
    return { error: 'fileName is required.' };
  }
  if (body.fileType !== undefined && typeof body.fileType !== 'string') {
    return { error: 'fileType must be a string.' };
  }
  if (body.description !== undefined && typeof body.description !== 'string') {
    return { error: 'description must be a string.' };
  }
  if (
    body.date !== undefined &&
    body.date !== '' &&
    (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
  ) {
    return { error: 'date must use YYYY-MM-DD format.' };
  }
  if (!Number.isSafeInteger(body.fileId) || body.fileId < 1) {
    return { error: 'fileId must be a positive integer.' };
  }

  return {
    document: {
      name: body.name.trim(),
      category: body.category,
      date: body.date || '',
      description: (body.description || '').trim(),
      file_name: body.fileName.trim(),
      file_type: body.fileType || '',
      file_id: body.fileId
    }
  };
}

function formatDocument(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    date: row.date,
    description: row.description,
    fileName: row.file_name,
    fileType: row.file_type,
    fileId: row.file_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateCertificate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return { error: 'name is required.' };
  }
  if (typeof body.category !== 'string' || !certificateCategories.includes(body.category)) {
    return { error: 'category is required and must be valid.' };
  }
  if (typeof body.fileName !== 'string' || body.fileName.trim() === '') {
    return { error: 'fileName is required.' };
  }
  if (body.fileType !== undefined && typeof body.fileType !== 'string') {
    return { error: 'fileType must be a string.' };
  }
  if (body.description !== undefined && typeof body.description !== 'string') {
    return { error: 'description must be a string.' };
  }
  if (
    body.date !== undefined &&
    body.date !== '' &&
    (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
  ) {
    return { error: 'date must use YYYY-MM-DD format.' };
  }
  if (!Number.isSafeInteger(body.fileId) || body.fileId < 1) {
    return { error: 'fileId must be a positive integer.' };
  }

  return {
    certificate: {
      name: body.name.trim(),
      category: body.category,
      date: body.date || '',
      description: (body.description || '').trim(),
      file_name: body.fileName.trim(),
      file_type: body.fileType || '',
      file_id: body.fileId
    }
  };
}

function formatCertificate(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    date: row.date,
    description: row.description,
    fileName: row.file_name,
    fileType: row.file_type,
    fileId: row.file_id,
    updatedAt: row.updated_at
  };
}

app.post('/api/faculty', (req, res) => {
  const validation = validateFaculty(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const { faculty } = validation;
  const duplicate = database
    .prepare('SELECT id FROM faculty WHERE email = ? COLLATE NOCASE')
    .get(faculty.email);
  if (duplicate) return res.status(409).json({ error: 'A faculty member with this email already exists.' });

  const result = database
    .prepare(`
      INSERT INTO faculty (name, email, department, designation, phone)
      VALUES (@name, @email, @department, @designation, @phone)
    `)
    .run(faculty);
  const created = database.prepare('SELECT * FROM faculty WHERE id = ?').get(result.lastInsertRowid);

  return res.status(201).json(created);
});

app.get('/api/faculty', (req, res) => {
  const faculty = database.prepare('SELECT * FROM faculty ORDER BY id').all();
  return res.json(faculty);
});

app.get('/api/faculty/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const faculty = database.prepare('SELECT * FROM faculty WHERE id = ?').get(id);
  if (!faculty) return res.status(404).json({ error: 'Faculty member not found.' });

  return res.json(faculty);
});

app.put('/api/faculty/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const validation = validateFaculty(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const { faculty } = validation;
  const existing = database.prepare('SELECT id FROM faculty WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Faculty member not found.' });

  const duplicate = database
    .prepare('SELECT id FROM faculty WHERE email = ? COLLATE NOCASE AND id != ?')
    .get(faculty.email, id);
  if (duplicate) return res.status(409).json({ error: 'A faculty member with this email already exists.' });

  database
    .prepare(`
      UPDATE faculty
      SET name = @name,
          email = @email,
          department = @department,
          designation = @designation,
          phone = @phone,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `)
    .run({ ...faculty, id });
  const updated = database.prepare('SELECT * FROM faculty WHERE id = ?').get(id);

  return res.json(updated);
});

app.delete('/api/faculty/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const result = database.prepare('DELETE FROM faculty WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Faculty member not found.' });

  return res.json({ message: 'Faculty member deleted successfully.' });
});

function readProfile() {
  database.prepare(`
    INSERT OR IGNORE INTO profile (id, name, email)
    VALUES (1, 'Faculty', '')
  `).run();

  const row = database.prepare('SELECT * FROM profile WHERE id = 1').get();
  return {
    id: 1,
    name: row.name,
    email: row.email,
    pictureData: row.picture_data ? row.picture_data.toString('base64') : null,
    pictureMimeType: row.picture_mime_type,
    updatedAt: row.updated_at
  };
}

app.get('/api/profile', (req, res) => {
  return res.json(readProfile());
});

app.put(
  '/api/profile',
  express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }),
  (req, res) => {
    if (Buffer.isBuffer(req.body)) {
      const mimeType = (req.get('content-type') || '').split(';')[0].trim();
      if (!mimeType.startsWith('image/')) {
        return res.status(400).json({ error: 'Profile picture must be an image.' });
      }
      if (req.body.length === 0) {
        return res.status(400).json({ error: 'Profile picture cannot be empty.' });
      }

      readProfile();
      database.prepare(`
        UPDATE profile
        SET picture_data = ?, picture_mime_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(req.body, mimeType);

      return res.json(readProfile());
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object.' });
    }
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      return res.status(400).json({ error: 'name is required.' });
    }
    if (typeof body.email !== 'string' || body.email.trim() === '') {
      return res.status(400).json({ error: 'email is required.' });
    }

    database.prepare(`
      INSERT INTO profile (id, name, email)
      VALUES (1, @name, @email)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        updated_at = CURRENT_TIMESTAMP
    `).run({ name: body.name.trim(), email: body.email.trim() });

    return res.json(readProfile());
  }
);

app.get('/api/notes', (req, res) => {
  const notes = database
    .prepare('SELECT * FROM notes ORDER BY updated_at DESC, id DESC')
    .all();
  return res.json(notes.map(formatNote));
});

app.post('/api/notes', (req, res) => {
  const validation = validateNote(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      INSERT INTO notes (title, category, content, important, highlighted)
      VALUES (@title, @category, @content, @important, @highlighted)
    `)
    .run(validation.note);
  const created = database
    .prepare('SELECT * FROM notes WHERE id = ?')
    .get(result.lastInsertRowid);

  return res.status(201).json(formatNote(created));
});

app.get('/api/notes/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const note = database.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!note) return res.status(404).json({ error: 'Note not found.' });

  return res.json(formatNote(note));
});

app.put('/api/notes/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const validation = validateNote(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      UPDATE notes
      SET title = @title,
          category = @category,
          content = @content,
          important = @important,
          highlighted = @highlighted,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `)
    .run({ ...validation.note, id });
  if (result.changes === 0) return res.status(404).json({ error: 'Note not found.' });

  const updated = database.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  return res.json(formatNote(updated));
});

app.delete('/api/notes/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const result = database.prepare('DELETE FROM notes WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Note not found.' });

  return res.json({ message: 'Note deleted successfully.' });
});

app.get('/api/timetable', (req, res) => {
  const timetables = database
    .prepare('SELECT * FROM timetable ORDER BY id DESC')
    .all();
  return res.json(timetables.map(formatTimetable));
});

app.post('/api/timetable', (req, res) => {
  const validation = validateTimetable(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      INSERT INTO timetable (name, days, periods, classes, show_on_dashboard)
      VALUES (@name, @days, @periods, @classes, @show_on_dashboard)
    `)
    .run(saveTimetableRow(validation.timetable));
  const created = database
    .prepare('SELECT * FROM timetable WHERE id = ?')
    .get(result.lastInsertRowid);

  return res.status(201).json(formatTimetable(created));
});

app.put('/api/timetable/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const validation = validateTimetable(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      UPDATE timetable
      SET name = @name,
          days = @days,
          periods = @periods,
          classes = @classes,
          show_on_dashboard = @show_on_dashboard
      WHERE id = @id
    `)
    .run({ ...saveTimetableRow(validation.timetable), id });
  if (result.changes === 0) return res.status(404).json({ error: 'Timetable not found.' });

  const updated = database.prepare('SELECT * FROM timetable WHERE id = ?').get(id);
  return res.json(formatTimetable(updated));
});

app.delete('/api/timetable/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const result = database.prepare('DELETE FROM timetable WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Timetable not found.' });

  return res.json({ message: 'Timetable deleted successfully.' });
});

app.get('/api/subjects', (req, res) => {
  const subjects = database
    .prepare('SELECT * FROM subjects ORDER BY id ASC')
    .all();
  return res.json(subjects.map(formatSubject));
});

app.post('/api/subjects', (req, res) => {
  const validation = validateSubject(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      INSERT INTO subjects (name, code, class_name, section, icon, description)
      VALUES (@name, @code, @class_name, @section, @icon, @description)
    `)
    .run(saveSubjectRow(validation.subject));
  const created = database
    .prepare('SELECT * FROM subjects WHERE id = ?')
    .get(result.lastInsertRowid);

  return res.status(201).json(formatSubject(created));
});

app.put('/api/subjects/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const validation = validateSubject(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      UPDATE subjects
      SET name = @name,
          code = @code,
          class_name = @class_name,
          section = @section,
          icon = @icon,
          description = @description,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `)
    .run({ ...saveSubjectRow(validation.subject), id });
  if (result.changes === 0) return res.status(404).json({ error: 'Subject not found.' });

  const updated = database.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
  return res.json(formatSubject(updated));
});

app.delete('/api/subjects/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const result = database.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Subject not found.' });

  return res.json({ message: 'Subject deleted successfully.' });
});

app.get('/api/pending-works', (req, res) => {
  const works = database
    .prepare('SELECT * FROM pending_works ORDER BY id ASC')
    .all();
  return res.json(works.map(formatPendingWork));
});

app.get('/api/pendingWorks', (req, res) => {
  const works = database
    .prepare('SELECT * FROM pending_works ORDER BY id ASC')
    .all();
  return res.json(works.map(formatPendingWork));
});

app.post('/api/pending-works', (req, res) => {
  const validation = validatePendingWork(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      INSERT INTO pending_works (task, deadline, category, priority, status, description)
      VALUES (@task, @deadline, @category, @priority, @status, @description)
    `)
    .run(validation.work);
  const created = database
    .prepare('SELECT * FROM pending_works WHERE id = ?')
    .get(result.lastInsertRowid);

  return res.status(201).json(formatPendingWork(created));
});

app.post('/api/pendingWorks', (req, res) => {
  const validation = validatePendingWork(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      INSERT INTO pending_works (task, deadline, category, priority, status, description)
      VALUES (@task, @deadline, @category, @priority, @status, @description)
    `)
    .run(validation.work);
  const created = database
    .prepare('SELECT * FROM pending_works WHERE id = ?')
    .get(result.lastInsertRowid);

  return res.status(201).json(formatPendingWork(created));
});

app.put('/api/pending-works/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const validation = validatePendingWork(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      UPDATE pending_works
      SET task = @task,
          deadline = @deadline,
          category = @category,
          priority = @priority,
          status = @status,
          description = @description,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `)
    .run({ ...validation.work, id });
  if (result.changes === 0) return res.status(404).json({ error: 'Work not found.' });

  const updated = database.prepare('SELECT * FROM pending_works WHERE id = ?').get(id);
  return res.json(formatPendingWork(updated));
});

app.put('/api/pendingWorks/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const validation = validatePendingWork(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      UPDATE pending_works
      SET task = @task,
          deadline = @deadline,
          category = @category,
          priority = @priority,
          status = @status,
          description = @description,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `)
    .run({ ...validation.work, id });
  if (result.changes === 0) return res.status(404).json({ error: 'Work not found.' });

  const updated = database.prepare('SELECT * FROM pending_works WHERE id = ?').get(id);
  return res.json(formatPendingWork(updated));
});

app.delete('/api/pending-works/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const result = database.prepare('DELETE FROM pending_works WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Work not found.' });

  return res.json({ message: 'Work deleted successfully.' });
});

app.delete('/api/pendingWorks/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const result = database.prepare('DELETE FROM pending_works WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Work not found.' });

  return res.json({ message: 'Work deleted successfully.' });
});

app.get('/api/documents', (req, res) => {
  const documents = database
    .prepare('SELECT * FROM documents ORDER BY id ASC')
    .all();
  return res.json(documents.map(formatDocument));
});

app.post('/api/documents', (req, res) => {
  const validation = validateDocument(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      INSERT INTO documents (name, category, date, description, file_name, file_type, file_id)
      VALUES (@name, @category, @date, @description, @file_name, @file_type, @file_id)
    `)
    .run(validation.document);
  const created = database
    .prepare('SELECT * FROM documents WHERE id = ?')
    .get(result.lastInsertRowid);

  return res.status(201).json(formatDocument(created));
});

app.put('/api/documents/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const validation = validateDocument(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      UPDATE documents
      SET name = @name,
          category = @category,
          date = @date,
          description = @description,
          file_name = @file_name,
          file_type = @file_type,
          file_id = @file_id,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `)
    .run({ ...validation.document, id });
  if (result.changes === 0) return res.status(404).json({ error: 'Document not found.' });

  const updated = database.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  return res.json(formatDocument(updated));
});

app.delete('/api/documents/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const result = database.prepare('DELETE FROM documents WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Document not found.' });

  return res.json({ message: 'Document deleted successfully.' });
});

app.get('/api/certificates', (req, res) => {
  const certificates = database
    .prepare('SELECT * FROM certificates ORDER BY id ASC')
    .all();
  return res.json(certificates.map(formatCertificate));
});

app.post('/api/certificates', (req, res) => {
  const validation = validateCertificate(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      INSERT INTO certificates (name, category, date, description, file_name, file_type, file_id)
      VALUES (@name, @category, @date, @description, @file_name, @file_type, @file_id)
    `)
    .run(validation.certificate);
  const created = database
    .prepare('SELECT * FROM certificates WHERE id = ?')
    .get(result.lastInsertRowid);

  return res.status(201).json(formatCertificate(created));
});

app.put('/api/certificates/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const validation = validateCertificate(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const result = database
    .prepare(`
      UPDATE certificates
      SET name = @name,
          category = @category,
          date = @date,
          description = @description,
          file_name = @file_name,
          file_type = @file_type,
          file_id = @file_id,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `)
    .run({ ...validation.certificate, id });
  if (result.changes === 0) return res.status(404).json({ error: 'Certificate not found.' });

  const updated = database.prepare('SELECT * FROM certificates WHERE id = ?').get(id);
  return res.json(formatCertificate(updated));
});

app.delete('/api/certificates/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer.' });

  const result = database.prepare('DELETE FROM certificates WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Certificate not found.' });

  return res.json({ message: 'Certificate deleted successfully.' });
});

app.use(express.static(path.join(__dirname, 'faculty-management-system')));

app.use((error, req, res, next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const message = status === 400 ? 'Invalid JSON request body.' : 'Internal server error.';
  return res.status(status).json({ error: message });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Faculty API listening on port ${port}`));
}

module.exports = app;