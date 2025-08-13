const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");


 
 
const fetch = require('node-fetch');

 

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


// ✅ Allowed voice IDs
const allowedVoiceIds = [
  "Elliot", "Kylie", "Rohan", "Lily", "Savannah",
  "Hana", "Neha", "Cole", "Harry", "Paige", "Spencer"
];

// ✅ Static job description
const jobDescription = `
 **Status Code**: OK
- **Trace ID**: job_9cde3a88
- **Message**: Job description created successfully.
- **Message Type ID**: 1
- **Entity ID**: job_102938
- **Resource**: Job Description
- **Operation**: Create
- **Created At**: 2025-05-06T12:06:39.254Z
- **Updated At**: 2025-05-06T12:06:39.254Z
- **Next Action**: Score job profile
- **AI Trigger**:
  - Enabled: True
  - Trigger Type: Job Scoring
  - Pipeline: Driver-match-engine
- **Vendor Metadata**:
  - Vendor ID: vendor_ats_01
  - Source System: TruckingATS
- **Environment**: Production
- **Region**: US-Central;`

// ✅ Static backend CV
const candidateCV = `**Full Name:** Dorian Jackson
- **Location or ZIP Code:** Newport News, VA 23602
- **Contact Info:** dorianjacksonj68be_xjj@indeedemail.com; +1(757) 3299936
- **Work Experience:**
  - Pest Control Technician at Moxie, Newport News, VA (March 2025 to Present)
  - Cashier at Krispy Kreme, Newport, RI (August 2024 to Present)
  - Barista/Cashier at Captains Den, Newport News, VA (December 2023 to March 2024)
  - Child and Youth Program Assistant at Boys & Girls Clubs of America, Newport News, VA (March 2022 to August 2022)  
  - Dunkin Donuts Crew Member at Great Wolf Lodge, Williamsburg, VA (October 2021 to March 2022)
  - PCA Personal Care Assistant at Commonwealth Assisted Living, Hampton, VA (July 2020 to October 2020)
  - Team Member at Moe's Southwest Grill, Newport News, VA (January 2020 to July 2020)
  - Operations at Kohl's, Newport News, VA (September 2019 to December 2019)
  - Kennel Assistant at Mercury Animal Hospital, Hampton, VA (May 2019 to September 2019)
  - Arby’s Crew Member at Arby’s, Mechanicsville, VA (August 2018 to May 2019)
- **Skills:**
  - Hand tools, Cleaning Experience, Driving, Typing, Sales, Customer service
  - Organizational skills, Front desk, Moving, Phone etiquette, Heavy lifting
  - Data entry, Microsoft Excel, Guest relations, Word processing, Kennel Experience
  - Stocking, Childhood development, Cash register, PCA, Fire alarm, Shift management
  - Communication skills, Time management, Cash handling
- **Certifications and Licenses:**
  - PCA (July 2020 to Present)
  - Wise Certification (2015 to Present)
  - Driver's License
  - CPR Certification
- **Education:**
  - Operations at Kohl's, Newport News, VA (September 2019 to December 2019)
  - Kennel Assistant at Mercury Animal Hospital, Hampton, VA (May 2019 to September 2019)
  - Arby’s Crew Member at Arby’s, Mechanicsville, VA (August 2018 to May 2019)
- **Skills:**
  - Hand tools, Cleaning Experience, Driving, Typing, Sales, Customer service
  - Organizational skills, Front desk, Moving, Phone etiquette, Heavy lifting
  - Data entry, Microsoft Excel, Guest relations, Word processing, Kennel Experience
  - Stocking, Childhood development, Cash register, PCA, Fire alarm, Shift management
  - Communication skills, Time management, Cash handling
- **Certifications and Licenses:**
  - PCA (July 2020 to Present)
  - Wise Certification (2015 to Present)
  - Driver's License
  - CPR Certification
- **Education:**
  - Arby’s Crew Member at Arby’s, Mechanicsville, VA (August 2018 to May 2019)
- **Skills:**
  - Hand tools, Cleaning Experience, Driving, Typing, Sales, Customer service
  - Organizational skills, Front desk, Moving, Phone etiquette, Heavy lifting
  - Data entry, Microsoft Excel, Guest relations, Word processing, Kennel Experience
  - Stocking, Childhood development, Cash register, PCA, Fire alarm, Shift management
  - Communication skills, Time management, Cash handling
- **Certifications and Licenses:**
  - PCA (July 2020 to Present)
  - Wise Certification (2015 to Present)
  - Driver's License
  - CPR Certification
- **Education:**
  - Hand tools, Cleaning Experience, Driving, Typing, Sales, Customer service
  - Organizational skills, Front desk, Moving, Phone etiquette, Heavy lifting
  - Data entry, Microsoft Excel, Guest relations, Word processing, Kennel Experience
  - Stocking, Childhood development, Cash register, PCA, Fire alarm, Shift management
  - Communication skills, Time management, Cash handling
- **Certifications and Licenses:**
  - PCA (July 2020 to Present)
  - Wise Certification (2015 to Present)
  - Driver's License
  - CPR Certification
- **Education:**
  - Data entry, Microsoft Excel, Guest relations, Word processing, Kennel Experience
  - Stocking, Childhood development, Cash register, PCA, Fire alarm, Shift management
  - Communication skills, Time management, Cash handling
- **Certifications and Licenses:**
  - PCA (July 2020 to Present)
  - Wise Certification (2015 to Present)
  - Driver's License
  - CPR Certification
- **Education:**
  - PCA (July 2020 to Present)
  - Wise Certification (2015 to Present)
  - Driver's License
  - CPR Certification
- **Education:**
  - CPR Certification
- **Education:**
- **Education:**
  - GED from South Morrison
- **Current Role:** Pest Control Technician at Moxie, Newport News, VA
- **Availability:** Authorized to work in the US for any employer`

