const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { transcribeAudio } = require('../services/whisper');
const { classifyVoiceInput } = require('../services/ai');
const { readData, writeData, getNextTaskId } = require('../utils/store');
const { writeMarkdown } = require('../utils/markdown');

const router = express.Router();

// 음성 파일 임시 저장
const upload = multer({
  dest: path.join(__dirname, '../../data/uploads/'),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.m4a', '.wav', '.webm', '.mp4', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

/**
 * POST /api/voice/upload
 * 음성 파일 → Whisper STT → Haiku 분류기 → 태스크 자동 업데이트
 */
router.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

  try {
    // Step 1: Whisper STT
    const transcript = await transcribeAudio(req.file.path);

    // Step 2: Haiku classifier
    const data = readData();
    const result = await classifyVoiceInput(transcript, data.tasks);

    // Step 3: Apply actions
    const actionsTaken = [];
    for (const action of result.actions || []) {
      if (action.action === 'check' && action.task_id) {
        const task = data.tasks.find(t => t.id === action.task_id);
        if (task) {
          task.status = 'done';
          task.done_at = new Date().toISOString();
          actionsTaken.push({ action: 'check', task_id: task.id, name: task.name });
        }
      } else if (action.action === 'uncheck' && action.task_id) {
        const task = data.tasks.find(t => t.id === action.task_id);
        if (task) {
          task.status = 'todo';
          task.done_at = null;
          actionsTaken.push({ action: 'uncheck', task_id: task.id, name: task.name });
        }
      } else if (action.action === 'add' && action.name) {
        const newTask = {
          id: getNextTaskId(data),
          name: action.name,
          desc: action.desc || null,
          category: action.category || 'content',
          priority: action.priority || '단기',
          section: action.section || null,
          status: 'todo',
          done_at: null,
          day: null,
          duration_min: null,
          tags: [],
          created_at: new Date().toISOString()
        };
        data.tasks.push(newTask);
        actionsTaken.push({ action: 'add', task_id: newTask.id, name: newTask.name });
      } else if (action.action === 'note') {
        actionsTaken.push({ action: 'note', note: action.note });
      }
    }

    writeData(data);
    writeMarkdown();

    // Cleanup uploaded file
    fs.unlink(req.file.path, () => {});

    res.json({
      transcript,
      actions_taken: actionsTaken,
      raw_classification: result,
    });
  } catch (err) {
    // Cleanup on error
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('[Voice] Error:', err.message);
    res.status(500).json({ error: 'Voice processing failed', detail: err.message });
  }
});

/**
 * POST /api/voice/text
 * 텍스트 직접 입력 → Haiku 분류기 (Whisper 생략)
 */
router.post('/text', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const data = readData();
    const result = await classifyVoiceInput(text, data.tasks);

    const actionsTaken = [];
    for (const action of result.actions || []) {
      if (action.action === 'check' && action.task_id) {
        const task = data.tasks.find(t => t.id === action.task_id);
        if (task) {
          task.status = 'done';
          task.done_at = new Date().toISOString();
          actionsTaken.push({ action: 'check', task_id: task.id, name: task.name });
        }
      } else if (action.action === 'add' && action.name) {
        const newTask = {
          id: getNextTaskId(data),
          name: action.name,
          desc: action.desc || null,
          category: action.category || 'content',
          priority: action.priority || '단기',
          section: action.section || null,
          status: 'todo',
          done_at: null,
          day: null,
          duration_min: null,
          tags: [],
          created_at: new Date().toISOString()
        };
        data.tasks.push(newTask);
        actionsTaken.push({ action: 'add', task_id: newTask.id, name: newTask.name });
      }
    }

    writeData(data);
    writeMarkdown();

    res.json({ text, actions_taken: actionsTaken, raw_classification: result });
  } catch (err) {
    console.error('[Voice/Text] Error:', err.message);
    res.status(500).json({ error: 'Classification failed', detail: err.message });
  }
});

module.exports = router;
