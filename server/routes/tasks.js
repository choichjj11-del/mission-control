const express = require('express');
const router = express.Router();
const { readData, writeData, getNextTaskId } = require('../lib/dataStore');

// GET /api/tasks — 전체 태스크 (필터 지원)
router.get('/', (req, res) => {
  const data = readData();
  let tasks = data.tasks;

  // Optional filters
  const { priority, category, section, status } = req.query;
  if (priority) tasks = tasks.filter(t => t.priority === priority);
  if (category) tasks = tasks.filter(t => t.category === category);
  if (section) tasks = tasks.filter(t => t.section === section);
  if (status) tasks = tasks.filter(t => t.status === status);

  res.json({ total: tasks.length, tasks });
});

// GET /api/tasks/:id — 단일 태스크
router.get('/:id', (req, res) => {
  const data = readData();
  const task = data.tasks.find(t => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /api/tasks — 태스크 추가
router.post('/', (req, res) => {
  const data = readData();
  const { name, desc, category, priority, section, day, duration_min, tags } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const newTask = {
    id: getNextTaskId(data),
    name,
    desc: desc || '',
    category: category || 'content',
    priority: priority || '단기',
    section: section || '',
    status: 'todo',
    done_at: null,
    day: day || null,
    duration_min: duration_min || null,
    tags: tags || [],
    created_at: new Date().toISOString(),
  };

  data.tasks.push(newTask);
  writeData(data);

  res.status(201).json(newTask);
});

// PATCH /api/tasks/:id — 태스크 수정
router.patch('/:id', (req, res) => {
  const data = readData();
  const idx = data.tasks.findIndex(t => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const allowedFields = ['name', 'desc', 'category', 'priority', 'section', 'status', 'day', 'duration_min', 'tags'];
  const updates = req.body;

  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      data.tasks[idx][key] = updates[key];
    }
  }

  // Auto-set done_at when status changes to done
  if (updates.status === 'done' && !data.tasks[idx].done_at) {
    data.tasks[idx].done_at = new Date().toISOString();
  }
  // Clear done_at if unchecked
  if (updates.status === 'todo') {
    data.tasks[idx].done_at = null;
  }

  writeData(data);
  res.json(data.tasks[idx]);
});

// DELETE /api/tasks/:id — 태스크 삭제
router.delete('/:id', (req, res) => {
  const data = readData();
  const idx = data.tasks.findIndex(t => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const deleted = data.tasks.splice(idx, 1)[0];
  writeData(data);
  res.json({ deleted });
});

module.exports = router;
