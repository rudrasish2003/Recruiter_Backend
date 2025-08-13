import { ICandidate } from '@modules/candidate/model';
import { controller } from '@config/controller/controller';
import { StatusError } from '@config/statusError/statusError';
import { Request, Response } from 'express';
import axios from 'axios';
import { OpenAI } from 'openai';
import path from "path";
 
import wkhtmltopdf from "wkhtmltopdf";
 
import fs from "fs";
import url from "url"; // Needed for file URL
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Add Candidate
function extractUserAIConversation(text: any) {
    return text
        .split("\n")
        .filter(
            (line: any) =>
                line.trim().startsWith("USER:") || line.trim().startsWith("AI:")
        )
        .join("\n");
}
 
function extractStatus(text: string) {
    const match = text.match(/status:\s*(.+)/i);
    return match ? match[1].trim() : null;
}
 
function extractReasons(text: string) {
    const match = text.match(/reasons:\s*(.+)/i);
    return match ? match[1].trim() : null;
}
 
interface CallReportResult {
    pdfUrl: string;
    status: string;
    reasons: string;
}
 
 
export const generateCallReportUrl = async (data: any, candidateId: string) => {
    let transcript =
        data.transcript ||
        data.artifact?.transcript ||
        data.call?.transcripts?.[0]?.text ||
        "Transcript not available yet.";
 
    // Remove the first message
    if (Array.isArray(transcript)) {
        transcript = transcript
            .map((msg) => (typeof msg === "string" ? msg : msg.text || ""))
            .filter(Boolean)
            .slice(1)
            .join("\n");
    } else {
        transcript = transcript
            .split("\n")
            .filter((line: any) => line.trim() !== "")
            .slice(1)
            .join("\n");
    }
 
    transcript = extractUserAIConversation(transcript);
 
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
        One Fail in ANY scenario → Overall result = "Screening Complete > Bad Fit".
        If no fails and at least one Conditional Pass → Still considered Good Fit unless it’s a fail condition.
        Only return "New Candidate > Call Scheduled" or "New Candidate > Human Reschedule" if transcript explicitly indicates rescheduling.
        If insufficient information for multiple key scenarios → "Screening Incomplete".
        -If one bad fit condition is met, do not consider any other conditions.
        Must return same result for same transcript every time.
 
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
        `;
 
    // Extract only USER and AI lines
 
 
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
 
    const completionmessage = completion?.choices?.[0]?.message?.content?.trim() || "";
    let status = extractStatus(completionmessage);
    console.log("completionmessage status ", status);
    if (!status) {
        status = '';
    }
 
    let reasons = extractReasons(completionmessage);
    console.log("completionmessage reason ", status);
    if (!status) {
        reasons = '';
    }
 
    console.log("completionmessage", completionmessage);
 
 
 const htmlContent = `
<!DOCTYPE html>
<html lang="en">
    <html>
 
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
            <title>Data Maturity Assessment Report</title>
            <style>
                @page {
                    margin: 0;
                }
 
                body {
                    font-family: Arial, sans-serif;
                    background-color: #222;
                    color: #fff;
                    margin: 0;
                    padding: 1.3in 0.25in 0.25in;
                    vertical-align: top;
                }
 
                .w-100 {
                    width: 100%;
                }
 
                .full_width {
                    width: calc(100% - 0.5in);
                }
 
                .text-center {
                    text-align: center;
                }
 
                .text-left {
                    text-align: left !important;
                }
 
                .header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 0.75in;
                    background-color: rgba(0, 0, 0, 0.8);
                    padding: 0.25in;
                    box-sizing: border-box;
                }
 
                .header_text {
                    color: #fff;
                    margin: 0;
                    font-size: 1.25em;
                    font-weight: 700;
                    text-transform: uppercase;
                }
 
                .footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 0.125in;
                    height: 0.25in;
                    text-align: center;
                    color: #aaa;
                    font-size: 0.75em;
                }
 
                .cover_page {
                    color: #fff;
                    /* page-break-after: always; */
                    padding-top: 0.5in;
                    padding-bottom: 0.25in;
                }
 
                .cover_page table {
                    color: #fff;
                    font-size: 1.25em;
                    border: 2px solid rgba(255, 204, 0, 0.25);
                    border-radius: 1em;
                    width: 100%;
                    border-spacing: 0;
                    overflow: hidden;
                }
 
                .cover_page table td {
                    padding: 0.25in;
                    border-bottom: 2px solid rgba(255, 204, 0, 0.25);
                }
 
                .cover_page table tr:last-child td {
                    border-bottom: none;
                }
 
                .cover_page table td:first-child {
                    border-right: 2px solid rgba(255, 204, 0, 0.25);
                    font-weight: bold;
                    background-color: rgba(255, 204, 0, 0.025);
                    color: rgba(255, 204, 0, 1);
                }
 
                .content_page {
                    padding-top: 0.25in;
                    padding-bottom: 0.25in;
                    /* page-break-after: always; */
                }
 
                .qa_page {
                    position: relative;
                    padding: 0.25in 0 1in;
                }
 
                .page_heading {
                    color: rgba(255, 255, 255, 0.75);
                    font-size: 1.25em;
                    margin: 0 0 0.5em;
                    padding: 0.125in;
                    background-color: rgba(255, 255, 255, 0.05);
                    border-radius: 0.5em;
                }
 
                .card {
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 0.5em;
                    padding: 0.125in;
                    vertical-align: top;
                }
 
                .card h3 {
                    color: rgba(255, 255, 255, 0.75);
                    font-size: 1em;
                    margin: 0 0 0.5em;
                    padding: 0;
                }
 
                .card p {
                    color: rgba(255, 255, 255, 0.875);
                    font-size: 0.825em;
                    line-height: 1.5;
                    margin: 0 0 0.5em;
                    padding: 0;
                }
 
                .card p:last-child {
                    margin-bottom: 0;
                }
 
                .card table {
                    border-spacing: 0.125in;
                    border-radius: 0.5em;
                    overflow: hidden;
                    border: 1px solid #444;
                }
 
                .card table tr td.inner_card {
                    padding: 0.125in;
                    border-right: 1px solid #444;
                    background-color: rgba(255, 255, 255, 0.05);
                }
 
                .card table tr td.inner_card:last-child {
                    border-right: none;
                }
 
                .inner_card h4 {
                    color: rgba(255, 255, 255, 0.75);
                    font-size: 0.875em;
                    margin: 0 0 0.5em;
                    padding: 0;
                }
 
                .inner_card p {
                    color: rgba(255, 255, 255, 0.875);
                    font-size: 0.75em;
                    line-height: 1.5;
                    margin: 0;
                    padding: 0;
                }
 
                .achievement_card_container {
                    padding-top: 50px;
                    padding-bottom: 50px;
                }
 
                .achievement_card {
                    width: 400px;
                    max-width: 100%;
                    margin: 0 auto;
                    border: 5px solid #a4e89f;
                    border-radius: 1.25em;
                    position: relative;
                    background-color: rgba(164, 232, 159, 0.125);
                }
 
                .achievement_card ._icon {
                    background-color: #2f2f2f;
                    border: 5px solid #a4e89f;
                    border-radius: 50%;
                    width: 80px;
                    height: 80px;
                    margin: -42.5px auto 0;
                    display: block;
                    position: relative;
                }
 
                .achievement_card ._icon img {
                    width: 50px;
                    height: auto;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                }
 
                .achievement_card ._content {
                    padding: 1.25em;
                    text-align: center;
                }
 
                .achievement_card ._content ._text_1 {
                    color: #ffcc00;
                    font-size: 0.875em;
                    margin: 0 0 0.5em;
                    padding: 0;
                }
 
                .achievement_card ._content ._text_2 {
                    color: #fff;
                    font-size: 1.5em;
                    margin: 0 0 0.5em;
                    padding: 0;
                    font-weight: bold;
                    text-transform: uppercase;
                }
 
                .achievement_card ._content ._text_3 {
                    color: #b9b9b9;
                    font-size: 1em;
                    margin: 0 0 1em;
                    padding: 0;
                }
 
                .achievement_card ._content ._text_4 {
                    background-color: #ffcc0040;
                    color: rgba(255, 255, 255, 0.75);
                    padding: 0.5em;
                    border-radius: 0.5em;
                }
 
                .achievement_card ._score_wrap {
                    background-color: rgba(0, 0, 0, 0.25);
                    color: #fff;
                    padding: 1.25em;
                    text-align: center;
                    border-radius: 4em 4em 1.25em 1.25em;
                }
 
                .achievement_card ._score_wrap p:first-child {
                    font-size: 0.875em;
                    margin: 0 0 0.5em;
                    padding: 0;
                    color: #b9b9b9;
                }
 
                .achievement_card ._score_wrap p:last-child {
                    font-size: 2em;
                    margin: 0;
                    padding: 0;
                    font-weight: bold;
                    color: #ffcc00;
                }
 
                ._breakdown_table {
                    max-width: 500px;
                    margin: 0 auto;
                    border-collapse: collapse;
                    border: 1px solid #444;
                    border-radius: 0.5em;
                    overflow: hidden;
                }
 
                ._breakdown_table thead {
                    background-color: #2f2f2f;
                    color: #aaa;
                }
 
                ._breakdown_table thead th {
                    padding: 0.5em;
                    border-bottom: 1px solid #444;
                    border-right: 1px solid #444;
                }
 
                ._breakdown_table thead th:last-child {
                    border-right: none;
                }
 
                ._breakdown_table tbody tr td {
                    padding: 0.5em;
                    color: #fff;
                    border-bottom: 1px solid #444;
                    border-right: 1px solid #444;
                }
 
                ._breakdown_table tbody tr:last-child td {
                    border-bottom: none;
                }
 
                ._breakdown_table tbody tr td:first-child {
                    background-color: #2f2f2f;
                }
 
                ._breakdown_table tbody tr td:last-child {
                    border-right: none;
                    text-align: center;
                    text-transform: uppercase;
                    font-weight: bold;
                    font-size: 0.875em;
                }
 
                ._breakdown_table tbody tr td:nth-child(2) {
                    text-align: center;
                    color: #ffcc00
                }
 
                ._breakdown_table thead tr th:first-child {
                    text-align: left;
                }
 
                .executive_summary_page,
                .score_summary_page,
                .introduction_page {
                    page-break-after: always;
                }
 
                .card .card_heading_1 {
                    background-color: #2f2f2f;
                    padding: 0.125in;
                    border-radius: 0.5em;
                    color: #ffcc00;
                    font-size: 1.125em;
                    margin: 0 0 0.5em;
                }
 
                .card_heading_2 {
                    color: #fff0b3 !important;
                    font-size: 0.875em;
                    margin: 0 0 0.25em;
                    padding: 0;
                }
 
                .card_description {
                    color: #fff;
                    font-size: 0.875em;
                    line-height: 1.5;
                    margin: 0;
                    padding: 0;
                }
 
                .styled_list {
                    padding: 0;
                    margin: 0;
                }
 
                .styled_list li {
                    list-style: none;
                    padding-left: 1.5em;
                    position: relative;
                    margin-bottom: 0.5em;
                    font-size: 0.75em;
                    line-height: 1.4;
                    color: #f2f2f2;
                }
 
                .styled_list li:before {
                    content: "\2022";
                    color: #ffcc00;
                    font-size: 2em;
                    position: absolute;
                    left: 0;
                    top: 0;
                    /* top: -0.125em; */
                    line-height: 1;
                }
 
                .mb-1 {
                    margin-bottom: 0.25rem;
                }
 
                .mb-2 {
                    margin-bottom: 0.5rem;
                }
 
                .mb-3 {
                    margin-bottom: 0.75rem;
                }
 
                .mb-4 {
                    margin-bottom: 1rem;
                }
 
                .roadmap_page,
                .conclusion_page {
                    page-break-before: always;
                }
 
                .highlighted_card {
                    background-color: rgba(164, 232, 159, 0.25);
                    margin-top: 2rem;
                    padding: 0.25in;
                    border-radius: 0.5em;
                    border: 5px solid #a4e89f;
                }
 
                .highlighted_card h3 {
                    color: #fff;
                    font-size: 1.25em;
                    margin: 0 0 0.5em;
                    padding: 0;
                }
 
                .highlighted_card p {
                    color: #fff;
                    font-size: 1em;
                    line-height: 1.5;
                    margin: 0;
                    padding: 0;
                }
            </style>
        </head>
 
        <body>
            <!-- header start -->
            <div class="header">
                <table class="full_width">
                    <tr>
                        <td style="text-align: left;">
                            <h1 class="header_text">Call Summary Report</h1>
                        </td>
                        <td style="text-align: right;">
                        <h2>Truckerhire.Ai</h2>  
                        </tr>
                </table>
            </div>
            <!-- header end -->
 
            <!-- footer start -->
            <div class="footer">Copyright 2025 Truckerhire.Ai. All rights reserved.</div>
            <!-- footer end -->
 
            <!-- cover page start -->
          <div class="cover_page">
        <table>
            <tr>
                <td>Organization Name</td>
                <td>test</td>
            </tr>
            <tr>
                <td>Name</td>
                <td>saroj shaw</td>
            </tr>
            <tr>
                <td>Assessment Date</td>
                <td>17-02-2025</td>
            </tr>
            <tr>
                <td>Address</td>
                <td>123 Main Street, Kolkata, West Bengal</td>
            </tr>
            <tr>
                <td>Number</td>
                <td>+91 9876543210</td>
            </tr>
        </table>
    </div>
            <!-- cover page end -->
 
            <!-- score page start -->
            <div class="content_page score_summary_page">
                <h2 class="page_heading">Assessment Result</h2>
                <div class="achievement_card_container">
                    <div class="achievement_card">
                        <span class="_icon">
                            <img src="data:image/png;base64,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" />                        </span>
                        <div class="_content">
                            <p class="_text_1">OVERALL ASSESSMENT</p>
                            <h4 class="_text_2">Good Fit</h4>
                            <p class="_text_4">Candidate meets the requirements and is willing to relocate</p>
                        </div>
                        
                    </div>
                </div>
            </div>
            <!-- score page end -->
 
            <!-- executive summary page start -->
            <div class="content_page executive_summary_page">
                <h2 class="page_heading">Executive Summary</h2>
                <table class="w-100">
                    <tr>
                        <td>
                            <div class="card">
                                <h3>Objective:</h3>
                                <p>To evaluate the candidate’s suitability and alignment with the role’s requirements.</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                           <div class="card">
  <h3>Key Findings:</h3>
