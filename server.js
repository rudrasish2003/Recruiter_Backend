const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

const allowedVoiceIds = [
  "Elliot", "Kylie", "Rohan", "Lily", "Savannah",
  "Hana", "Neha", "Cole", "Harry", "Paige", "Spencer"
];

app.post("/api/call", upload.single("jobFile"), async (req, res) => {
  const { candidateName, phoneNumber, voiceId } = req.body;
  const jobFile = req.file;
  let jobDescription = req.body.jobDescription;

  if (!candidateName || !phoneNumber || (!jobDescription && !jobFile)) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: candidateName, phoneNumber, and either jobDescription or jobFile"
    });
  }

  if (!process.env.VAPI_API_KEY || !process.env.VAPI_PHONE_NUMBER_ID || !process.env.SERVER_URL) {
    return res.status(500).json({
      success: false,
      error: "Missing environment variables. Ensure VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, SERVER_URL are set."
    });
  }

  // Extract JD if jobDescription not provided directly
  if (!jobDescription && jobFile) {
    try {
      const filePath = path.resolve(jobFile.path);
      if (jobFile.mimetype === "application/pdf") {
        const dataBuffer = fs.readFileSync(filePath);
        const parsed = await pdfParse(dataBuffer);
        jobDescription = parsed.text;
      } else if (jobFile.mimetype === "text/plain") {
        jobDescription = fs.readFileSync(filePath, "utf-8");
      } else {
        return res.status(400).json({
          success: false,
          error: "Unsupported file type. Only .txt and .pdf are allowed."
        });
      }
      fs.unlinkSync(filePath); // Clean up
    } catch (err) {
      console.error("❌ JD parsing error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Failed to parse job description from file."
      });
    }
  }

  const selectedVoiceId = allowedVoiceIds.includes(voiceId) ? voiceId : "Rohan";

  try {
    // Create assistant
    const assistantRes = await axios.post(
      "https://api.vapi.ai/assistant",
      {
        name: "AI Recruiter Assistant",
        firstMessage: `Hi ${candidateName}, I'm calling on behalf of the HR team to discuss your application.`,
        firstMessageMode: "assistant-speaks-first",
        voice: {
          provider: "vapi",
          voiceId: selectedVoiceId
        },
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [
            {
              role: "assistant",
              content: `You are a professional AI recruiter. Use this job description to ask relevant screening questions:\n\n${jobDescription}\n\nPolitely collect responses from the candidate and evaluate if they are a good fit.`
            }
          ]
        },
        transcriber: {
          provider: "deepgram",
          language: "en"
        },
        server: {
          url: `${process.env.SERVER_URL}/webhook/transcript`
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_API_KEY}`
        }
      }
    );

    const assistantId = assistantRes.data.id;

    // Start call
    const callRes = await axios.post(
      "https://api.vapi.ai/call",
      {
        customer: {
          number: phoneNumber,
          name: candidateName
        },
        assistantId,
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_API_KEY}`
        }
      }
    );

    res.status(200).json({
      success: true,
      assistantId,
      callId: callRes.data.id
    });
  } catch (err) {
    console.error("❌ Call failed:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || "Call initiation failed"
    });
  }
});

// Webhook to receive and log live transcriptions
app.post("/webhook/transcript", (req, res) => {
  const { transcript, speaker, type, callId } = req.body;

  if (type === "transcript" && transcript) {
    console.log(`🗣️ [${speaker}] (${callId}): ${transcript}`);
  } else {
    console.log("📡 Unstructured Transcript Event:", JSON.stringify(req.body, null, 2));
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
