const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const { bucket, admin } = require("../config/firebase");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const db = admin.firestore(); // Initialize Firestore instance

/**
 * 📌 UPLOAD FILE
 * Uploads a file to Firebase Storage and saves metadata in Firestore.
 */
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { originalname, buffer } = req.file;
      const { accessType } = req.body;
      const fileName = `${Date.now()}_${originalname}`;
      const file = bucket.file(fileName);

      console.log(`📂 Uploading file: ${fileName}`);

      // ✅ Save file to Firebase Storage
      await file.save(buffer, {
        metadata: {
          contentType: req.file.mimetype,
          metadata: { accessType: accessType || "private" },
        },
      });

      const fileURL = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${fileName}`;
      console.log("✅ File uploaded successfully. URL:", fileURL);

      // ✅ Save metadata to Firestore
      const fileDoc = await db.collection("files").add({
        fileName,
        fileURL,
        uploadedBy: req.user.email,
        accessType: accessType || "private",
        uploadedAt: new Date().toISOString(),
      });

      return res
        .status(201)
        .json({ message: "File uploaded", fileURL, fileId: fileDoc.id });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error uploading file", error: error.message });
    }
  }
);

/**
 * 📌 GET FILES
 * List all public and user-owned private files
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const snapshot = await db.collection("files").get();

    if (snapshot.empty) {
      return res.status(200).json({ message: "No files found", files: [] });
    }

    const files = snapshot.docs
      .map((doc) => {
        const fileData = doc.data();
        if (
          fileData.accessType === "public" ||
          fileData.uploadedBy === userEmail
        ) {
          return {
            fileID: doc.id,
            fileName: fileData.fileName,
            downloadLink: fileData.fileURL,
          };
        }
      })
      .filter(Boolean);

    return res.status(200).json({ files });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching files", error: error.message });
  }
});

/**
 * 📌 DOWNLOAD FILE
 * Downloads the file and saves it on the app main folder
 */
router.get("/download/:fileId", authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log("🔍 Fetching file for download:", fileId);

    // Retrieve file metadata from Firestore
    const fileDoc = await db.collection("files").doc(fileId).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ message: "File not found" });
    }

    const fileData = fileDoc.data();
    console.log("✅ File data retrieved:", fileData);

    // Check if the user is allowed to download the file
    if (
      fileData.accessType !== "public" &&
      fileData.uploadedBy !== req.user.email
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get the file from Firebase Storage
    const file = bucket.file(fileData.fileName);
    console.log("📂 Fetching file from storage:", fileData.fileName);

    // Set correct headers
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileData.fileName}"`
    );
    res.setHeader(
      "Content-Type",
      fileData.contentType || "application/octet-stream"
    );

    // Create a read stream and pipe to response
    file
      .createReadStream()
      .on("error", (err) => {
        console.error(" Error downloading file:", err);
        res
          .status(500)
          .json({ message: "Error downloading file", error: err.message });
      })
      .pipe(res);
  } catch (error) {
    console.error(" Error downloading file:", error);
    res
      .status(500)
      .json({ message: "Error downloading file", error: error.message });
  }
});

/**
 * 📌 DELETE FILE
 * Deletes a file from Firebase Storage and Firestore.
 */
router.delete("/:fileId", authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userEmail = req.user.email;

    const fileDoc = await db.collection("files").doc(fileId).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ message: "File not found" });
    }

    const fileData = fileDoc.data();
    if (fileData.uploadedBy !== userEmail) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this file" });
    }

    // ✅ Delete from Firebase Storage & Firestore
    await bucket.file(fileData.fileName).delete();
    await db.collection("files").doc(fileId).delete();

    return res.json({ message: "File deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting file", error: error.message });
  }
});

/**
 * 📌 UPDATE FILE ACCESS
 * Allows a file owner to change the access type (public/private).
 */
router.patch("/:fileId/access", authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { accessType } = req.body;
    const userEmail = req.user.email;

    if (!["public", "private"].includes(accessType)) {
      return res.status(400).json({
        message: "Invalid access type. Must be 'public' or 'private'.",
      });
    }

    const fileRef = db.collection("files").doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ message: "File not found." });
    }

    const fileData = fileDoc.data();
    if (fileData.uploadedBy !== userEmail) {
      return res
        .status(403)
        .json({ message: "You do not have permission to modify this file." });
    }

    await fileRef.update({ accessType });
    return res
      .status(200)
      .json({ message: "File access type updated successfully." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
});

module.exports = router;
