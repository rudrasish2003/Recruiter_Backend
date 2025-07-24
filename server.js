const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Allowed voice IDs
const allowedVoiceIds = [
  "Elliot", "Kylie", "Rohan", "Lily", "Savannah",
  "Hana", "Neha", "Cole", "Harry", "Paige", "Spencer"
];

// ✅ Static job description
const jobDescription = `
{"_id":"68778c4c8135976b4d8465b8","vJobId":6,"jobTitle":"Driver","category":"Logistics","categoryId":"1600","questionData":[{"questionId":1752665155560,"question":"Very niceeeeeee","_id":"6877b3038135976b4d846ea3"},{"questionId":1752673184875,"question":"Nicesss","_id":"6877b3038135976b4d846ea4"},{"questionId":1752673554398,"question":"Very good","_id":"6877b3038135976b4d846ea5"},{"questionId":1752675018833,"question":"Excellent","_id":"6877b3038135976b4d846ea6"},{"questionId":1752675068115,"question":"Very nice","_id":"6877b3038135976b4d846ea7"}],"vendor":{"name":{"first":"Anjali","last":"Kumari"},"_id":"6826d6dac5ac488cd6192991","email":"anjali@gmail.com"},"status":"inactive","createdAt":"2025-07-16T11:26:04.407Z","updatedAt":"2025-07-16T14:11:15.716Z","__v":0}
`;

// ✅ Static backend CV
const candidateCV = `Anjali Kumari
Kolkata, India|anjali.kri.singh2107@gmail.com|+91-9693454279
https://linkedin.com/in/anjali-singh-b15492205|https://github.com/anjalisingh2109
Professional Summary
Full-Stack Developer with 1+ years of experience in building scalable, secure web applications. Expert in frontend
(HTML, CSS, Responsive Design, JavaScript, React, Redux) and backend (Java, Spring Boot, RESTful APIs,
Microservices, API Development, Database Management). Skilled in SSO and token-based authentication (JWT,
OAuth), Agile methodologies, and performance optimization. Proficient with ESLint, Prettier, SonarQube, AWS,
TypeScript, and Git.
Skills
•Languages & Web Tech:JavaScript (ES6+), TypeScript, HTML5, CSS, Responsive Design
•Frontend:React.js, Redux, Context API, Next.JS, Responsive Design, SSR
•Backend:Java, Spring Boot, RESTful APIs, OAuth, JWT, Microservices, API Development, Database
Management, Agile
•Databases & Cloud:PostgreSQL, MySQL, AWS
•Tools:Git, Docker, ESLint, Prettier
Work Experience
Kolkata, India
Jun 2024 – Present
Associate Software Engineer / Frontend Developer, Indus Net Technologies
•
Enhanced user authentication by integrating SSO with token-based methods (JWT, OAuth), ensuring a robust,
secure login process.
•
Implemented server-side rendering (SSR) where applicable to enhance initial load performance and SEO.
•
Built and optimized backend services using Java, Spring Boot, and PostgreSQL in a high-performance project;
improved API and query efficiency by 35% by identifying bottlenecks and refactoring code and SQL logic.
•
Enforced code quality using ESLint, Prettier, and modular practices, improving code consistency and
maintainability..
Projects
Lucas (Lucas Indian Service Limited)Frontend Developer
Tech Stack:Next.JS, GraphQL, Redux
•
Built a role-based e-commerce platform for a locomotive company using Next.JS, GraphQL, and Redux, enabling
dynamic access control.
•
Implemented user features including profile management, order history tracking, return handling, and a secure
payment gateway.
•
Utilized GraphQL to streamline API development, enabling efficient data querying and reducing manual
backend tasks by 40% through scalable and modular architecture.
Sovi (Sovi Health Solutions)Frontend Developer
vspace0.10 cm
Tech Stack:React,Redux,React Query, Bootstrap, ApexCharts
•
Developed a role-based admin panel for managing client data and access control, featuring comprehensive
medical history and health recommendations for users.
•
Built dashboards using ApexCharts to visualize monthly user enrollments and active user trends for actionable
insights.
Education
Heritage Institute of Technology, Kolkata
Dec 2020 – May 2024
Bachelor of Technology in Computer Science and Engineering`

