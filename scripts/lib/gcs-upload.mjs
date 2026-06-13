/**
 * GCS upload for pipeline scripts (mirrors lib/gcsUpload.ts).
 */

import { Storage } from "@google-cloud/storage";

let _storage = null;

function getStorage() {
  if (_storage) return _storage;

  const saJson = process.env.GCS_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.GCS_PROJECT_ID ?? "jobseek-459701";
  if (!saJson?.trim()) {
    throw new Error("GCS_SERVICE_ACCOUNT_JSON is not set");
  }

  _storage = new Storage({
    credentials: JSON.parse(saJson),
    projectId,
  });
  return _storage;
}

/**
 * @param {Buffer} buffer
 * @param {string} fileName
 * @param {string} contentType
 * @returns {Promise<string>} signed URL (7 days)
 */
export async function uploadToGCS(buffer, fileName, contentType = "application/pdf") {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) throw new Error("GCS_BUCKET_NAME is not set");

  const storage = getStorage();
  const file = storage.bucket(bucketName).file(fileName);

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return signedUrl;
}
