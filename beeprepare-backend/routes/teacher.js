const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireActivated = require('../middleware/requireActivated');
const requireRole = require('../middleware/requireRole');
const { upload, ...teacherHandlers } = require('../controllers/teacherController');

const guard = [requireAuth, requireActivated, requireRole('teacher')];

router.get('/dashboard',                   ...guard, teacherHandlers.getDashboard);
router.get('/profile',                     ...guard, teacherHandlers.getProfile);
router.put('/profile',                     ...guard, teacherHandlers.updateProfile);
router.post('/subjects',                   ...guard, teacherHandlers.addSubject);
router.delete('/subjects/:bankId',         ...guard, teacherHandlers.deleteSubject);
router.get('/chapters/:bankId',            ...guard, teacherHandlers.getChapters);
router.post('/chapters/:bankId',           ...guard, teacherHandlers.addChapter);
router.delete('/chapters/:bankId/:chapterId', ...guard, teacherHandlers.deleteChapter);
router.get('/questions',                   ...guard, teacherHandlers.getQuestions);
router.post('/questions',                  ...guard, teacherHandlers.addQuestion);
router.delete('/questions/:id',            ...guard, teacherHandlers.deleteQuestion);
router.post('/generate-paper',             ...guard, teacherHandlers.generatePaper);
router.get('/notes/:bankId',               ...guard, teacherHandlers.getNotes);
router.post('/notes/upload',               ...guard, upload.single('file'), teacherHandlers.uploadNote);
router.get('/notes/:id/download',          ...guard, teacherHandlers.downloadNote);
router.delete('/notes/:id',               ...guard, teacherHandlers.deleteNote);
router.get('/requests',                    ...guard, teacherHandlers.getRequests);
router.post('/requests/approve-all',       ...guard, teacherHandlers.approveAllRequests);
router.post('/requests/:id/approve',       ...guard, teacherHandlers.approveRequest);
router.post('/requests/:id/reject',        ...guard, teacherHandlers.rejectRequest);
router.get('/doubts',                      ...guard, teacherHandlers.getDoubts);
router.post('/doubts/:id/reply',           ...guard, teacherHandlers.replyToDoubt);
router.get('/activity',                    ...guard, teacherHandlers.getActivity);

module.exports = router;
