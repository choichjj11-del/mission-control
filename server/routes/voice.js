const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readData, writeData, getNextTaskId, compressedTaskList } = require('../lib/dataStore');
const { transcribeAudio, agentProcess, parseVoiceTodos } = require('../lib/ai');
const { addReminder } = require('../lib/reminders');

// Multer setup: save audio to /tmp
const upload = multer({
  dest: path.join(__dirname, '../../data/uploads/'),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// POST /api/voice/upload
// Flow: Audio → ElevenLabs Scribe → GPT-4o-mini Agent → Smart actions
router.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  try {
    // Step 1: ElevenLabs Scribe STT
    const transcript = await transcribeAudio(req.file.path);

    // Step 2: GPT-4o-mini smart agent
    const data = readData(req.user.uid);
    const compressed = compressedTaskList(data);
    const todayDate = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    const actions = await agentProcess(transcript, compressed, todayDate);

    // Step 3: Apply actions
    const actionsList = Array.isArray(actions) ? actions : [actions];
    const results = [];

    for (const action of actionsList) {
      const result = applyAction(data, action);
      results.push(result);
    }

    writeData(data, req.user.uid);

    // Cleanup uploaded file
    fs.unlink(req.file.path, () => {});

    res.json({
      transcript,
      actions_taken: results,
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Voice processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice/text — Text input (skip STT, useful for testing)
router.post('/text', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const data = readData(req.user.uid);
    const compressed = compressedTaskList(data);
    const todayDate = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    const actions = await agentProcess(text, compressed, todayDate);

    const actionsList = Array.isArray(actions) ? actions : [actions];
    const results = [];

    for (const action of actionsList) {
      const result = applyAction(data, action);
      results.push(result);
    }

    writeData(data, req.user.uid);

    res.json({
      transcript: text,
      actions_taken: results,
    });
  } catch (err) {
    console.error('Text processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice/todo
// Flow: Audio → Scribe STT → GPT → To-Do list items
router.post('/todo', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  try {
    const transcript = await transcribeAudio(req.file.path);
    const todos = await parseVoiceTodos(transcript);

    fs.unlink(req.file.path, () => {});

    res.json({
      transcript,
      todos: Array.isArray(todos) ? todos : [],
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Voice todo processing error:', err);
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
        desc: action.desc || action.note || '',
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
    case 'schedule': {
      const task = data.tasks.find(t => t.id === action.task_id);
      if (task) {
        task.day = action.day;
        return { action: 'schedule', task_id: task.id, task_name: task.name, day: action.day };
      }
      return { action: 'schedule', error: `Task ${action.task_id} not found` };
    }
    case 'prioritize': {
      const task = data.tasks.find(t => t.id === action.task_id);
      if (task) {
        task.priority = action.priority;
        return { action: 'prioritize', task_id: task.id, task_name: task.name, priority: action.priority };
      }
      return { action: 'prioritize', error: `Task ${action.task_id} not found` };
    }
    case 'remind': {
      addReminder({
        message: action.message,
        remind_at: action.remind_at,
        created_at: new Date().toISOString(),
      });
      return { action: 'remind', message: action.message, remind_at: action.remind_at };
    }
    case 'query': {
      return { action: 'query', response: action.response };
    }
    case 'report': {
      return { action: 'report', response: action.response };
    }
    case 'note': {
      // Store note in brain_dumps
      data.brain_dumps.push({
        id: `note-${Date.now()}`,
        text: action.note,
        audio_url: null,
        parsed: false,
        created_at: new Date().toISOString(),
        resulting_actions: [],
      });
      return { action: 'note', note: action.note };
    }
    case 'commit': {
      const task = data.tasks.find(t => t.id === action.task_id);
      if (task) {
        task.commitment_deadline = action.deadline || null;
        task.commitment_stake = action.stake || null;
        return { action: 'commit', task_id: task.id, task_name: task.name, deadline: action.deadline, stake: action.stake };
      }
      return { action: 'commit', error: `Task ${action.task_id} not found` };
    }
    default:
      return { action: 'unknown', raw: action };
  }
}

module.exports = router;
