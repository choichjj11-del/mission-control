const express = require('express');
const router = express.Router();
const { readData, writeData, getNextTaskId } = require('../lib/dataStore');
const { parseBrainDump } = require('../lib/ai');

// POST /api/braindump
// Input: { text: "긴 브레인덤프 텍스트..." }
// Output: { new_tasks, updated_tasks, summary }
router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const data = readData(req.user.uid);

    // Send task list (names + priorities, no full descriptions) to GPT-4o-mini
    const taskList = data.tasks.map(t => ({
      id: t.id,
      name: t.name,
      priority: t.priority,
    }));

    const parsed = await parseBrainDump(text, taskList);

    // Apply new tasks
    const addedTasks = [];
    if (parsed.new_tasks && parsed.new_tasks.length > 0) {
      for (const nt of parsed.new_tasks) {
        const newTask = {
          id: getNextTaskId(data),
          name: nt.name,
          desc: nt.desc || '',
          category: nt.category || 'content',
          priority: nt.priority || '단기',
          section: nt.section || '',
          status: 'todo',
          done_at: null,
          day: null,
          duration_min: null,
          tags: [],
          created_at: new Date().toISOString(),
        };
        data.tasks.push(newTask);
        addedTasks.push(newTask);
      }
    }

    // Apply updates
    const updatedTasks = [];
    if (parsed.updates && parsed.updates.length > 0) {
      for (const upd of parsed.updates) {
        const task = data.tasks.find(t => t.id === upd.task_id);
        if (task && upd.field && upd.value !== undefined) {
          const allowedFields = ['name', 'desc', 'category', 'priority', 'section', 'status'];
          if (allowedFields.includes(upd.field)) {
            task[upd.field] = upd.value;
            updatedTasks.push({ id: task.id, name: task.name, field: upd.field, value: upd.value });
          }
        }
      }
    }

    // Save brain dump record
    const bdRecord = {
      id: `bd-${Date.now()}`,
      text,
      audio_url: null,
      parsed: true,
      created_at: new Date().toISOString(),
      resulting_actions: [
        ...addedTasks.map(t => ({ type: 'add_task', task_id: t.id })),
        ...updatedTasks.map(u => ({ type: 'update_task', task_id: u.id, field: u.field })),
      ],
    };
    data.brain_dumps.push(bdRecord);

    writeData(data, req.user.uid);

    res.json({
      new_tasks: addedTasks,
      updated_tasks: updatedTasks,
      summary: parsed.summary || '',
      brain_dump_id: bdRecord.id,
    });
  } catch (err) {
    console.error('Brain dump error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/braindump — 브레인덤프 히스토리
router.get('/', (req, res) => {
  const data = readData(req.user.uid);
  res.json({ brain_dumps: data.brain_dumps });
});

module.exports = router;