// ✅ Static client info
const clientInfo = `
{"_id":"6878f13360f030f96227bb74","jobCategory":"FedEx P&D Full Service 17-07-2025 5pm","jobType":[{"vJobId":6,"vJobName":"Non CDL/L20","vJobDescription":"html data","_id":"6878f13360f030f96227bb75"}],"company":"Bossert Logistics Inc.","vendor":{"name":{"first":"Anjali","last":"Kumari"},"_id":"6826d6dac5ac488cd6192991","email":"anjali@gmail.com"},"clientName":"Bossert Logistics Inc.","name":"Bossert Logistics Inc.","vClientId":"203","timeZone":"Central Daylight","terminalAddress":"450 Falling Creek Rd. Spartanburg, SC. 29301","howManyRoutes":"30","additionalInformation":"{\"Driver Information\":{\"Minimum Required Experience for Drivers\":\"1-3 Years (At least 1-year verifiable commercial driving experience in large trucks.)\",\"Types of Routes\":\"15% Rural, 85% Suburban with residential and business\",\"Areas your CSA Covers\":\"Spartanburg, Boiling Springs, Inman, Campobello and Landrum, SC.\",\"Fixed Route or Floater ?\":\"Fixed\",\"Non-CDL Drivers needed\":\"10/Month\",\"L-10 Drivers needed\":\"\",\"Alternate Vehicle Drivers needed\":\"\",\"Additional Information\":\"**  No Female Drivers **. Drivers between 25-45 years to be chosen.\"},\"Driver Schedule\":{\"Start time for Driver\":\"08:00 AM\",\"Typical hours run each day\":\"7-8 Hours\",\"Typical Miles Driven each day\":\"40-75 Miles\",\"Work Schedules\":\"5 Days with a Weekend, Weekend Drivers\",\"Additional Information\":\"\"},\"Benefits\":{\"Pay Structure\":\"Flat daily Pay\",\"How much do you Pay your drivers ?\":\"Starting pay 140/day - 150/day depending on experience\",\"Training\":\"1 Week same pay\",\"Incentives\":\"\",\"Payday\":\"Friday\",\"Vacation/ Sick Time\":\"\",\"Other Benefits\":\"Health, Dental, Vision, Short/Long Term Disability and Life Insurance available\",\"Additional Information\":\"\"},\"Miscellaneous\":{\"Trucks(Can you describe your fleet in brief )\":\"P1000 Trucks or bigger trucks\",\"Additional Information(Please let us know if there is any other information that you would like to share.)\":\"\"},\"User Account\":{\"Plan Subscribed To\":\"FedEx P&D Full Service\",\"Time Zone\":\"US/Eastern\",\"Question Templates\":\"\"}}","createdAt":"2025-07-17T12:48:51.337Z","updatedAt":"2025-07-17T12:48:51.337Z","__v":0}
`;

