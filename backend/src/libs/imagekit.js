import ImageKit, { toFile } from "@imagekit/nodejs";

const imageKitPrivateKey = process.env.IMAGE_KIT || process.env.IMAGEKIT_PRIVATE_KEY;
const imagekit = imageKitPrivateKey ? new ImageKit({ privateKey: imageKitPrivateKey }) : null;

function hasImageKitConfig() {
  return Boolean(imageKitPrivateKey && imagekit);
}

// originalName= "My Photo (1).png"
// result: "chat-1749300000000-My_Photo__1_.png"
// this helper makes a safe, unique filename for uploaded files.
function createFileName(originalName = "upload") {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `chat-${Date.now()}-${safeName}`;
}

/**
 * Upload image or video to ImageKit
 * @see https://imagekit.io/docs/api-reference/upload-file/upload-file
 */
async function uploadChatMedia(file) {
  if (!hasImageKitConfig()) {
    throw new Error("ImageKit is not configured");
  }

  const fileName = createFileName(file.originalname);

  const result = await imagekit.files.upload({
    file: await toFile(file.buffer, fileName, { type: file.mimetype }),
    fileName,
    folder: "/chat",
  });

  return result.url;
}

export { uploadChatMedia, hasImageKitConfig };