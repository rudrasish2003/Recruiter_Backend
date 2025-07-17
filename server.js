const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const path = require("path");
const { WebSocketServer } = require("ws");
const http = require("http");

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const connectedClients = new Set();

wss.on("connection", (ws) => {
  console.log("🟢 Frontend connected via WebSocket");
  connectedClients.add(ws);

  ws.on("close", () => {
    console.log("🔴 Frontend disconnected");
    connectedClients.delete(ws);
  });
});

// Multer for file uploads
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
      error: "Missing required environment variables."
    });
  }

  // Parse JD from uploaded file
  if (!jobDescription && jobFile) {
    try {
      const filePath = path.resolve(jobFile.path);
      const mime = jobFile.mimetype;

      if (mime === "application/pdf") {
        const buffer = fs.readFileSync(filePath);
        const parsed = await pdfParse(buffer);
        jobDescription = parsed.text;
      } else if (mime === "text/plain") {
        jobDescription = fs.readFileSync(filePath, "utf-8");
      } else {
        return res.status(400).json({
          success: false,
          error: "Unsupported file type. Only .txt or .pdf allowed."
        });
      }

      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Error parsing JD:", err.message);
      return res.status(500).json({
        success: false,
        error: "Failed to extract job description."
      });
    }
  }

  const selectedVoiceId = allowedVoiceIds.includes(voiceId) ? voiceId : "Rohan";

  try {
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

- Ask one clear and concise question at a time.
- Wait patiently for the candidate to respond fully before speaking again.
- React naturally and politely to each answer.
- Maintain a warm, conversational tone—never robotic or scripted.
- Ask only job-relevant questions based on the description provided.
- If the candidate goes off-topic or silent, gently guide them back.
- Do not repeat questions already answered.
- When you’ve gathered enough information, thank them and end the call.`
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
    console.error("Call Error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || "Failed to initiate call"
    });
  }
});

// Transcript Webhook
app.post("/webhook/transcript", (req, res) => {
  const payload = req.body;

  if (payload?.type === "transcript" && payload.transcript && payload.speaker) {
    const message = {
      id: Date.now().toString(),
      speaker: payload.speaker === "bot" ? "AI" : "Candidate",
      text: payload.transcript,
      timestamp: new Date().toISOString()
    };

    console.log(`[${message.speaker}] ${message.text}`);

    connectedClients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    });
  }

  res.sendStatus(200);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});
