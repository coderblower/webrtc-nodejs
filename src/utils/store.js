// In-memory store. For a multi-instance production environment, use Redis.
const meetings = new Map();

module.exports = {
  meetings
};
