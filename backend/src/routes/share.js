import express from 'express';
import crypto from 'crypto';
import Project from '../models/Project.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = () => crypto.randomBytes(16).toString('hex');

// POST /api/share/:projectId/enable — make project public, return share URL
router.post('/:projectId/enable', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!project.shareToken) project.shareToken = generateToken();
    project.isPublic = true;
    await project.save();

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shared/${project.shareToken}`;
    res.json({ shareToken: project.shareToken, shareUrl, isPublic: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/share/:projectId/disable — revoke public access
router.post('/:projectId/disable', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    project.isPublic = false;
    project.shareToken = null;
    await project.save();

    res.json({ isPublic: false, message: 'Sharing disabled' });
  } catch (err) {
    next(err);
  }
});

// POST /api/share/:projectId/regenerate — regenerate share token
router.post('/:projectId/regenerate', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    project.shareToken = generateToken();
    project.isPublic = true;
    await project.save();

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shared/${project.shareToken}`;
    res.json({ shareToken: project.shareToken, shareUrl, isPublic: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/share/view/:token — public read-only project view (no auth required)
router.get('/view/:token', async (req, res, next) => {
  try {
    const project = await Project.findOne({ shareToken: req.params.token, isPublic: true })
      .select('-chatHistory -versions')
      .populate('owner', 'username');

    if (!project) return res.status(404).json({ message: 'Project not found or sharing disabled' });

    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// GET /api/share/:projectId/status — get current share status (owner only)
router.get('/:projectId/status', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id })
      .select('isPublic shareToken');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const shareUrl = project.shareToken
      ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shared/${project.shareToken}`
      : null;

    res.json({ isPublic: project.isPublic, shareToken: project.shareToken, shareUrl });
  } catch (err) {
    next(err);
  }
});

export default router;
