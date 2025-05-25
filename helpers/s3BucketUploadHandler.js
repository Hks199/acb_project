const { 
    S3Client, 
    PutObjectCommand, 
    GetObjectCommand, 
    DeleteObjectCommand 
  } = require("@aws-sdk/client-s3");
  
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
  require("dotenv").config();
  
  const S3_BUCKET = process.env.S3_BUCKET;
  const AWS_REGION = process.env.AWS_REGION;
  const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
  const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
  
  // Initialize S3 Client
  const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET_KEY,
    },
  });
  
  // Generate Signed URL for Secure File Access
  const getObjectUrl = async (key, expiryTime = 3600) =>{
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
  
    return await getSignedUrl(s3Client, command, { expiresIn: expiryTime });
  }
  
  // Upload File Handler (Public Upload)
  const s3UploadHandler = async (file,folderName) => {
    try {
      const FOLDER_PREFIX = `${folderName}/`;
      const uniqueKey = FOLDER_PREFIX + Date.now() + "_" + file.name;
  
      const params = {
        Bucket: S3_BUCKET,
        Key: uniqueKey,
        Body: file.data,
        ContentType: file.mimetype, // Set correct content type
        // ACL: "public-read"  // Make the file publicly accessible
      };
  
      // Upload file to S3
      const command = new PutObjectCommand(params);
      await s3Client.send(command);
  
      // Generate Public URL
      const publicUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${uniqueKey}`;
  
      return { fileKey: uniqueKey, publicUrl };
  
    } catch (err) {
      console.error("S3 Upload Error:", err);
      throw new Error(err.message || "Failed to upload file");
    }
  };
  
  // Delete File from S3
  const s3DeleteHandler = async (fileKey) => {
    try {
      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileKey,
      });
  
      await s3Client.send(command);
      return { success: true, message: "File deleted successfully" };
  
    } catch (err) {
      console.error("S3 Delete Error:", err);
      throw new Error(err.message || "Failed to delete file");
    }
  };

  const s3ReplaceHandler = async (file, fileKey) => {
    try {
      if (!fileKey) {
        throw new Error("Missing file key for replacement");
      }
  
      const params = {
        Bucket: S3_BUCKET,
        Key: fileKey, // Same key to overwrite existing file
        Body: file.data,
        ContentType: file.mimetype,
        // ACL: "public-read", // Adjust as needed
      };
  
      // Upload the new file (this will replace the old one)
      const command = new PutObjectCommand(params);
      await s3Client.send(command);
  
      // Generate updated public URL
      const publicUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${fileKey}`;
  
      return { fileKey, publicUrl, message: "File replaced successfully" };
  
    } catch (err) {
      console.error("S3 Replace Error:", err);
      throw new Error(err.message || "Failed to replace file");
    }
  };
  
  
  module.exports = { 
    getObjectUrl,
    s3UploadHandler,
    s3DeleteHandler,
    s3ReplaceHandler
  };
  