</div>
 
<div class="card">
  <h3>Job Experience:</h3>
  <table>
    <tr>
      <td class="inner_card">
        <h4>Software Engineer – ABC Corp</h4>
        
      </td>
      <td class="inner_card">
        <h4>Machine Learning Intern – XYZ Labs</h4>
        
      </td>
      <td class="inner_card">
        <h4>Backend Developer – Tech Solutions</h4>
         
      </td>
    </tr>
  </table>
</div>
 
<div class="card">
  <h3>Key Skills:</h3>
  <table>
    <tr>
      <td class="inner_card">
        <h4>Programming</h4>
        
      </td>
      <td class="inner_card">
        <h4>Web Development</h4>
     
      </td>
      <td class="inner_card">
        <h4>Machine Learning</h4>
         
      </td>
    </tr>
  </table>
</div>
 
            <!-- executive summary page end -->
 
            <!-- introduction page start -->
<div class="content_page job_matching_page">
    <h2 class="page_heading">Job Matching</h2>
 
    <table class="w-100 _job_matching_table" style="border-collapse: collapse; width: 100%; text-align: left;">
        <thead>
            <tr style="background-color: #f2f2f2;">
                <th style="width: 70%;color:#222;">Criteria</th>
                <th style="width: 30%;color:#222;">Result</th>
            </tr>
        </thead>
        <tbody>
            <tr><td>Age</td><td style="color: green;">Pass</td></tr>
            <tr><td>Commute Time</td><td style="color: red;">Fail</td></tr>
            <tr><td>Felony / Misdemeanor</td><td style="color: green;">Pass</td></tr>
            <tr><td>Drug Use / Medications</td><td style="color: green;">Pass</td></tr>
            <tr><td>Driving Experience (last 3 years)</td><td style="color: red;">Fail</td></tr>
            <tr><td>FedEx Experience</td><td style="color: green;">Pass</td></tr>
            <tr><td>Employment Status (Employed)</td><td style="color: red;">Fail</td></tr>
            <tr><td>Employment Status (Unemployed)</td><td style="color: green;">Pass</td></tr>
            <tr><td>Transportation Availability</td><td style="color: yellow;">Conditionl Pass</td></tr>
            <tr><td>Relocating</td><td style="color: red;">Fail</td></tr>
            <tr><td>English Communication</td><td style="color: green;">Pass</td></tr>
            <tr><td>CDL to Non-CDL Transition</td><td style="color: green;">Pass</td></tr>
            <tr><td>License Class Availability</td><td style="color: red;">Fail</td></tr>
            <tr><td>Understanding of Driving Job</td><td style="color: green;">Pass</td></tr>
            <tr><td>Weekend Work Availability</td><td style="color: red;">Fail</td></tr>
        </tbody>
    </table>
