const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Vapi } = require("vapi-node");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const vapi = new Vapi(process.env.VAPI_API_KEY || "sk_live_example");

// Store connected WebSocket clients
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");
  clients.add(ws);

  ws.on("close", () => {
    console.log("❌ WebSocket client disconnected");
    clients.delete(ws);
  });
});

// ========== ROUTES ==========

// Webhook to receive events from Vapi
app.post("/webhook", async (req, res) => {
  const payload = req.body;
  console.log("📩 Webhook received:", JSON.stringify(payload, null, 2));

  if (payload.type === "call_stopped") {
    console.log("📞 Call ended:", payload.callId);
  }

  res.sendStatus(200);
});

// Webhook to receive transcript data from Vapi
app.post("/webhook/transcript", async (req, res) => {
  const payload = req.body;

  if (payload?.type === "transcript" && payload.transcript && payload.speaker) {
    const message = JSON.stringify({
      speaker: payload.speaker === "bot" ? "AI" : "Candidate",
      text: payload.transcript,
      callId: payload.callId,
      timestamp: new Date().toISOString(),
    });

    // Broadcast to all connected WebSocket clients
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`[${payload.speaker}] (${payload.callId}): ${payload.transcript}`);
  }

  res.sendStatus(200);
});

// API to trigger a voice call
app.post("/api/call", async (req, res) => {
  const { candidateName, phoneNumber, jobDescription, voiceId } = req.body;

  if (!candidateName || !phoneNumber || !jobDescription || !voiceId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const call = await vapi.calls.create({
      assistant: {
        name: "Recruiter AI",
        voice: voiceId,
        firstMessage: {
          type: "text",
          content: `Hello ${candidateName}, I'm calling regarding the position: ${jobDescription}. Let's start with a few questions.`,
        },
        model: "gpt-4o",
        prompt: `
You are a smart and friendly recruiter for a top-tier tech company.
You're calling a candidate named ${candidateName} about the role: ${jobDescription}.

Ask relevant questions about the candidate’s background, experience, and skills.
Let them finish speaking before continuing. Do not interrupt. Keep it natural.
Summarize their responses as needed, and if they sound like a good fit, thank them and end the call warmly.
`,
      },
      phoneNumber: phoneNumber,
      webhook: {
        url: "https://recruiter-backend-pg5a.onrender.com/webhook",
      },
      transcriptWebhook: {
        url: "https://recruiter-backend-pg5a.onrender.com/webhook/transcript",
      },
    });

    console.log("📞 Call started:", call.id);
    res.json({ success: true, callId: call.id });
  } catch (err) {
    console.error("❌ Error starting call:", err.message);
    res.status(500).json({ error: "Call failed to initiate" });
  }
});

// ========== SERVER START ==========
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
