const express = require('express');
const { readData, writeData, getNextTaskId } = require('../utils/store');
const { writeMarkdown } = require('../utils/markdown');

const router = express.Router();

// GET /api/tasks — 전체 태스크 목록
router.get('/', (req, res) => {
  const data = readData();
  const { priority, section, status, day } = req.query;

  let tasks = data.tasks;
  if (priority) tasks = tasks.filter(t => t.priority === priority);
  if (section) tasks = tasks.filter(t => t.section === section);
  if (status) tasks = tasks.filter(t => t.status === status);
  if (day) tasks = tasks.filter(t => t.day === parseInt(day));

  res.json({ tasks, total: tasks.length, updated_at: data.updated_at });
});

// GET /api/tasks/:id — 단일 태스크
router.get('/:id', (req, res) => {
  const data = readData();
  const task = data.tasks.find(t => t.id === parseInt(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /api/tasks — 태스크 추가
router.post('/', (req, res) => {
  const data = readData();
  const { name, desc, category, priority, section, day, duration_min, tags } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const task = {
    id: getNextTaskId(data),
    name,
    desc: desc || null,
    category: category || 'content',
    priority: priority || '단기',
    section: section || null,
    status: 'todo',
    done_at: null,
    day: day || null,
    duration_min: duration_min || null,
    tags: tags || [],
    created_at: new Date().toISOString()
  };

  data.tasks.push(task);
  writeData(data);
  writeMarkdown();

  res.status(201).json(task);
});

// PATCH /api/tasks/:id — 태스크 수정
router.patch('/:id', (req, res) => {
  const data = readData();
  const idx = data.tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const allowed = ['name', 'desc', 'category', 'priority', 'section', 'status', 'day', 'duration_min', 'tags'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  // Handle done status
  if (updates.status === 'done' && data.tasks[idx].status !== 'done') {
    updates.done_at = new Date().toISOString();
  } else if (updates.status === 'todo') {
    updates.done_at = null;
  }

  data.tasks[idx] = { ...data.tasks[idx], ...updates };
  writeData(data);
  writeMarkdown();

  res.json(data.tasks[idx]);
});

// DELETE /api/tasks/:id — 태스크 삭제
router.delete('/:id', (req, res) => {
  const data = readData();
  const idx = data.tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const removed = data.tasks.splice(idx, 1)[0];
  writeData(data);
  writeMarkdown();

  res.json({ deleted: removed.id, name: removed.name });
});

module.exports = router;
