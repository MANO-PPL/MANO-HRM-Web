import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import { getFileUrl } from '../../services/s3/s3Service.js';
import fs from 'fs';
import {
  getOpenings,
  createOpening,
  updateOpening,
  deleteOpening,
  toggleOpeningStatus,
  getPublicOpening,
  getPipelineStages,
  savePipelineStages,
  getTemplates,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
  getCandidatesForJob,
  applyForJob,
  updateCandidateStage,
  deleteCandidate,
  generateAIJobDescription,
  addCandidateNote,
  deleteCandidateNote
} from '../../controllers/recruitmentController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const upload = multer(); // For handling memory uploads of PDF resumes

// --- PUBLIC ENDPOINTS (No Auth Required) ---
router.get('/public-opening/:slug', getPublicOpening);
router.post('/candidates/:jobId/apply', upload.single('resume'), applyForJob);
router.get('/resumes/:filename', async (req, res) => {
  try {
    const { url } = await getFileUrl({ key: req.params.filename, directory: 'recruitment/resumes' });
    res.redirect(url);
  } catch (err) {
    const filePath = path.join(__dirname, '../../../uploads/resumes', req.params.filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Resume not found.' });
    }
  }
});

router.get('/openings-attachments/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { attendanceDB } = await import('../../config/database.js');
    const opening = await attendanceDB('recruitment_openings')
      .where('attachment_url', 'like', `%/${filename}`)
      .first();

    if (!opening) {
      return res.status(404).json({ error: 'Attachment not found.' });
    }

    const { url } = await getFileUrl({ key: filename, directory: `recruitment/openings/${opening.org_id}` });
    res.redirect(url);
  } catch (err) {
    console.error('Failed to get signed URL for opening attachment:', err);
    res.status(404).json({ error: 'Attachment not found.' });
  }
});

// --- PROTECTED ENDPOINTS (Requires Auth) ---
router.use(authenticateJWT, requireActiveOrg);

// Job postings
router.get('/openings', getOpenings);
router.post('/openings', upload.single('attachment'), createOpening);
router.put('/openings/:id', upload.single('attachment'), updateOpening);
router.delete('/openings/:id', deleteOpening);
router.put('/openings/:id/status', toggleOpeningStatus);
router.post('/generate-jd', generateAIJobDescription);

// Pipeline Customization
router.get('/pipeline-stages', getPipelineStages);
router.post('/pipeline-stages', savePipelineStages);

// Custom saved templates
router.get('/templates', getTemplates);
router.post('/templates', saveTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

// Candidate applications & pipeline
router.get('/candidates', getCandidatesForJob);
router.put('/candidates/:id/stage', updateCandidateStage);
router.delete('/candidates/:id', deleteCandidate);
router.post('/candidates/:id/notes', addCandidateNote);
router.delete('/candidates/:id/notes/:noteId', deleteCandidateNote);

export default router;