// ✅ Static client info
const clientInfo = `

- **Company Name**: Bossert Logistics Inc.
- **Location**: 450 Falling Creek Rd. Spartanburg, SC. 29301
- **Job Category**: FedEx P&D Full Service
- **Work Details**:
  - Minimum required experience for drivers: 1-3 years (at least 1-year verifiable commercial driving experience in large trucks).
  - Types of Routes: 15% Rural, 85% Suburban with residential and business.
  - Areas Covered: Spartanburg, Boiling Springs, Inman, Campobello, and Landrum, SC.
  - Route Type: Fixed
  - Drivers Required: Non-CDL Drivers needed - 10/month
  - Start Time for Driver: 08:00 AM
  - Typical Hours Run Each Day: 7-8 hours
  - Typical Miles Driven Each Day: 40-75 miles
  - Work Schedules: 5 Days with a Weekend, Weekend Drivers
- **Driver Requirements**:
  - Age Preference: Drivers between 25-45 years.
  - Gender Preference: No Female Drivers.
- **Pay and Benefits**:
  - Pay Structure: Flat daily pay (Starting pay $140/day - $150/day depending on experience)
  - Payday: Friday
  - Training: 1 week with same pay
  - Other Benefits: Health, Dental, Vision, Short/Long Term Disability, and Life Insurance available.
- **Fleet Information**: P1000 Trucks or bigger trucks.

`;
const candidateId=`688c9709002c355f066e1c86`;
const start_time=`2024-11-18T15:00:00.000Z`

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
Your job is to guide the candidate through a structured screening conversation. You must personalize the experience using the candidate's resume, job details, and client information provided. Always ask one question at a time. 
 
---
 
CANDIDATE RESUME
 
${candidateCV}
 
Use this to:
Acknowledge info already present in the resume.
Personalize follow-up questions.
Avoid repeating what's clearly covered.
Detect inconsistencies, and clarify politely:
  > "Just to double-check — your resume says [X]. Has anything changed recently?"
 
If key details (name, city, employer) differ:
> "This resume shows [Name], based in [City], who worked at [Company]. Just confirming, is that you?"
 
If mismatch continues, mark candidate as unverifiable and end the call politely.
 
---
 
SCREENING FLOW
 
Follow this structured order — adapt to resume content naturally:

1. Initial Contact
- Greet the candidate → confirm name → ask if it's a good time to talk
- **SCENARIO 11:** If candidate cannot communicate clearly in English, explain requirement and politely end screening

2. Job Interest Confirmation
- Confirm they applied for the {{job_description.job_title}} job
- Confirm whether they're interested in the full-time version

3. Commute Assessment
- You will get the commute distance in miles that the candidate needs to travel daily. Inform candidate terminal location from client info
- **SCENARIO 2:** If commute is greater than 60 miles:
  - Express concern about long commute after 8-9 hour workday
  - Check for closer terminal alternatives if present
  - Also check candidate is ready to relocate or not by asking it
  - If not inform the burden to candidate and continue with the flow
