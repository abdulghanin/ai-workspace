import express from 'express';
import Project from '../models/Project.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Default files for each project type
const getDefaultFiles = (type) => {
  if (type === 'javascript') {
    return [
      { name: 'index.js', path: '/index.js', content: '// Welcome to your JavaScript workspace!\n\nconsole.log("Hello, World!");\n', language: 'javascript', parentPath: '/' },
      { name: 'README.md', path: '/README.md', content: '# My JavaScript Project\n\nStart coding in `index.js`!\n', language: 'markdown', parentPath: '/' },
    ];
  }
  if (type === 'python') {
    return [
      { name: 'main.py', path: '/main.py', content: '# Welcome to your Python workspace!\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n', language: 'python', parentPath: '/' },
      { name: 'README.md', path: '/README.md', content: '# My Python Project\n\nStart coding in `main.py`!\n', language: 'markdown', parentPath: '/' },
    ];
  }
  if (type === 'website') {
    return [
      {
        name: 'index.html', path: '/index.html', language: 'html', parentPath: '/',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Website</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-gray-100">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-4xl font-bold text-gray-800">Welcome to My Website</h1>
    <p class="mt-4 text-gray-600">Start building your website here!</p>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
      },
      { name: 'styles.css', path: '/styles.css', content: '/* Custom styles */\nbody {\n  font-family: system-ui, sans-serif;\n}\n', language: 'css', parentPath: '/' },
      { name: 'script.js', path: '/script.js', content: '// Your JavaScript code here\nconsole.log("Page loaded!");\n', language: 'javascript', parentPath: '/' },
    ];
  }
  return [];
};

// GET /api/projects - Get all projects for current user
router.get('/', protect, async (req, res, next) => {
  try {
    const { type } = req.query;
    const query = { owner: req.user._id };
    if (type) query.type = type;

    const projects = await Project.find(query)
      .select('-files.content -chatHistory')
      .sort({ updatedAt: -1 });

    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects - Create a new project
router.post('/', protect, async (req, res, next) => {
  try {
    const { name, description, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }

    const project = await Project.create({
      name,
      description,
      type,
      owner: req.user._id,
      files: getDefaultFiles(type),
    });

    res.status(201).json({ message: 'Project created', project });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id - Get single project with files
router.get('/:id', protect, async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:id - Update project metadata
router.put('/:id', protect, async (req, res, next) => {
  try {
    const { name, description, lastOpenedFile } = req.body;

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { name, description, lastOpenedFile },
      { new: true, runValidators: true }
    ).select('-files.content -chatHistory');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
