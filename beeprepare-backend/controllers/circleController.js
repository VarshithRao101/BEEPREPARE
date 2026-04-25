const StudyCircle = require('../models/StudyCircle');
const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');

// Generate unique circle code
const generateCircleCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'CIR-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(
      Math.random() * chars.length)];
  }
  return code;
};

// POST /api/circles/create
// Students AND teachers can create
const createCircle = async (req, res) => {
  try {
    const { name, subject } = req.body;
    const userId = req.user.googleUid;
    const user = req.user;

    if (!name || name.trim().length < 3) {
      return error(res,
        'Circle name must be at least 3 characters',
        'INVALID_NAME', 400);
    }

    // Max 3 circles per user
    const existing = await StudyCircle.countDocuments({
      'members.userId': userId,
      isActive: true
    });

    if (existing >= 3) {
      return error(res,
        'Maximum 3 circles per account',
        'CIRCLE_LIMIT', 400);
    }

    let circleCode;
    let attempts = 0;
    do {
      circleCode = generateCircleCode();
      attempts++;
    } while (
      await StudyCircle.findOne({ circleCode }) && attempts < 10
    );

    const circle = await StudyCircle.create({
      name: name.trim(),
      subject: subject || '',
      circleCode,
      createdBy: userId,
      members: [{
        userId,
        displayName: user.displayName,
        role: user.role,
        joinedAt: new Date()
      }]
    });

    return success(res,
      'Study circle created', {
      circleId: circle._id,
      circleCode: circle.circleCode,
      name: circle.name
    });
  } catch (err) {
    console.error('createCircle error:', err);
    return error(res,
      'Failed to create circle',
      'SERVER_ERROR', 500);
  }
};

// POST /api/circles/join
// Now sends REQUEST instead of direct join
const requestToJoin = async (req, res) => {
  try {
    const { circleCode } = req.body;
    const userId = req.user.googleUid;
    const user = req.user;

    const circle = await StudyCircle
      .findOne({
        circleCode: circleCode?.trim()
          .toUpperCase(),
        isActive: true
      });

    if (!circle) {
      return error(res,
        'Circle not found. Check code.',
        'NOT_FOUND', 404);
    }

    // Already a member?
    const isMember = circle.members
      .some(m => m.userId === userId);
    if (isMember) {
      return error(res,
        'Already a member',
        'ALREADY_MEMBER', 409);
    }

    // Already requested?
    const alreadyRequested = circle
      .joinRequests?.some(r =>
        r.userId === userId &&
        r.status === 'pending'
      );
    if (alreadyRequested) {
      return error(res,
        'Join request already pending',
        'ALREADY_REQUESTED', 409);
    }

    // Add join request
    if (!circle.joinRequests) {
      circle.joinRequests = [];
    }
    circle.joinRequests.push({
      userId,
      displayName: user.displayName,
      role: user.role,
      beeId: user.beeId || '',
      status: 'pending',
      requestedAt: new Date()
    });

    circle.pendingCount =
      circle.joinRequests.filter(
        r => r.status === 'pending'
      ).length;

    await circle.save();

    return success(res,
      'Join request sent! Waiting for approval.',
      { circleCode: circle.circleCode }
    );
  } catch (err) {
    return error(res,
      'Failed to send join request',
      'SERVER_ERROR', 500);
  }
};

// POST /api/circles/:circleId/approve/:userId
// Only creator can approve
const approveJoinRequest =
  async (req, res) => {
  try {
    const { circleId, userId } = req.params;
    const adminId = req.user.googleUid;

    const circle = await StudyCircle
      .findById(circleId);

    if (!circle) {
      return error(res,
        'Circle not found', 'NOT_FOUND', 404);
    }

    if (circle.createdBy !== adminId) {
      return error(res,
        'Only circle creator can approve',
        'FORBIDDEN', 403);
    }

    // Find the request
    const reqIdx = circle.joinRequests
      .findIndex(r =>
        r.userId === userId &&
        r.status === 'pending'
      );

    if (reqIdx === -1) {
      return error(res,
        'Request not found',
        'NOT_FOUND', 404);
    }

    const joinReq =
      circle.joinRequests[reqIdx];

    // Check max members
    if (circle.members.length >=
        circle.maxMembers) {
      return error(res,
        'Circle is full',
        'CIRCLE_FULL', 400);
    }

    // Approve: move to members
    circle.joinRequests[reqIdx].status =
      'approved';
    circle.members.push({
      userId: joinReq.userId,
      displayName: joinReq.displayName,
      role: joinReq.role,
      joinedAt: new Date()
    });

    circle.pendingCount =
      circle.joinRequests.filter(
        r => r.status === 'pending'
      ).length;

    await circle.save();

    return success(res,
      'Member approved!',
      { memberCount: circle.members.length }
    );
  } catch (err) {
    return error(res,
      'Failed to approve',
      'SERVER_ERROR', 500);
  }
};

