const express = require('express');
const { parseBrainDump } = require('../services/ai');
const { readData, writeData, getNextTaskId } = require('../utils/store');
const { writeMarkdown } = require('../utils/markdown');

const router = express.Router();

/**
 * POST /api/braindump
 * 텍스트 브레인덤프 → Sonnet 파서 → 새 태스크 추출
 */
router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const data = readData();
    const parsed = await parseBrainDump(text, data.tasks);

    const newTasks = [];
    const updates = [];

    // Add new tasks
    for (const t of parsed.new_tasks || []) {
      const newTask = {
        id: getNextTaskId(data),
        name: t.name,
        desc: t.desc || null,
        category: t.category || 'content',
        priority: t.priority || '단기',
        section: t.section || null,
        status: 'todo',
        done_at: null,
        day: null,
        duration_min: null,
        tags: [],
        created_at: new Date().toISOString()
      };
      data.tasks.push(newTask);
      newTasks.push(newTask);
    }

    // Apply updates
    for (const u of parsed.updates || []) {
      const task = data.tasks.find(t => t.id === u.task_id);
      if (task && u.field && u.value !== undefined) {
        task[u.field] = u.value;
        updates.push({ task_id: task.id, name: task.name, field: u.field });
      }
    }

    // Record brain dump
    data.brain_dumps = data.brain_dumps || [];
    data.brain_dumps.push({
      id: `bd-${Date.now()}`,
      text,
      parsed: true,
      created_at: new Date().toISOString(),
      resulting_actions: [
        ...newTasks.map(t => ({ type: 'add_task', task_id: t.id })),
        ...updates.map(u => ({ type: 'update_task', task_id: u.task_id })),
      ]
    });

    writeData(data);
    writeMarkdown();

    res.json({
      new_tasks: newTasks,
      updated_tasks: updates,
      summary: parsed.summary || null,
    });
  } catch (err) {
    console.error('[BrainDump] Error:', err.message);
    res.status(500).json({ error: 'Brain dump processing failed', detail: err.message });
  }
});

module.exports = router;