</div>
 
   <!-- introduction page end -->
 
            <!-- category wise breakdown page start -->
            <div class="content_page qa_page">
    <h2 class="page_heading">Call Analysis</h2>
 
    <!-- Call Summary -->
    <div class="card mb-3">
        <h3 class="card_heading_1">Call Summary</h3>
        <p class="card_description">
            This is a brief summary of the call, outlining the main discussion points, key findings, and any important decisions or actions taken during the conversation.
        </p>
    </div>
 
    <!-- Recommendations -->
    <div class="card mb-3">
        <h3 class="card_heading_1">Recommendations</h3>
        <ul class="styled_list">
            <li>Implement structured follow-up steps based on call outcomes.</li>
            <li>Address any identified issues with actionable plans.</li>
            <li>Enhance documentation for future reference and tracking.</li>
        </ul>
    </div>
 
    <!-- Reason for Assessment -->
    <div class="card mb-3">
        <h3 class="card_heading_1">Reason for Assessment</h3>
        <p class="card_description">
            The assessment was conducted to evaluate the quality of communication, adherence to process standards, and identification of opportunities for improvement in service delivery.
        </p>
    </div>
</div>
 
 
`;

 

 
     try {
         const outputDir = path.join(process.cwd(), "public", "static_file", "uploads", "transcript");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
 
        // 1️⃣ Save HTML locally first
        const htmlFileName = `${candidateId}-${Date.now()}.html`;
        const htmlFilePath = path.join(outputDir, htmlFileName);
        fs.writeFileSync(htmlFilePath, html, "utf8");
 
        // 2️⃣ Convert saved HTML → PDF
        const pdfFileName = `${candidateId}-${Date.now()}.pdf`;
        const pdfFilePath = path.join(outputDir, pdfFileName);
 
        await new Promise<void>((resolve, reject) => {
            wkhtmltopdf(html, { pageSize: "A4" })
                .pipe(fs.createWriteStream(pdfFilePath))
                .on("finish", resolve)
                .on("error", reject);
        });
 
        // 3️⃣ Return local file URL
        const publicPdfUrl = `https://uat.app.truckerhire.ai/candidate_report/${pdfFileName}`;
        const publicHtmlUrl = `https://uat.app.truckerhire.ai/candidate_report/${htmlFileName}`;
 
        return {
            htmlUrl: publicHtmlUrl,
            pdfUrl: publicPdfUrl,
            status,
            reasons
        };
 
    } catch (err) {
         return {
            htmlUrl: "publicHtmlUrl",
            pdfUrl: "publicPdfUrl",
            status,
            reasons
        };
        console.error("HTML→File→PDF pipeline failed:", err);
        //throw err;
    }
    
 
};