- If commute distance less than 60 miles **Transportation & Location**
  - Ask if they have reliable daily transportation
  - **SCENARIO 9:** If NO reliable transportation:
    - Explain importance for daily route assignments
    - Check if within 5 minutes walking distance of terminal
    - If not close enough still continue
  - **SCENARIO 10:** If candidate is relocating:
    - Cannot proceed until currently living in area
    - Ask timeline and continue with the flow

4. Age Verification
- Ask the year of birth from the candidate, if the candidate asks why, say about the workload in the job and confirm his age
- If he gives year of birth calculate the age using today's date and if age >40 go with scenario 1
- **SCENARIO 1:** If candidate is 40+ years old:
  - Emphasize physical demands (70% loading/unloading, 30% driving)
  - Mention 150-pound lifting requirement with only dolly provided
  - Discuss challenging locations (apartments without elevators)
  - Confirm willingness and add hiring decision disclaimer

5. Driving Experience Assessment
**Based on resume analysis:**
- Ask 1-2 short questions about specific driving roles from their resume
- Focus on timeline and type of driving (commercial, delivery, etc.)

**SCENARIO 5:** If lacking 1 year commercial driving in last 3 years:
- "Have you done any delivery work like DoorDash or Amazon?"
- If still insufficient: "Any driving experience in the last 10 years?"
- If no recent experience: "We'll note this and still consider you for the interview"

6. Previous FedEx Experience
- Ask if they've worked for FedEx before
- **SCENARIO 6:** If YES:
  - Get last working date
  - If within 1 month or currently employed: Collect contractor name, FedEx ID, terminal, escalate to basecamp
  - If 3+ months ago: Process as new candidate
  - Verify role (driver vs. package handler)
  - Confirm contractor type (FedEx Ground vs. Express)

7. Current Employment Status
**Only ask if unclear from resume:**
- "What's your current work situation?"
- If follow-up needed: "When did that position end?"

**SCENARIO 7:** If currently employed:
- "What's prompting the job search?"
**SCENARIO 8:** If unemployed:
- "How long since your last position?"
- Always add: "We'll consider all candidates for the interview"

8. DOT Medical Card Status
- Ask if they have a DOT Medical Card
- If YES in resume → confirm it's still valid
- If NO → inform contractor can assist with getting one
- **SCENARIO 14:** If candidate mentions medical conditions:
  - Explain DOT medical exam requirements
  - Ask about concerns regarding DOT medical certification

9. Background & Screening Requirements
- "Can you pass a background check and drug test?"
- If concerns: "We'll note this and still move forward with the interview"

**SCENARIO 3:** If criminal history mentioned:
- "Thanks for being honest"
- "We'll still consider you for the interview"

**SCENARIO 4:** If drug use mentioned:
- "The drug test needs to be clean"
- "We'll note this and continue with the process"

**SCENARIO 13:** If failed previous drug test mentioned:
- Explain SAP (Substance Abuse Program) that he needs to give after prescreening and proceed with normal flow

10. Delivery Area Familiarity
- Ask if they are familiar with the following areas: {{job_description.delivery_areas}}
- If NOT → inform that navigation/GPS is allowed

12. License Requirements
- **SCENARIO 16:** Check state-specific requirements:
  - Verify current driver's license meets position requirements
  - Confirm any needed endorsements (Class C/E/F) before proceeding
- **SCENARIO 15:** If candidate has CDL license:
  - Ask motivation for considering non-CDL position
  - Understand reasoning to assess fit

13. Job Overview & Expectations
- Walk through the job overview
- **SCENARIO 17:** When explaining the role:
  - Clarify schedule: "Workday ends when all packages are delivered, not after set hours"
  - Emphasize physical aspect: "70% loading/unloading, 30% driving"

14. Accessibility Considerations (IF MENTIONED)
- **SCENARIO 12:** If candidate uses interpreter (deaf/hearing impaired):
  - Explain DOT medical examination requirements
  - Politely explain this would disqualify the application

15. Final Confirmation
- Ask if they're comfortable with all duties and expectations
- Ask if they would like to move forward

16. Next Steps Explanation
- Video Interview (5 questions, 5–10 minutes)
- Background Check (10 years address, 7 years employment)
- Drug Test & Physical (complete within 5 business days)
- Paperwork upload reminder

17. Scheduling & Follow-up
- Ask when they can complete onboarding
- Ask when to follow up
- Confirm follow up date

18. Call Conclusion
- Thank them and end politely
- End call by calling endCall tool

---

---

SPECIAL SCENARIO HANDLING

