const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readData, writeData, getNextTaskId, compressedTaskList } = require('../lib/dataStore');
const { transcribeAudio, classifyVoiceInput } = require('../lib/ai');

// Multer setup: save audio to /tmp
const upload = multer({
  dest: path.join(__dirname, '../../data/uploads/'),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max (Whisper limit)
});

// POST /api/voice/upload
// Flow: Audio → Whisper STT → Haiku Classifier → Auto task update
router.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  try {
    // Step 1: Whisper STT
    const transcript = await transcribeAudio(req.file.path);

    // Step 2: Haiku classifier (token-saving: ID+name only)
    const data = readData();
    const compressed = compressedTaskList(data);
    const actions = await classifyVoiceInput(transcript, compressed);

    // Step 3: Apply actions
    const actionsList = Array.isArray(actions) ? actions : [actions];
    const results = [];

    for (const action of actionsList) {
      const result = applyAction(data, action);
      results.push(result);
    }

    writeData(data);

    // Cleanup uploaded file
    fs.unlink(req.file.path, () => {});

    res.json({
      transcript,
      actions_taken: results,
    });
  } catch (err) {
    // Cleanup on error
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Voice processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice/text — Text input (skip Whisper, useful for testing)
router.post('/text', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const data = readData();
    const compressed = compressedTaskList(data);
    const actions = await classifyVoiceInput(text, compressed);

    const actionsList = Array.isArray(actions) ? actions : [actions];
    const results = [];

    for (const action of actionsList) {
      const result = applyAction(data, action);
      results.push(result);
    }

    writeData(data);

    res.json({
      transcript: text,
      actions_taken: results,
    });
  } catch (err) {
    console.error('Text processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

function applyAction(data, action) {
  switch (action.action) {
    case 'check': {
      const task = data.tasks.find(t => t.id === action.task_id);
      if (task) {
        task.status = 'done';
        task.done_at = new Date().toISOString();
        return { action: 'check', task_id: task.id, task_name: task.name, note: action.note };
      }
      return { action: 'check', error: `Task ${action.task_id} not found` };
    }
    case 'uncheck': {
      const task = data.tasks.find(t => t.id === action.task_id);
      if (task) {
        task.status = 'todo';
        task.done_at = null;
        return { action: 'uncheck', task_id: task.id, task_name: task.name };
      }
      return { action: 'uncheck', error: `Task ${action.task_id} not found` };
    }
    case 'add': {
      const newTask = {
        id: getNextTaskId(data),
        name: action.new_task || action.note || 'New task',
        desc: action.note || '',
        category: action.category || 'content',
        priority: action.priority || '단기',
        section: action.section || '',
        status: 'todo',
        done_at: null,
        day: null,
        duration_min: null,
        tags: [],
        created_at: new Date().toISOString(),
      };
      data.tasks.push(newTask);
      return { action: 'add', task_id: newTask.id, task_name: newTask.name };
    }
    case 'update': {
      const task = data.tasks.find(t => t.id === action.task_id);
      if (task) {
        if (action.note) task.desc = (task.desc ? task.desc + ' | ' : '') + action.note;
        return { action: 'update', task_id: task.id, task_name: task.name, note: action.note };
      }
      return { action: 'update', error: `Task ${action.task_id} not found` };
    }
    case 'note': {
      return { action: 'note', note: action.note };
    }
    default:
      return { action: 'unknown', raw: action };
  }
}

module.exports = router;
