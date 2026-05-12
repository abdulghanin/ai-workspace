import express from 'express';
import Project from '../models/Project.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /api/versions/:projectId — list all versions (no file content, just metadata)
router.get('/:projectId', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id })
      .select('versions')
      .populate('versions.author', 'username');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Return metadata only (no content) for the list view
    const versions = project.versions.map(v => ({
      _id: v._id,
      message: v.message,
      label: v.label,
      author: v.author,
      createdAt: v.createdAt,
      fileCount: v.files.filter(f => !f.isFolder).length,
    })).reverse(); // newest first

    res.json({ versions });
  } catch (err) {
    next(err);
  }
});

// POST /api/versions/:projectId — create a new version snapshot
router.post('/:projectId', protect, async (req, res, next) => {
  try {
    const { message = 'Saved version', label = '' } = req.body;

    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Deep-copy current files into the snapshot
    const snapshot = project.files.map(f => ({
      name: f.name,
      path: f.path,
      content: f.content,
      language: f.language,
      isFolder: f.isFolder,
      parentPath: f.parentPath,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    project.versions.push({ message, label, files: snapshot, author: req.user._id });

    // Keep max 50 versions (trim oldest)
    if (project.versions.length > 50) {
      project.versions = project.versions.slice(project.versions.length - 50);
    }

    project.markModified('versions');
    await project.save();

    const newVersion = project.versions[project.versions.length - 1];
    res.status(201).json({
      version: {
        _id: newVersion._id,
        message: newVersion.message,
        label: newVersion.label,
        createdAt: newVersion.createdAt,
        fileCount: snapshot.filter(f => !f.isFolder).length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/versions/:projectId/:versionId — get full file content of a version
router.get('/:projectId/:versionId', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id })
      .select('versions');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const version = project.versions.id(req.params.versionId);
    if (!version) return res.status(404).json({ message: 'Version not found' });

    res.json({ version });
  } catch (err) {
    next(err);
  }
});

// POST /api/versions/:projectId/:versionId/restore — restore project files to this version
router.post('/:projectId/:versionId/restore', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const version = project.versions.id(req.params.versionId);
    if (!version) return res.status(404).json({ message: 'Version not found' });

    // Auto-save current state before restoring
    const currentSnapshot = project.files.map(f => ({
      name: f.name, path: f.path, content: f.content,
      language: f.language, isFolder: f.isFolder, parentPath: f.parentPath,
    }));
    project.versions.push({
      message: `Auto-save before restore to "${version.message}"`,
      files: currentSnapshot,
      author: req.user._id,
    });

    // Restore files from snapshot
    project.files = version.files.map(f => ({
      name: f.name, path: f.path, content: f.content,
      language: f.language, isFolder: f.isFolder, parentPath: f.parentPath,
    }));

    project.markModified('files');
    project.markModified('versions');
    await project.save();

    res.json({ message: 'Version restored', files: project.files });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/versions/:projectId/:versionId — delete a specific version
router.delete('/:projectId/:versionId', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    project.versions = project.versions.filter(v => v._id.toString() !== req.params.versionId);
    project.markModified('versions');
    await project.save();

    res.json({ message: 'Version deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