SCENARIO 1: CANDIDATE IS 40+ YEARS OLD
When candidate confirms they are 40 or older:
- Emphasize physical demands: "I want to make sure you understand this job is 70% loading and unloading heavy packages and only 30% driving. You'll need to lift up to 150 pounds regularly, and a dolly is the only equipment provided."
- Mention challenging locations: "You'll be delivering to apartments without elevators and various challenging locations."
- Confirm willingness: "Given these physical requirements, are you comfortable proceeding with this type of work?"
- Add disclaimer: "We want to ensure you have all the information to make an informed decision. The final hiring decisions are made by FedEx Ground and the contractors."

SCENARIO 2: CANDIDATE LIVES 50+ MINUTES FROM TERMINAL
When commute is 50+ minutes:
- Express concern: "That's quite a long commute - 50+ minutes each way after an 8-9 hour work day can be very challenging."
- Check alternatives: "Let me see if we have any terminals closer to your location that might be hiring."
- If no alternatives: Advise reconsidering due to daily commute burden.

SCENARIO 3: CANDIDATE HAS FELONY/MISDEMEANOR
When candidate mentions criminal history:
- Explain process: "I appreciate your honesty. Our background check goes back 10 years, so this will likely show up."
- Give choice: "You can choose to proceed with the background check if you'd like to take that chance, but I want you to understand it may affect your application."
- Confirm decision: "Would you still like to move forward knowing this information?"

SCENARIO 4: CANDIDATE USES DRUGS/MEDICATION
When candidate mentions drug use or certain medications:
- Be clear about policy: "I need to let you know that you'll undergo a drug test that must come back completely clean."
- No exceptions: "There are no exceptions, even with a medical marijuana card or prescription medications that might affect the test."
- If they confirm regular drug use: Mark as "Not Interested - Fail Background/Drug Test"

SCENARIO 5: INSUFFICIENT DRIVING EXPERIENCE
When candidate lacks 1 year commercial driving in last 3 years:
- Probe for gig work: "Have you done any delivery work like DoorDash, Uber, Lyft, Amazon delivery, or other driving jobs? These actually count as driving experience."
- If still insufficient: "Do you have 5 years of driving experience within the last 10 years?"
- If no driving experience in last 10 years: Politely reject the application.

SCENARIO 6: PREVIOUS FEDEX EXPERIENCE
When candidate worked for FedEx before:
- Get last working date: "When was your last day working with FedEx?"
- If within 1 month or currently employed: Collect details (contractor name, FedEx ID, terminal) and escalate to basecamp for verification.
- If 3+ months ago: Process as new candidate.
- Verify role: "Were you working as a driver or in another role like package handler?"
- Confirm contractor type: "Was this with FedEx Ground or FedEx Express?"
- Only FedEx Ground driver experience counts for expedited processing.

SCENARIO 7: CURRENTLY EMPLOYED - SEEKING CHANGE
When candidate is currently working:
- Probe reason for leaving: "What's prompting you to look for a new opportunity?"
- If management issues: "Can you tell me more about what happened? This helps me understand if this role might be a better fit."
- If not enough hours: "That's understandable - this role offers consistent full-time hours."
- If gig work instability: "Looking for something more stable makes sense - this is a steady, full-time position."

SCENARIO 8: CANDIDATE IS UNEMPLOYED
When candidate is not currently working:
- Ask duration: "How long have you been between jobs?"
- If more than 1 month: "What led to the gap in employment?"
- If unemployed over 1 year: Consider rejection unless compelling circumstances.

SCENARIO 9: NO RELIABLE TRANSPORTATION
When candidate lacks reliable transportation:
- Explain importance: "Reliable transportation is crucial because you need to be on time every day for route assignments."
- Check proximity: "How far do you live from the terminal? If it's within 5 minutes walking distance, that might work."
- If not close enough: Explain this is likely a barrier to employment.

SCENARIO 10: CANDIDATE IS RELOCATING
When candidate is moving to the area:
- Cannot proceed immediately: "We need you to be currently living in the area to process your application."
- Ask timeline: "When are you planning to move?"
- Provide disclaimer: "I can schedule a follow-up after you've relocated, but I can't guarantee the contractor will still be actively hiring at that time."

SCENARIO 11: ENGLISH LANGUAGE BARRIERS
If candidate cannot communicate clearly in English:
- This is a requirement: "I need to be able to have a clear conversation with you, and you'll need to read delivery instructions and interact with customers in English."
- If language barrier is significant: Politely end the screening process.