// POST /api/circles/:circleId/reject/:userId
const rejectJoinRequest =
  async (req, res) => {
  try {
    const { circleId, userId } = req.params;
    const adminId = req.user.googleUid;

    const circle = await StudyCircle
      .findById(circleId);

    if (!circle ||
        circle.createdBy !== adminId) {
      return error(res,
        'Forbidden', 'FORBIDDEN', 403);
    }

    const reqIdx = circle.joinRequests
      .findIndex(r =>
        r.userId === userId &&
        r.status === 'pending'
      );

    if (reqIdx !== -1) {
      circle.joinRequests[reqIdx].status =
        'rejected';
      circle.pendingCount =
        circle.joinRequests.filter(
          r => r.status === 'pending'
        ).length;
      await circle.save();
    }

    return success(res,
      'Request rejected', null);
  } catch (err) {
    return error(res,
      'Failed to reject',
      'SERVER_ERROR', 500);
  }
};

// GET /api/circles/:circleId/requests
// Get pending join requests
// Only creator sees this
const getJoinRequests =
  async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.user.googleUid;

    const circle = await StudyCircle
      .findById(circleId)
      .select('joinRequests createdBy name');

    if (!circle) {
      return error(res,
        'Not found', 'NOT_FOUND', 404);
    }

    if (circle.createdBy !== userId) {
      return error(res,
        'Forbidden', 'FORBIDDEN', 403);
    }

    const pending = circle.joinRequests
      .filter(r => r.status === 'pending');

    return success(res,
      'Join requests', pending);
  } catch (err) {
    return error(res,
      'Failed', 'SERVER_ERROR', 500);
  }
};

// GET /api/circles/my
// Get all circles I'm part of
const getMyCircles = async (req, res) => {
  try {
    const userId = req.user.googleUid;
    const circles = await StudyCircle.find({
      'members.userId': userId,
      isActive: true
    }).select('name subject circleCode createdBy members pendingCount').lean();

    const processed = circles.map(c => ({
      ...c,
      memberCount: c.members.length,
      isCreator: c.createdBy === userId
    }));

    return success(res, 'My circles fetched', processed);
  } catch (err) {
    return error(res, 'Failed to fetch circles', 'SERVER_ERROR', 500);
  }
};

// GET /api/circles/:circleId/messages
const getMessages = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.user.googleUid;

    const circle = await StudyCircle.findById(circleId).select('messages members');
    if (!circle) return error(res, 'Circle not found', 'NOT_FOUND', 404);

    const isMember = circle.members.some(m => m.userId === userId);
    if (!isMember) return error(res, 'Access denied', 'FORBIDDEN', 403);

    return success(res, 'Messages fetched', circle.messages);
  } catch (err) {
    return error(res, 'Failed to fetch messages', 'SERVER_ERROR', 500);
  }
};

// POST /api/circles/:circleId/messages
const sendMessage = async (req, res) => {
  try {
    const { circleId } = req.params;
    const { content } = req.body;
    const userId = req.user.googleUid;
    const user = req.user;

    if (!content || content.trim().length === 0) {
      return error(res, 'Message content required', 'INVALID_MESSAGE', 400);
    }

    // BEE Shield: Simple content filter for explicit/abusive language
    const explicitWords = [
      'fucking', 'shit', 'bitch', 'asshole', 'pussy', 'dick', 'bastard', 'cunt',
      'nude', 'porn', 'xxx', 'sexting', 'fuck', 'sex', 'idiot', 'stupid'
    ];
    
    const messageLower = content.toLowerCase();
    const isExplicit = explicitWords.some(word => 
      new RegExp(`\\b${word}\\b`, 'i').test(messageLower)
    );

    if (isExplicit) {
      console.warn(`BEE SHIELD: Explicit content blocked from ${user.displayName} (${userId})`);
      return error(res, 
        'CRITICAL VIOLATION: Explicit or abusive content detected. This incident has been logged. Continuous violations will lead to permanent account suspension.',
        'EXPLICIT_CONTENT', 403);
    }

    const circle = await StudyCircle.findById(circleId);
    if (!circle) return error(res, 'Circle not found', 'NOT_FOUND', 404);

    const isMember = circle.members.some(m => m.userId === userId);
    if (!isMember) return error(res, 'Access denied', 'FORBIDDEN', 403);

    circle.messages.push({
      senderId: userId,
      senderName: user.displayName,
      senderRole: user.role,
      content: content.trim()
    });

    // Keep last 100 messages only
    if (circle.messages.length > 100) {
      circle.messages = circle.messages.slice(-100);
    }

    await circle.save();

    return success(res, 'Message sent', circle.messages[circle.messages.length - 1]);
  } catch (err) {
    return error(res, 'Failed to send message', 'SERVER_ERROR', 500);
  }
};

