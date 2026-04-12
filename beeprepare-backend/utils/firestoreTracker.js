const logger = require('./logger');

const READ_LIMIT = 10;
const WRITE_LIMIT = 5;

class FirestoreTracker {
  constructor(requestId = 'system') {
    this.requestId = requestId;
    this.reads = 0;
    this.writes = 0;
  }

  trackRead(collection, docId = '') {
    this.reads++;
    console.log(`[FIRESTORE READ] #${this.reads} | ${collection}/${docId} | Req: ${this.requestId}`);
    if (this.reads > READ_LIMIT) {
      logger.warn(`CRITICAL: Request ${this.requestId} exceeded Firestore READ limit! (${this.reads} reads)`, { requestId: this.requestId });
    }
  }

  trackWrite(collection, docId = '', action = 'set') {
    this.writes++;
    console.log(`[FIRESTORE WRITE] #${this.writes} | ${action.toUpperCase()} ${collection}/${docId} | Req: ${this.requestId}`);
    if (this.writes > WRITE_LIMIT) {
      logger.warn(`CRITICAL: Request ${this.requestId} exceeded Firestore WRITE limit! (${this.writes} writes)`, { requestId: this.requestId });
    }
  }
}

module.exports = FirestoreTracker;
