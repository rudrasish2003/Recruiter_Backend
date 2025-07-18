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

  // Extract JD from file if not provided directly
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
      console.error(" JD parsing error:", err.message);
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
              content: `You are a professional and friendly AI recruiter conducting a screening call for a job opening.

Use the following job description to ask relevant and personalized screening questions:

${jobDescription}

Follow these instructions carefully:

- Ask **one clear and concise question at a time**. Do not combine multiple questions.
- **Wait patiently** for the candidate to respond fully before speaking again. Do not interrupt or talk over them.
- React **naturally and politely** to each answer, just as a human recruiter would.
- Maintain a **warm, conversational tone**—never robotic or scripted.
- Ask **only job-relevant** questions based on the description provided.
- If the candidate goes off-topic or silent, gently guide them back with empathy.
- **Do not repeat** questions that have already been answered.
- When you have gathered enough information, politely thank them and end the call.

You are here to make the candidate feel comfortable while collecting the information needed to assess their fit for the role.`
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
    console.error("Call failed:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || "Call initiation failed"
    });
  }
});



const transcriptLog = [];
const loggedMessages = new Set();

// 🎯 Store transcript from webhook
app.post("/webhook/transcript", (req, res) => {
  const payload = req.body;

  // Handle transcript type messages
  if (payload?.type === "transcript" && payload.transcript && payload.speaker) {
    const key = `${payload.speaker}:${payload.transcript}`;
    if (!loggedMessages.has(key) && ["user", "bot"].includes(payload.speaker)) {
      const line = `[${payload.speaker.toUpperCase()}]: ${payload.transcript}`;
      console.log(line);
      transcriptLog.push(line);
      loggedMessages.add(key);
    }
  }

  // Handle final summary messages
  else if (payload?.summary && payload?.messages) {
    payload.messages.forEach(msg => {
      const key = `${msg.role}:${msg.message}`;
      if (
        ["user", "bot"].includes(msg.role) &&
        !loggedMessages.has(key) &&
        !msg.message.includes("You are a professional and friendly AI recruiter")
      ) {
        const line = `[${msg.role.toUpperCase()}]: ${msg.message}`;
        console.log(line);
        transcriptLog.push(line);
        loggedMessages.add(key);
      }
    });
  }

  // Handle conversation update events
  else if (payload?.message?.type === "conversation-update") {
    payload.message.messages?.forEach(m => {
      const key = `${m.role}:${m.message}`;
      if (
        ["user", "bot"].includes(m.role) &&
        !loggedMessages.has(key) &&
        !m.message.includes("You are a professional and friendly AI recruiter")
      ) {
        const line = `[${m.role.toUpperCase()}]: ${m.message}`;
        console.log(line);
        transcriptLog.push(line);
        loggedMessages.add(key);
      }
    });
  }

  res.sendStatus(200);
});

// ✅ Frontend POST triggers transcript fetch
app.get("/transcript", (req, res) => {
  res.json({ transcript: transcriptLog });
});



app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});