export function getIceServers(req, res) {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

  const turnUrl = process.env.TURN_URL;
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl,
      username: process.env.TURN_USERNAME || "",
      credential: process.env.TURN_CREDENTIAL || "",
    });
  }

  res.status(200).json({ iceServers });
}
