import mongoose from "mongoose";

export async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.warn("MONGO_URI is not set. Database features will be unavailable.");
      return;
    }

    const conn = await mongoose.connect(mongoUri);

    console.log("MongoDB connected", conn.connection.host);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    console.warn("Continuing without database connection. Some features may not work.");
  }
}