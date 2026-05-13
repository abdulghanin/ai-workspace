import express from 'express';
import Project from '../models/Project.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const detectLanguage = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const langMap = { js: 'javascript', py: 'python', html: 'html', css: 'css', json: 'json', md: 'markdown' };
  return langMap[ext] || 'text';
};

// GET /api/files/:projectId - Get all files for a project
router.get('/:projectId', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    }).select('files type name');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ files: project.files });
  } catch (error) {
    next(error);
  }
});

// GET /api/files/:projectId/:filePath - Get file content
router.get('/:projectId/content/*', protect, async (req, res, next) => {
  try {
    const filePath = '/' + req.params[0];
    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const file = project.files.find(f => f.path === filePath);
    if (!file) return res.status(404).json({ message: 'File not found' });

    res.json({ file });
  } catch (error) {
    next(error);
  }
});

// POST /api/files/:projectId - Create a new file
router.post('/:projectId', protect, async (req, res, next) => {
  try {
    const { name, path, content = '', parentPath = '/', isFolder = false } = req.body;

    if (!name || !path) {
      return res.status(400).json({ message: 'Name and path are required' });
    }

    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Check for duplicate path
    if (project.files.some(f => f.path === path)) {
      return res.status(400).json({ message: 'A file with this path already exists' });
    }

    const newFile = {
      name,
      path,
      content,
      language: isFolder ? 'text' : detectLanguage(name),
      isFolder,
      parentPath,
      updatedAt: new Date(),
    };

    project.files.push(newFile);
    await project.save();

    res.status(201).json({ file: project.files[project.files.length - 1] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/files/:projectId/:fileId - Update file content
router.put('/:projectId/:fileId', protect, async (req, res, next) => {
  try {
    const { content, name } = req.body;

    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const fileIndex = project.files.findIndex(f => f._id.toString() === req.params.fileId);
    if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });

    if (content !== undefined) project.files[fileIndex].content = content;
    if (name !== undefined) {
      project.files[fileIndex].name = name;
      project.files[fileIndex].language = detectLanguage(name);
    }
    project.files[fileIndex].updatedAt = new Date();
    project.markModified('files');

    await project.save();

    res.json({ file: project.files[fileIndex] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/files/:projectId/:fileId - Delete a file
router.delete('/:projectId/:fileId', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const fileIndex = project.files.findIndex(f => f._id.toString() === req.params.fileId);
    if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });

    const deletedFile = project.files[fileIndex];

    // If deleting folder, also delete children
    if (deletedFile.isFolder) {
      project.files = project.files.filter(f => !f.path.startsWith(deletedFile.path + '/') && f._id.toString() !== req.params.fileId);
    } else {
      project.files.splice(fileIndex, 1);
    }

    project.markModified('files');
    await project.save();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