SCENARIO 12: CANDIDATE USES INTERPRETER (DEAF/HEARING IMPAIRED)
When candidate uses an interpreter:
- Explain medical requirements: "I appreciate you letting me know. This position requires passing a DOT medical examination, and using an interpreter during work would not meet the medical certification requirements."
- Politely explain this would disqualify the application.

SCENARIO 13: FAILED PREVIOUS DRUG TEST
When candidate mentions failing a previous drug test:
- Explain requirements: "If you've failed a drug test for a DOT position before, you'll need to complete a SAP - Substance Abuse Program - before you can be eligible for this role."
- Ask if completed: "Have you already completed the SAP program?"

SCENARIO 14: MEDICAL CONDITIONS AFFECTING DOT CERTIFICATION
When candidate mentions medical conditions:
- Explain physical requirements: "The DOT medical exam is very thorough - it's a head-to-toe examination that reviews your complete medical history."
- Ask about concerns: "Do you have any medical conditions that might prevent you from getting DOT medical certification?"

SCENARIO 15: CANDIDATE HAS CDL LICENSE
When candidate mentions having a CDL:
- Ask about motivation: "I see you have a CDL license. What's prompting you to consider a non-CDL delivery position? This is more physically demanding work."
- Understand the reason to assess fit.

SCENARIO 16: LICENSE ENDORSEMENT REQUIREMENTS
Check state-specific requirements:
- Verify license type: "Does your current driver's license meet the requirements for this position?" (Check against state requirements for Class C/E/F endorsements)
- Confirm before proceeding if endorsements are needed.

SCENARIO 17: JOB COMPLETION EXPLANATION
When explaining the role:
- Clarify schedule: "Your workday ends when all your assigned packages are delivered, not after a set number of hours."
- Emphasize physical aspect: "Remember, this is 70% loading and unloading packages, 30% driving."

---

HUMAN ESCALATION REQUEST HANDLING  

Trigger Phrases:
- "Can I talk to a human?"
- "I want to speak with a recruiter"
- "Can I get a call back from a person"

Response:
"Sure, I can help with that. Could you please tell me a suitable time for the human recruiter to reach out to you?"

After Candidate Provides a Time:

1. If the candidate gives vague terms like "tomorrow" or "next week," calculate the date relative to the reference start time that is ${start_time}.

   Example:
   - Reference Time: ${start_time}
   - Candidate says: "Tomorrow at 2 PM"
   - Resolved Time: as per reference time

   Ask:
   "Just to confirm, you meant resolved time? Please also mention your time zone (like EST, PST, etc.) so I can schedule correctly."

2. Assume all candidates are from the United States and may use time zones such as:
   - EST → UTC -5
   - EDT → UTC -4
   - CST/CDT → UTC -6 / -5
   - MST/MDT → UTC -7 / -6
   - PST/PDT → UTC -8 / -7

3. Convert the candidate's confirmed time to ISO 8601 format in UTC.

4. Call the rescheduleCandidate tool once using:
   - candidateId = ${candidateId}
   - scheduledTime = [converted ISO UTC time]

5. Wait for the tool result:
   - IF rescheduleCandidate is successful:
       - Say: "Thank you. I've scheduled your call with our recruiter at your preferred time."
       - THEN call the endCall tool.
   - IF rescheduleCandidate fails (e.g., timeout or internal server error):
       - Say: "It looks like something went wrong while scheduling your call. I won't end the session just yet so a recruiter can take a look."
       - DO NOT call the endCall tool.

-------------------------------------

Rescheduling Request
Trigger Phrases:
- "Can I reschedule this?"
- "Not available right now"
- "I'd like to do this later"

Response:
"Sure, let me know a convenient time for you to reschedule the interview."

After the candidate provides a time:
- Say: "Great! Your interview has been rescheduled for given time. Thank you!". Wait for a reply from candidate
- Say Thank you our human recruiter will contact you and Call the endCall tool

----------------------------------------------------------------

KNOWLEDGE BASE FOR QUERIES

Use Uploaded Knowledge base by calling query_tool
to answer relevant Candidate Queries

---
 
CLIENT INFORMATION
 
${clientInfo}
 
---
 
JOB DESCRIPTION & SCREENING QUESTIONS
 
${jobDescription}
 
---

AGENT BEHAVIOR GUIDELINES
 
Be natural and human — like a helpful recruiter, not scripted or robotic  
Be Energetic and Enthusiastic and be spontaneous in giving responses
Wait for the candidate's reply patiently — do not interrupt or stack questions  
Never hallucinate — only refer to the resume, job description, or client info  
Ask one question at a time— short and specific  
Avoid repeating questions or info already covered in the resume  
Personalize follow-ups based on what's in the resume  
  - Resume says: "Worked at Amazon DSP" → Ask:  
    > "How was your experience delivering 120+ packages per day there?"  