// ✅ /api/call endpoint
app.post("/api/call", async (req, res) => {
  const { candidateName, phoneNumber, voiceId } = req.body;

  if (!candidateName || !phoneNumber || !voiceId) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: candidateName, phoneNumber, or voiceId"
    });
  }

  if (
    !process.env.VAPI_API_KEY ||
    !process.env.VAPI_PHONE_NUMBER_ID ||
    !process.env.SERVER_URL ||
    !process.env.RECRUITER_ASSISTANT_ID
  ) {
    return res.status(500).json({
      success: false,
      error: "Missing environment variables. Check .env"
    });
  }

  const selectedVoiceId = allowedVoiceIds.includes(voiceId) ? voiceId : "Rohan";

  const systemPrompt = `
You are RecruitAI, a professional, intelligent, and polite virtual recruiter calling on behalf of check client name from ${clientInfo}, a FedEx Ground contractor. You are screening candidates who applied for the check jon role from ${jobDescription} role.
Your job is to guide the candidate through a structured screening conversation. You must personalize the experience using the candidate’s resume, job details, and client information provided. Always ask one question at a time. 
 
---
 
CANDIDATE RESUME
 
${candidateCV}
 
Use this to:
Acknowledge info already present in the resume.
Personalize follow-up questions.
Avoid repeating what's clearly covered.
Detect inconsistencies, and clarify politely:
  > “Just to double-check — your resume says [X]. Has anything changed recently?”
 
If key details (name, city, employer) differ:
> “This resume shows [Name], based in [City], who worked at [Company]. Just confirming, is that you?”
 
If mismatch continues, mark candidate as unverifiable and end the call politely.
 
---
 
SCREENING FLOW
 
Follow this structured order — adapt to resume content naturally:
 
1. Greet the candidate → confirm name → ask if it's a good time to talk  
2. Confirm they applied for the **{{job_description.job_title}}** job  
3. Confirm whether they’re interested in the full-time version  
4. Ask about their driving experience (based on resume)  
5. Ask if they’ve worked for FedEx before  
   - If YES → get contractor name, FedEx ID, terminal, last day worked, reason for leaving  
6. Ask if they’re currently employed  
   - If YES → ask why they’re leaving  
   - If NO → ask how long and why the gap  
7. Ask if they have a DOT Medical Card  
   - If YES in resume → confirm it’s still valid  
   - If NO → inform contractor can assist with getting one  
8. Ask if they can pass a background check, drug test, and physical  
9. Confirm they are over 21  
   - If 50 or older → inform video interview will be required  
10. Ask if they have reliable daily transportation  
    - If NO → request address and mention commute is required  
11. Share terminal address from client info → ask how far it is from them  
12. Ask if they are familiar with the following areas: {{job_description.delivery_areas}}  
    - If NOT → inform that navigation/GPS is allowed  
13. Walk through the job overview (below)  
14. Ask if they’re comfortable with all duties and expectations  
15. Ask if they would like to move forward  
16. Explain next steps:
    - Video Interview (5 questions, 5–10 minutes)
    - Background Check (10 years address, 7 years employment)
    - Drug Test & Physical (complete within 5 business days)
    - Paperwork upload reminder
17. Ask when they can complete onboarding  
18. Ask when to follow up  
19. Thank them and end politely
 
---
 
 CLIENT INFORMATION
 
${clientInfo}
 
---
 
 JOB DESCRIPTION & SCREENING QUESTIONS
 
${jobDescription}
 
---

 
 AGENT BEHAVIOR GUIDELINES
 
 **Be natural and human** — like a helpful recruiter, not scripted or robotic  
 **Wait for the candidate’s reply patiently** — do not interrupt or stack questions  
 **Never hallucinate** — only refer to the resume, job description, or client info  
 **Ask one question at a time** — short and specific  
 **Avoid repeating** questions or info already covered in the resume  
 **Personalize follow-ups** based on what’s in the resume  
  - Resume says: “Worked at Amazon DSP” → Ask:  
    > “How was your experience delivering 120+ packages per day there?”  
 **Clarify gently** if something conflicts with the resume:
  > “Thanks for that — your resume says you worked at UPS until 2023. Has anything changed since then?”  
 **Verify identity** if resume and caller data don’t match:
  > “This resume shows James Carter from Spartanburg — is that you?”  
 **Do not repeat job details unless asked**  
 **Use provided job data** to answer any questions about duties, pay, benefits  
 **Be empathetic and supportive**:
  > “Totally fine — I’ll walk you through it.”  
 **Avoid made-up questions** — stay 100% aligned with the flow and data
---

Candidate Goes Off-Topic? Respond Politely:
If the candidate starts talking about unrelated topics (e.g., personal stories, politics, unrelated job offers), say:
> “I appreciate you sharing that, but I want to be respectful of your time and keep us focused on the job screening. Would you mind if we get back to the interview?”
Or:
> “That sounds important, but for this interview, I’m only able to ask questions related to the FedEx driver role. Can we continue?”
---

Email spelling and OTP verification are **disabled** — proceed directly to screening.`;

  try {
    // Update assistant prompt
    await axios.patch(
      `https://api.vapi.ai/assistant/${process.env.RECRUITER_ASSISTANT_ID}`,
      {
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
              content: systemPrompt.trim()
            }
          ]
        },
        firstMessage: `Hi`,
        firstMessageMode: "assistant-speaks-first",
        transcriber: {
          provider: "deepgram",
          language: "en"
        },
        server: {
          url: `${process.env.SERVER_URL}/vapi/call-end`
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_API_KEY}`
        }
      }
    );

    // Start the call
    const callRes = await axios.post(
      "https://api.vapi.ai/call",
      {
        customer: {
          number: phoneNumber,
          name: candidateName
        },
        assistantId: process.env.RECRUITER_ASSISTANT_ID,
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
      assistantId: process.env.RECRUITER_ASSISTANT_ID,
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

// ✅ Transcript webhook
const transcriptLog = [];
const loggedMessages = new Set();

app.post("/webhook/transcript", (req, res) => {
  const payload = req.body;

  const logLine = (speaker, text) => {
    const key = `${speaker}:${text}`;
    if (!loggedMessages.has(key)) {
      console.log(`[${speaker.toUpperCase()}]: ${text}`);
      transcriptLog.push(`[${speaker.toUpperCase()}]: ${text}`);
      loggedMessages.add(key);
    }
  };

  if (payload?.type === "transcript") {
    logLine(payload.speaker, payload.transcript);
  } else if (payload?.summary?.messages) {
    payload.summary.messages.forEach(msg => {
      if (!msg.message.includes("You are a professional and friendly AI recruiter")) {
        logLine(msg.role, msg.message);
      }
    });
  } else if (payload?.message?.type === "conversation-update") {
    payload.message.messages?.forEach(msg => {
      if (!msg.message.includes("You are a professional and friendly AI recruiter")) {
        logLine(msg.role, msg.message);
      }
    });
  }

  res.sendStatus(200);
});

// ✅ Transcript viewer
app.get("/transcript", (req, res) => {
  res.json({ transcript: transcriptLog });
});

app.post('/vapi/call-end', (req, res) => {
  const { body } = req;

  if (!body || typeof body !== 'object') {
    return res.status(400).send({ error: 'Missing or invalid body' });
  }

  const { type, endedReason } = body;

  if (type === 'end-of-call-report') {
    console.log(`✅ Call ended. Reason: ${endedReason}`);
    res.status(200).send({ status: 'received', endedReason });
  } else {
    res.status(400).send({ error: 'Not a valid end-of-call-report' });
  }
});


// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
