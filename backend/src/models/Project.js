import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  path: { type: String, required: true },
  content: { type: String, default: '' },
  language: {
    type: String,
    enum: ['javascript', 'python', 'html', 'css', 'json', 'markdown', 'text'],
    default: 'text',
  },
  isFolder: { type: Boolean, default: false },
  parentPath: { type: String, default: '/' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Version history: a full snapshot of all files at a point in time
const versionSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  message: { type: String, default: 'Saved version' },
  files: [fileSchema],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters'],
  },
  description: { type: String, default: '', maxlength: [500] },
  type: {
    type: String,
    enum: ['javascript', 'python', 'website'],
    required: [true, 'Project type is required'],
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  files: [fileSchema],
  chatHistory: [chatMessageSchema],
  lastOpenedFile: { type: String, default: null },

  // Version history (max 50 kept)
  versions: [versionSchema],

  // Sharing
  isPublic: { type: Boolean, default: false },
  shareToken: { type: String, default: null },
}, {
  timestamps: true,
});

projectSchema.index({ owner: 1, type: 1 });
projectSchema.index({ owner: 1, updatedAt: -1 });
projectSchema.index({ shareToken: 1 }, { sparse: true });

const Project = mongoose.model('Project', projectSchema);
export default Project;