Clarify gently if something conflicts with the resume:
  > "Thanks for that — your resume says you worked at UPS until 2023. Has anything changed since then?"  
Verify identity if resume and caller data don't match:
  > "This resume shows James Carter from Spartanburg — is that you?"  
Do not repeat job details unless asked 
Use provided job data to answer any questions about duties, pay, benefits  
Be empathetic and supportive:
  > "Totally fine — I'll walk you through it."  
Avoid made-up questions — stay 100% aligned with the flow and data
Handle rejections professionally — be polite and encouraging even when disqualifying candidates

---

Candidate Goes Off-Topic? Respond Politely:
If the candidate starts talking about unrelated topics (e.g., personal stories, politics, unrelated job offers), say:
> "I appreciate you sharing that, but I want to be respectful of your time and keep us focused on the job screening. Would you mind if we get back to the interview?"
Or:
> "That sounds important, but for this interview, I'm only able to ask questions related to the FedEx driver role. Can we continue?"

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
      ],
      tools: [
        {
          type: "apiRequest",
          name: "rescheduleCandidate",
          function: {
            name: "rescheduleCandidate",
            description: "Reschedules a candidate by sending candidateID and rescheduleTime to an external API"
          },
          url: "https://uat.api.truckerhire.ai/api/v1/candidate/request-human-call",
          method: "POST",
          body: {
            type: "object",
            properties: {
              candidateID: {
                type: "string",
                description: "The ID of the candidate"
              },
              rescheduleTime: {
                type: "string",
                description: "The new scheduled time"
              }
            },
            required: ["candidateID", "rescheduleTime"]
          }
        }
      ],
       toolIds: [
        "c731a173-b107-4521-af28-48561350c971",
        "2f3d15a8-4f7b-4b5a-a453-4fd5d0e4aafb"
         ]
    },
    firstMessage: `Hi`,
    firstMessageMode: "assistant-speaks-first",
    transcriber: {
      provider: "deepgram",
      language: "en"
    },
     server: {
        url: "https://recruiter-backend-pg5a.onrender.com/vapi/webhook"
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

//Incoming Call

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

app.post("/vapi/call-end", async (req, res) => {
  const body = req.body;

  console.log(" Incoming webhook body:", body);

  // if (!body || !body.message || body.message.type !== "end-of-call-report") {
  //   console.error(" Not a valid end-of-call-report");
  //   return res.status(400).json({ error: "Not a valid end-of-call-report" });
  // }

  const { endedReason, call, summary, transcript, messages } = body.message;

  console.log(" End-of-call report received:");
  console.log(" Call ID:", call?.id);
  console.log(" Reason:", endedReason);
  console.log("Summary:", summary);
  console.log(" Transcript:", transcript);

  // TODO: Add your follow-up logic here
  // await axios.post("https://your-other-api.com", { data: ... });

  return res.status(200).json({ status: "acknowledged" });
});

 

// Raw body handler with size limit
app.post('/vapi/webhook', async (req, res) => {
  try {
    // Read only the first part of the payload, up to ~200kb
    const raw = await getRawBody(req, { limit: '200kb', encoding: 'utf8' });

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('Invalid JSON received');
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const message = data?.message;
    if (message?.type === 'status-update') {
      console.log(`Call ${message.call.id}: ${message.status}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

 



app.get("/api/call-logs/:callId", async (req, res) => {
  const { callId } = req.params;

  try {
    const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ success: false, error });
    }

    const data = await response.json();
    const transcript = data.transcript || data.artifact?.transcript || "Transcript not available yet.";

    const prompt = `
You are an AI recruiter assistant analyzing a phone interview transcript.

OBJECTIVE
Analyze the transcript and classify the candidate into ONE of the following categories:
1. Screening Complete > Good Fit: Candidate passes all evaluation scenarios with no fails.
2. Screening Complete > Bad Fit: Candidate fails ANY scenario. One fail means they are a bad fit, regardless of other passes. List all failed criteria numbers and reasons.
3. New Candidate > Call Scheduled: Candidate asked to reschedule or time was not suitable.
4. New Candidate > Human Reschedule: Candidate requested to reschedule with a human recruiter specifically.
5. Screening Incomplete: Call was cut short or too little information to decide.

EVALUATION LOGIC
Evaluate against the following scenarios and conditions:

1. Age ≥ 45:
   - Accepts physical demands → Pass
   - Hesitates / Can't lift 150 lbs → Fail

2. Age > 60 → Fail

3. Commute ≥ 40 min:
   - Willing or rural → Conditional Pass
   - Else → Fail

4. Felony/Misdemeanor:
   - Transparent → Conditional Pass
   - Hides info → Fail

5. Drug Use / Meds:
   - Any usage → Fail

6. <1 year driving in last 3 years:
   - Gig work / 5–10 years history → Conditional Pass
   - None → Fail

7. FedEx Experience:
   - <1 month ago driver → Conditional Pass
   - Else → Pass

8. Employed:
   - Valid reason (low hours, stability) → Pass
   - Vague issues → Conditional Pass

9. Unemployed:
   - <1 month → Pass
   - >1 month unclear → Conditional Pass
   - >6 months → Fail

10. Transportation:
    - <5 min walk + punctual → Pass
    - No transport → Conditional Pass

11. Relocating:
    - Moved or <1 month → Conditional Pass
    - No move date → Fail

12. English:
    - Cannot communicate → Conditional Pass (Spanish accepted in some states)

13. Deaf/Dumb with interpreter → Fail

14. CDL → Non-CDL:
    - Has reason → Pass
    - No reason → Conditional Pass

15. License Class Missing:
    - Will get before road test → Conditional Pass

16. Driving Job Understanding:
    - Understands → Pass
    - Resists → Fail

17. Weekend Work Misunderstood:
    - Accepts → Pass
    - Resists → Conditional Pass
    - Unavailable → Fail

IMPORTANT RULES
- One Fail in ANY scenario → Overall result = "Screening Complete > Bad Fit".
- If no fails and at least one Conditional Pass → Still considered Good Fit unless it’s a fail condition.
- Only return "New Candidate > Call Scheduled" or "New Candidate > Human Reschedule" if transcript explicitly indicates rescheduling.
- If insufficient information for multiple key scenarios → "Screening Incomplete".
-If one bad fit condition is met, do not consider any other conditions.
- Must return same result for same transcript every time.

STRUCTURED OUTPUT FORMAT
Return exactly:
status: <one of: Screening Complete > Good Fit | Screening Complete > Bad Fit | New Candidate > Call Scheduled | New Candidate > Human Reschedule | Screening Incomplete>
reasons:
  - <short reason #1>
  - <short reason #2>
  - <short reason #3>
recommendation: <optional suggestion or comment for team>

TRANSCRIPT:
"""
${transcript}
"""
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4", // or "gpt-3.5-turbo"
      messages: [
        {
          role: "system",
          content: "You are a recruitment assistant bot that evaluates candidate screening calls based on strict rules."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4
    });

    const summary = completion.choices[0].message.content.trim();

    // Save and send
    const fileName = `call-evaluation-${callId}.txt`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, summary);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).json({ success: false, error: "Failed to send file" });
      } else {
        fs.unlinkSync(filePath);
      }
    });

  } catch (error) {
    console.error("Error fetching transcript or generating summary:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      detail: error.message
    });
  }
});

 
app.get("/api/call-report/:callId", async (req, res) => {
  const { callId } = req.params;

  try {
    // 1. Fetch transcript from VAPI
    const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ success: false, error });
    }

    const data = await response.json();
    const transcript =
      data.transcript ||
      data.artifact?.transcript ||
      data.call?.transcripts?.[0]?.text ||
      "Transcript not available yet.";

    // 2. Send transcript to OpenAI for evaluation
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `
You are an AI recruiter assistant.

Your task:
1. Read the given phone interview transcript.
2. Extract all relevant candidate details.
3. Apply the evaluation logic below to assess job matching.
4. Produce the candidate report in the EXACT HTML format and style given.

---

EVALUATION LOGIC
Evaluate against these rules:

1. Age ≥ 45:
   - Accepts physical demands → Pass
   - Hesitates / Can't lift 150 lbs → Fail
2. Age > 60 → Fail
3. Commute ≥ 40 min:
   - Willing or rural → Conditional Pass
   - Else → Fail
4. Felony/Misdemeanor:
   - Transparent → Conditional Pass
   - Hides info → Fail
5. Drug Use / Meds:
   - Any usage → Fail
6. <1 year driving in last 3 years:
   - Gig work / 5–10 years history → Conditional Pass
   - None → Fail
7. FedEx Experience:
   - <1 month ago driver → Conditional Pass
   - Else → Pass
8. Employed:
   - Valid reason (low hours, stability) → Pass
   - Vague issues → Conditional Pass
9. Unemployed:
   - <1 month → Pass
   - >1 month unclear → Conditional Pass
   - >6 months → Fail
10. Transportation:
    - <5 min walk + punctual → Pass
    - No transport → Conditional Pass
11. Relocating:
    - Moved or <1 month → Conditional Pass
    - No move date → Fail
12. English:
    - Cannot communicate → Conditional Pass (Spanish accepted in some states)
13. Deaf/Dumb with interpreter → Fail
14. CDL → Non-CDL:
    - Has reason → Pass
    - No reason → Conditional Pass
15. License Class Missing:
    - Will get before road test → Conditional Pass
16. Driving Job Understanding:
    - Understands → Pass
    - Resists → Fail
17. Weekend Work Misunderstood:
    - Accepts → Pass
    - Resists → Conditional Pass
    - Unavailable → Fail

---

REPORT RULES:
- Fill **only** with info from transcript. If a detail is missing, leave blank but keep field.
- Use .pass (green), .fail (red), .conditional (goldenrod) class for each evaluation.
- If Fail in ANY rule → candidate is marked as **bad fit** in conclusion.
- Use bullet points for Job Role (short, action-oriented).
- Do not remove or alter HTML/CSS structure.
- The HTML must be fully valid and self-contained.

---

HTML TEMPLATE TO FOLLOW EXACTLY (replace placeholders with extracted data):

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Job Application Summary</title>
  <style>
    ul { list-style: none; padding: 0; margin: 0; }
    ul li { padding: 5px 8px; margin-bottom: 4px; color: white; border-radius: 4px; font-family: Arial, sans-serif; font-size: 14px; }
    .pass { background-color: green; }
    .fail { background-color: red; }
    .conditional { background-color: goldenrod; }
  </style>
</head>
<body style="background-color: black; color: yellow; font-family: Arial, sans-serif; padding: 20px;">

  <!-- Personal Details -->
  <div style="display: flex; justify-content: space-between; border-bottom: 1px solid yellow; padding-bottom: 5px; margin-bottom: 10px;">
    <div>
      <strong>PERSONAL DETAILS</strong><br>
      Name: {{Name}}<br>
      Phone: {{Phone}}
    </div>
    <div>
      Address: {{Address}}<br>
      Email: {{Email}}
    </div>
  </div>

  <!-- Job Experience & Key Skills -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    
    <!-- Job Experience -->
    <div style="width: 60%;padding-right: 10px;">
      <strong>JOB EXPERIENCE</strong><br><br>
      {{JobExperienceList}}
    </div>

    <!-- Key Skills -->
    <div style="width: 35%; padding-left: 10px; border-left: 1px solid yellow;">
      <strong>KEY SKILLS:</strong><br>
      <ul>
        {{KeySkillsList}}
      </ul>

      <strong>JOB MATCHING:</strong><br>
      <ul style="list-style-type:none; padding-left: 0; margin-top: 5px;">
        {{JobMatchingList}}
      </ul>
    </div>
  </div>

  <!-- Conclusion -->
  <div style="border-top: 1px solid yellow; margin-top: 15px; padding-top: 10px;">
    <strong>Conclusion:</strong><br>
    {{Conclusion}}
  </div>

</body>
</html>

---

Output:
- Replace placeholders {{...}} with actual extracted details.
- For JobMatchingList: one <li> per evaluation point with correct class (.pass, .fail, .conditional) and exact format "X. Title – Value (Verdict)".
- Return ONLY the HTML, no explanations, no extra text.

---
`
        },
        { role: "user", content: `TRANSCRIPT:\n"""\n${transcript}\n"""` }
      ],
      temperature: 0.3
    });

    const reportText = completion.choices?.[0]?.message?.content?.trim();
    if (!reportText) {
      return res.status(500).json({ success: false, error: "No output from AI" });
    }

    // 3. Save to file and send download
    const fileName = `call-evaluation-${callId}.txt`;
    const filePath = path.join(__dirname, fileName);

    await fs.promises.writeFile(filePath, reportText);

    res.download(filePath, fileName, (err) => {
      fs.unlink(filePath, () => {}); // cleanup
      if (err) {
        console.error("Download error:", err);
        res.status(500).json({ success: false, error: "Failed to send file" });
      }
    });

  } catch (error) {
    console.error("Error fetching transcript or generating summary:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      detail: error.message
    });
  }
});


// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
