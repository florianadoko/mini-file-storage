const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { admin, db } = require("../config/firebase");
const dotenv = require("dotenv");

dotenv.config();
const router = express.Router();
const usersCollection = db.collection("users");

/**
 * 📌 REGISTER USER
 * This endpoint allows a new user to register by providing an email and password.
 * Passwords are hashed before being stored in Firestore.
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Check if user already exists in Firestore
    const userDoc = await usersCollection.where("email", "==", email).get();
    if (!userDoc.empty) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 🔒 Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Save new user in Firestore
    const newUserRef = await usersCollection.add({
      email,
      password: hashedPassword,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res
      .status(201)
      .json({ message: "User registered successfully", id: newUserRef.id });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error registering user", error: error.message });
  }
});

/**
 * 📌 LOGIN USER
 * Authenticates users and generates a JWT token for session management.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // ✅ Retrieve user from Firestore
    const userQuery = await db
      .collection("users")
      .where("email", "==", email.trim())
      .get();

    if (userQuery.empty) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Extract user data
    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // 🔒 Compare provided password with stored hashed password
    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Generate a JWT token for authentication
    const token = jwt.sign({ email: userData.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error logging in", error: error.message });
  }
});

module.exports = router;
