/** @type {Map<string, { callerId: string, calleeId: string, status: "ringing" | "active" }>} */
const activeCalls = new Map();

/** @type {Map<string, string>} userId -> callId */
const userActiveCall = new Map();

export function getCall(callId) {
  return activeCalls.get(String(callId)) ?? null;
}

export function isUserInCall(userId) {
  return userActiveCall.has(String(userId));
}

export function createCall(callId, callerId, calleeId) {
  const id = String(callId);
  const call = {
    callerId: String(callerId),
    calleeId: String(calleeId),
    status: "ringing",
  };
  activeCalls.set(id, call);
  userActiveCall.set(call.callerId, id);
  userActiveCall.set(call.calleeId, id);
  return call;
}

export function markCallActive(callId) {
  const call = activeCalls.get(String(callId));
  if (!call) return null;
  call.status = "active";
  return call;
}

export function isCallParticipant(call, userId) {
  const uid = String(userId);
  return call.callerId === uid || call.calleeId === uid;
}

export function getCallPeer(call, userId) {
  const uid = String(userId);
  return call.callerId === uid ? call.calleeId : call.callerId;
}

export function endCall(callId) {
  const id = String(callId);
  const call = activeCalls.get(id);
  if (!call) return null;

  activeCalls.delete(id);
  userActiveCall.delete(call.callerId);
  userActiveCall.delete(call.calleeId);
  return call;
}

export function endCallForUser(userId) {
  const callId = userActiveCall.get(String(userId));
  if (!callId) return null;
  const call = endCall(callId);
  return call ? { callId, call } : null;
}
