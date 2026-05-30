/**
 * GCS upload helper — uploads a Buffer to Google Cloud Storage and returns a
 * signed URL valid for 7 days (or a public URL if the bucket is public).
 *
 * Required env vars:
 *   GCS_SERVICE_ACCOUNT_JSON   – full service-account JSON string (jobseek project)
 *   GCS_BUCKET_NAME            – destination bucket name
 *   GCS_PROJECT_ID             – GCP project id (default: jobseek-459701)
 */

import { Storage } from "@google-cloud/storage";

let _storage: Storage | null = null;

function getStorage(): Storage {
  if (_storage) return _storage;

  const saJson = process.env.GCS_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.GCS_PROJECT_ID ?? "jobseek-459701";

  if (!saJson) {
    throw new Error("GCS_SERVICE_ACCOUNT_JSON is not set");
  }

  _storage = new Storage({
    credentials: JSON.parse(saJson),
    projectId,
  });
  return _storage;
}

/**
 * Upload a buffer to GCS.
 * @returns A signed URL valid for 7 days
 */
export async function uploadToGCS(
  buffer: Buffer,
  fileName: string,
  contentType = "application/pdf"
): Promise<string> {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) throw new Error("GCS_BUCKET_NAME is not set");

  const storage = getStorage();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });

  // Return a signed URL valid for 7 days
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return signedUrl;
}