// POST /api/circles/:circleId/kick/:userId
const removeMember = async (req, res) => {
  try {
    const { circleId, userId } = req.params;
    const adminId = req.user.googleUid;

    const circle = await StudyCircle.findById(circleId);
    if (!circle) return error(res, 'Not found', 'NOT_FOUND', 404);

    if (circle.createdBy !== adminId) {
      return error(res, 'Only creator can remove members', 'FORBIDDEN', 403);
    }

    if (userId === adminId) {
      return error(res, 'Cannot remove yourself', 'FORBIDDEN', 400);
    }

    circle.members = circle.members.filter(m => m.userId !== userId);
    await circle.save();

    return success(res, 'Member removed', null);
  } catch (err) {
    return error(res, 'Failed to remove member', 'SERVER_ERROR', 500);
  }
};

// DELETE /api/circles/:circleId/messages/:messageId
const deleteMessage = async (req, res) => {
  try {
    const { circleId, messageId } = req.params;
    const adminId = req.user.googleUid;

    const circle = await StudyCircle.findById(circleId);
    if (!circle) return error(res, 'Not found', 'NOT_FOUND', 404);

    if (circle.createdBy !== adminId) {
      return error(res, 'Only creator can delete messages', 'FORBIDDEN', 403);
    }

    circle.messages = circle.messages.filter(m => m._id.toString() !== messageId);
    await circle.save();

    return success(res, 'Message deleted', null);
  } catch (err) {
    return error(res, 'Failed to delete message', 'SERVER_ERROR', 500);
  }
};

// POST /api/circles/:circleId/rules
const updateRules = async (req, res) => {
  try {
    const { circleId } = req.params;
    const { rules } = req.body;
    const adminId = req.user.googleUid;

    const circle = await StudyCircle.findById(circleId);
    if (!circle) return error(res, 'Not found', 'NOT_FOUND', 404);

    if (circle.createdBy !== adminId) {
      return error(res, 'Only creator can update rules', 'FORBIDDEN', 403);
    }

    circle.rules = rules || '';
    await circle.save();

    return success(res, 'Rules updated', circle.rules);
  } catch (err) {
    return error(res, 'Failed to update rules', 'SERVER_ERROR', 500);
  }
};

// POST /api/circles/:circleId/leave
const leaveCircle = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.user.googleUid;

    const circle = await StudyCircle.findById(circleId);
    if (!circle) return error(res, 'Circle not found', 'NOT_FOUND', 404);

    if (circle.createdBy === userId) {
      return error(res, 'Creator cannot leave. Dissolve the circle instead.', 'FORBIDDEN', 403);
    }

    circle.members = circle.members.filter(m => m.userId !== userId);
    await circle.save();

    return success(res, 'Left circle', null);
  } catch (err) {
    return error(res, 'Failed to leave circle', 'SERVER_ERROR', 500);
  }
};

// DELETE /api/circles/:circleId
const dissolveCircle = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.user.googleUid;

    const circle = await StudyCircle.findById(circleId);
    if (!circle) return error(res, 'Circle not found', 'NOT_FOUND', 404);

    if (circle.createdBy !== userId) {
      return error(res, 'Only creator can dissolve circle', 'FORBIDDEN', 403);
    }

    circle.isActive = false;
    await circle.save();

    return success(res, 'Circle dissolved', null);
  } catch (err) {
    return error(res, 'Failed to dissolve circle', 'SERVER_ERROR', 500);
  }
};

// Updated Export
module.exports = {
  createCircle,
  requestToJoin,
  getMyCircles,
  getMessages,
  sendMessage,
  leaveCircle,
  dissolveCircle,
  approveJoinRequest,
  rejectJoinRequest,
  getJoinRequests,
  removeMember,
  deleteMessage,
  updateRules
};
