// server.js

const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
require("dotenv").config();

let fetchFn;
if (typeof fetch === "function") {
  fetchFn = fetch;
} else {
  fetchFn = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
}

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Helper: Generate PDF from HTML using Puppeteer
async function generatePDFFromHTML(htmlContent) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--force-color-profile=srgb',
        '--disable-features=TranslateUI'
      ]
    });
    
    const page = await browser.newPage();
    
    // Force print media type BEFORE setting content
    await page.emulateMediaType('print');
    
    // Set content with print styles
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Add extra CSS to ensure print styles work
    await page.addStyleTag({
      content: `
        * { 
          -webkit-print-color-adjust: exact !important; 
          color-adjust: exact !important; 
        }
        body { 
          background: white !important; 
          color: black !important; 
        }
      `
    });
    
    // Generate PDF with print optimization
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '1in',
        bottom: '0.75in',
        left: '0.5in',
        right: '0.5in'
      },
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      scale: 0.8
    });
    
    return pdfBuffer;
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Helper: Extract only USER and AI lines from transcript
function extractUserAIConversation(text) {
  return text
    .split("\n")
    .filter(
      (line) =>
        line.trim().startsWith("USER:") || line.trim().startsWith("AI:")
    )
    .join("\n");
}

// Helper: Generate HTML report from JSON data
function generateHTMLReport(reportData, forPDF = false) {
  // Helper function to check if value should be displayed
  function shouldDisplay(value) {
    return value && 
           value !== 'Not mentioned in the transcript' && 
           value !== 'Not Applicable' &&
           value !== 'N/A' && 
           value.trim() !== '';
  }

  // Helper function to get display value
  function getDisplayValue(value, fallback = '') {
    return shouldDisplay(value) ? value : fallback;
  }

  // Helper function to get status class
  function getStatusClass(status) {
    switch(status) {
      case 'Pass':
        return 'status-pass';
      case 'Fail':
        return 'status-fail';
      case 'Conditional Pass':
        return 'status-conditional';
      case 'Not Applicable':
      case 'Not mentioned in the transcript':
        return 'status-na';
      default:
        return '';
    }
  }

  // Helper function to get fit display text
  function getFitDisplayText(fitRecommendation) {
    switch(fitRecommendation) {
      case 'GOOD':
        return 'Good Fit';
      case 'BAD':
        return 'Poor Fit';
      case 'INCOMPLETE':
        return 'Incomplete Assessment';
      default:
        return fitRecommendation || 'Unknown';
    }
  }

  // Generate job experience HTML
  let jobExperienceHTML = '';
  if (reportData.JOB_EXPERIENCE && reportData.JOB_EXPERIENCE.length > 0) {
    const validJobs = reportData.JOB_EXPERIENCE.filter(job => 
      shouldDisplay(job.job_title) && shouldDisplay(job.company)
    );
    
    if (validJobs.length > 0) {
      validJobs.forEach(job => {
        let durationText = '';
        if (shouldDisplay(job.duration.start_date) || shouldDisplay(job.duration.end_date)) {
          const startDate = getDisplayValue(job.duration.start_date, 'Unknown');
          const endDate = getDisplayValue(job.duration.end_date, 'Present');
          durationText = `<p><strong>Duration:</strong> ${startDate} - ${endDate}</p>`;
        }
        
        const roles = job.job_role && job.job_role.length > 0 ? 
          job.job_role.filter(role => shouldDisplay(role)) : [];
        const rolesText = roles.length > 0 ? 
          `<p><strong>Responsibilities:</strong> ${roles.join(', ')}</p>` : '';
        
        jobExperienceHTML += `
          <div class="inner_card">
            <h4>${job.job_title} - ${job.company}</h4>
            ${durationText}
            ${rolesText}
          </div>
        `;
      });
    } else {
      jobExperienceHTML = '<p>No job experience information available.</p>';
    }
  } else {
    jobExperienceHTML = '<p>No job experience information available.</p>';
  }

  // Generate key skills HTML
  let keySkillsHTML = '';
  if (reportData.KEY_SKILLS && reportData.KEY_SKILLS.length > 0) {
    const validSkills = reportData.KEY_SKILLS.filter(skill => shouldDisplay(skill));
    
    if (validSkills.length > 0) {
      validSkills.forEach(skill => {
        keySkillsHTML += `<div class="inner_card"><h4>${skill}</h4></div>`;
      });
    } else {
      keySkillsHTML = '<p>No key skills information available.</p>';
    }
  } else {
    keySkillsHTML = '<p>No key skills information available.</p>';
  }

  // Generate job matching table HTML
  let jobMatchingHTML = '';
  Object.entries(reportData.JOB_MATCHING).forEach(([key, matching]) => {
    // Skip if status is "Not mentioned in the transcript", "Not Applicable", or similar
    if (matching.status === 'Not mentioned in the transcript' || 
        matching.status === 'Not Applicable' ||
        !shouldDisplay(matching.status)) {
      return;
    }

    const statusClass = getStatusClass(matching.status);
    const notes = shouldDisplay(matching.notes) ? matching.notes : 'No additional notes';
    
    jobMatchingHTML += `
      <tr>
        <td>${matching.criteria}</td>
        <td class="${statusClass}">${matching.status}</td>
        <td>${notes}</td>
      </tr>
    `;
  });

  // Generate recommendations HTML
  let recommendationsHTML = '';
  if (reportData.CALL_ANALYSIS.recommendations && reportData.CALL_ANALYSIS.recommendations.length > 0) {
    const validRecommendations = reportData.CALL_ANALYSIS.recommendations.filter(rec => shouldDisplay(rec));
    
    if (validRecommendations.length > 0) {
      validRecommendations.forEach(recommendation => {
        recommendationsHTML += `<li>${recommendation}</li>`;
      });
    } else {
      recommendationsHTML = '<li>No specific recommendations available from the call analysis.</li>';
    }
  } else {
    recommendationsHTML = '<li>No specific recommendations available from the call analysis.</li>';
  }

  // Determine achievement card class
  const fitRecommendation = reportData.CONCLUSION.fit_recommendation;
  let achievementCardClass = 'achievement_card';
  if (fitRecommendation === 'BAD') {
    achievementCardClass += ' _bad';
  } else if (fitRecommendation === 'INCOMPLETE') {
    achievementCardClass += ' _incomplete';
  }

  // Define styles based on output type
  const styles = forPDF ? `
    @page {
      margin: 0;
    }

    body {
      font-family: Arial, sans-serif;
      background-color: #fff !important;
      color: #000 !important;
      margin: 0;
      padding: 1.3in 0.25in 0.25in;
      vertical-align: top;
      -webkit-print-color-adjust: exact;
      color-adjust: exact;
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
      background-color: #f8f8f8 !important;
      border-bottom: 2px solid #333;
      padding: 0.25in;
      box-sizing: border-box;
      z-index: 1000;
    }

    .header_text {
      color: #000 !important;
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
      border-top: 1px solid #ccc;
      padding: 0.125in;
      height: 0.25in;
      text-align: center;
      color: #666 !important;
      background: #fff !important;
      font-size: 0.75em;
      z-index: 1000;
    }

    .cover_page {
      color: #000 !important;
      padding-top: 0.5in;
      padding-bottom: 0.25in;
    }

    .cover_page table {
      color: #000 !important;
      font-size: 1.25em;
      border: 2px solid #333;
      border-radius: 1em;
      width: 100%;
      border-spacing: 0;
      overflow: hidden;
      background: #fff !important;
    }

    .cover_page table td {
      padding: 0.25in;
      border-bottom: 1px solid #ccc;
      color: #000 !important;
    }

    .cover_page table tr:last-child td {
      border-bottom: none;
    }

    .cover_page table td:first-child {
      border-right: 1px solid #ccc;
      font-weight: bold;
      background-color: #f5f5f5 !important;
      color: #333 !important;
    }

    .content_page {
      padding-top: 0.25in;
      padding-bottom: 0.25in;
    }

    .page_heading {
      color: #333 !important;
      font-size: 1.25em;
      margin: 0 0 0.5em;
      padding: 0.125in;
      background-color: #f8f8f8 !important;
      border-radius: 0.5em;
      border-left: 4px solid #333;
    }

    .card {
      border: 1px solid #ddd;
      border-radius: 0.5em;
      padding: 0.125in;
      vertical-align: top;
      margin-bottom: 1em;
      background: #fafafa !important;
    }

    .card h3 {
      color: #333 !important;
      font-size: 1em;
      margin: 0 0 0.5em;
      padding: 0;
    }

    .card p {
      color: #444 !important;
      font-size: 0.825em;
      line-height: 1.5;
      margin: 0 0 0.5em;
      padding: 0;
    }

    .card p:last-child {
      margin-bottom: 0;
    }

    .achievement_card_container {
      padding-top: 50px;
      padding-bottom: 50px;
    }

    .achievement_card {
      width: 400px;
      max-width: 100%;
      margin: 0 auto;
      border: 5px solid #4CAF50;
      border-radius: 1.25em;
      position: relative;
      background-color: #f0f8f0 !important;
    }

    .achievement_card._bad {
      border-color: #f44336;
      background-color: #fff0f0 !important;
    }

    .achievement_card._incomplete {
      border-color: #ff9800;
      background-color: #fff8f0 !important;
    }

    .achievement_card ._icon {
      background-color: #fff !important;
      border: 5px solid #4CAF50;
      border-radius: 50%;
      width: 80px;
      height: 80px;
      margin: -42.5px auto 0;
      display: block;
      position: relative;
    }

    .achievement_card._bad ._icon {
      border-color: #f44336;
    }

    .achievement_card._incomplete ._icon {
      border-color: #ff9800;
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
      color: #666 !important;
      font-size: 0.875em;
      margin: 0 0 0.5em;
      padding: 0;
    }

    .achievement_card ._content ._text_2 {
      color: #000 !important;
      font-size: 1.5em;
      margin: 0 0 0.5em;
      padding: 0;
      font-weight: bold;
      text-transform: uppercase;
    }

    .achievement_card ._content ._text_3 {
      color: #666 !important;
      font-size: 1em;
      margin: 0 0 1em;
      padding: 0;
    }

    .achievement_card ._content ._text_4 {
      background-color: #f5f5f5 !important;
      color: #333 !important;
      padding: 0.5em;
      border-radius: 0.5em;
    }

    .achievement_card ._score_wrap {
      background-color: #f0f0f0 !important;
      color: #000 !important;
      padding: 1.25em;
      text-align: center;
      border-radius: 4em 4em 1.25em 1.25em;
    }

    .achievement_card ._score_wrap p:first-child {
      font-size: 0.875em;
      margin: 0 0 0.5em;
      padding: 0;
      color: #666 !important;
    }

    .achievement_card ._score_wrap p:last-child {
      font-size: 2em;
      margin: 0;
      padding: 0;
      font-weight: bold;
      color: #333 !important;
    }

    ._job_matching_table {
      max-width: 100%;
      margin: 0 auto;
      border-collapse: collapse;
      border: 1px solid #ccc;
      border-radius: 0.5em;
      overflow: hidden;
    }

    ._job_matching_table thead {
      background-color: #f5f5f5 !important;
      color: #333 !important;
    }

    ._job_matching_table thead th {
      padding: 0.5em;
      border-bottom: 1px solid #ccc;
      border-right: 1px solid #ccc;
      text-align: left;
      color: #333 !important;
    }

    ._job_matching_table thead th:last-child {
      border-right: none;
    }

    ._job_matching_table tbody tr td {
      padding: 0.5em;
      color: #000 !important;
      border-bottom: 1px solid #ccc;
      border-right: 1px solid #ccc;
    }

    ._job_matching_table tbody tr:last-child td {
      border-bottom: none;
    }

    ._job_matching_table tbody tr td:first-child {
      background-color: #f8f8f8 !important;
    }

    ._job_matching_table tbody tr td:last-child {
      border-right: none;
      text-align: center;
      text-transform: uppercase;
      font-weight: bold;
      font-size: 0.875em;
    }

    .status-pass {
      color: #2e7d32 !important;
      font-weight: bold;
    }

    .status-fail {
      color: #c62828 !important;
      font-weight: bold;
    }

    .status-conditional {
      color: #ef6c00 !important;
      font-weight: bold;
    }

    .status-na {
      color: #616161 !important;
    }

    .inner_card {
      padding: 0.125in;
      background-color: #f8f8f8 !important;
      border: 1px solid #ddd;
      border-radius: 0.25em;
      margin-right: 0.5em;
      margin-bottom: 0.5em;
      display: inline-block;
      vertical-align: top;
      min-width: 200px;
    }

    .inner_card h4 {
      color: #333 !important;
      font-size: 0.875em;
      margin: 0 0 0.25em;
      padding: 0;
    }

    .inner_card p {
      color: #555 !important;
      font-size: 0.75em;
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
      font-size: 0.875em;
      line-height: 1.4;
      color: #000 !important;
    }

    .styled_list li:before {
      content: "\\2022";
      color: #333 !important;
      font-size: 1.5em;
      position: absolute;
      left: 0;
      top: 0;
      line-height: 1;
    }

    .card_heading_1 {
      background-color: #f0f0f0 !important;
      padding: 0.125in;
      border-radius: 0.5em;
      color: #333 !important;
      font-size: 1.125em;
      margin: 0 0 0.5em;
    }
  ` : `
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
      z-index: 1000;
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
      z-index: 1000;
    }

    .cover_page {
      color: #fff;
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
      margin-bottom: 1em;
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

    .achievement_card._bad {
      border-color: #ff6b6b;
      background-color: rgba(255, 107, 107, 0.125);
    }

    .achievement_card._incomplete {
      border-color: #ffa726;
      background-color: rgba(255, 167, 38, 0.125);
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

    .achievement_card._bad ._icon {
      border-color: #ff6b6b;
    }

    .achievement_card._incomplete ._icon {
      border-color: #ffa726;
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

    ._job_matching_table {
      max-width: 100%;
      margin: 0 auto;
      border-collapse: collapse;
      border: 1px solid #444;
      border-radius: 0.5em;
      overflow: hidden;
    }

    ._job_matching_table thead {
      background-color: #2f2f2f;
      color: #aaa;
    }

    ._job_matching_table thead th {
      padding: 0.5em;
      border-bottom: 1px solid #444;
      border-right: 1px solid #444;
      text-align: left;
    }

    ._job_matching_table thead th:last-child {
      border-right: none;
    }

    ._job_matching_table tbody tr td {
      padding: 0.5em;
      color: #fff;
      border-bottom: 1px solid #444;
      border-right: 1px solid #444;
    }

    ._job_matching_table tbody tr:last-child td {
      border-bottom: none;
    }

    ._job_matching_table tbody tr td:first-child {
      background-color: #2f2f2f;
    }

    ._job_matching_table tbody tr td:last-child {
      border-right: none;
      text-align: center;
      text-transform: uppercase;
      font-weight: bold;
      font-size: 0.875em;
    }

    .status-pass {
      color: #4CAF50;
    }

    .status-fail {
      color: #f44336;
    }

    .status-conditional {
      color: #ff9800;
    }

    .status-na {
      color: #9e9e9e;
    }

    .inner_card {
      padding: 0.125in;
      border-right: 1px solid #444;
      background-color: rgba(255, 255, 255, 0.05);
      border-radius: 0.25em;
      margin-right: 0.5em;
      margin-bottom: 0.5em;
      display: inline-block;
      vertical-align: top;
      min-width: 200px;
    }

    .inner_card h4 {
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.875em;
      margin: 0 0 0.25em;
      padding: 0;
    }

    .inner_card p {
      color: rgba(255, 255, 255, 0.875);
      font-size: 0.75em;
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
      font-size: 0.875em;
      line-height: 1.4;
      color: #f2f2f2;
    }

    .styled_list li:before {
      content: "\\2022";
      color: #ffcc00;
      font-size: 1.5em;
      position: absolute;
      left: 0;
      top: 0;
      line-height: 1;
    }

    .card_heading_1 {
      background-color: #2f2f2f;
      padding: 0.125in;
      border-radius: 0.5em;
      color: #ffcc00;
      font-size: 1.125em;
      margin: 0 0 0.5em;
    }

    @media print {
      body {
        background: #fff !important;
        color: #000 !important;
        padding: 1in 0.5in 0.5in;
      }
      
      .header {
        position: fixed;
        top: 0;
        background: #fff !important;
        color: #000 !important;
        border-bottom: 2px solid #000;
      }
      
      .header_text {
        color: #000 !important;
      }
      
      .footer {
        position: fixed;
        bottom: 0;
        background: #fff !important;
        color: #666 !important;
        border-top: 1px solid #ccc;
      }
      
      .cover_page table {
        background: #fff !important;
        color: #000 !important;
        border: 2px solid #333 !important;
      }
      
      .cover_page table td {
        color: #000 !important;
        border-bottom: 1px solid #ccc !important;
      }
      
      .cover_page table td:first-child {
        background: #f5f5f5 !important;
        color: #333 !important;
        border-right: 1px solid #ccc !important;
      }
      
      .page_heading {
        background: #f8f8f8 !important;
        color: #333 !important;
        border-left: 4px solid #333 !important;
      }
      
      .card {
        background: #fafafa !important;
        color: #000 !important;
        border: 1px solid #ddd !important;
      }
      
      .card h3 {
        color: #333 !important;
      }
      
      .card p {
        color: #444 !important;
      }
      
      .achievement_card {
        background: #f0f8f0 !important;
        border-color: #4CAF50 !important;
      }
      
      .achievement_card._bad {
        background: #fff0f0 !important;
        border-color: #f44336 !important;
      }
      
      .achievement_card._incomplete {
        background: #fff8f0 !important;
        border-color: #ff9800 !important;
      }
      
      .achievement_card ._icon {
        background: #fff !important;
        border-color: inherit !important;
      }
      
      .achievement_card ._content ._text_1 {
        color: #666 !important;
      }
      
      .achievement_card ._content ._text_2 {
        color: #000 !important;
      }
      
      .achievement_card ._content ._text_3 {
        color: #666 !important;
      }
      
      .achievement_card ._content ._text_4 {
        background: #f5f5f5 !important;
        color: #333 !important;
      }
      
      .achievement_card ._score_wrap {
        background: #f0f0f0 !important;
        color: #000 !important;
      }
      
      .achievement_card ._score_wrap p:first-child {
        color: #666 !important;
      }
      
      .achievement_card ._score_wrap p:last-child {
        color: #333 !important;
      }
      
      ._job_matching_table {
        border: 1px solid #ccc !important;
      }
      
      ._job_matching_table thead {
        background: #f5f5f5 !important;
        color: #333 !important;
      }
      
      ._job_matching_table thead th {
        border-bottom: 1px solid #ccc !important;
        border-right: 1px solid #ccc !important;
        color: #333 !important;
      }
      
      ._job_matching_table tbody tr td {
        color: #000 !important;
        border-bottom: 1px solid #ccc !important;
        border-right: 1px solid #ccc !important;
      }
      
      ._job_matching_table tbody tr td:first-child {
        background: #f8f8f8 !important;
      }
      
      .inner_card {
        background: #f8f8f8 !important;
        border: 1px solid #ddd !important;
        color: #000 !important;
      }
      
      .inner_card h4 {
        color: #333 !important;
      }
      
      .inner_card p {
        color: #555 !important;
      }
      
      .styled_list li {
        color: #000 !important;
      }
      
      .styled_list li:before {
        color: #333 !important;
      }
      
      .card_heading_1 {
        background: #f0f0f0 !important;
        color: #333 !important;
      }
    }
  `;

  // Generate complete HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Call Summary Report</title>
    <style>
        ${styles}
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <table class="full_width">
            <tr>
                <td style="text-align: left;">
                    <h1 class="header_text">Call Summary Report</h1>
                </td>
                <td style="text-align: right;">
                    <h2>Truckerhire.Ai</h2>  
                </td>
            </tr>
        </table>
    </div>

    <!-- Footer -->
    <div class="footer">Copyright 2025 Truckerhire.Ai. All rights reserved.</div>

    <!-- Cover Page -->
    <div class="cover_page">
        <table>
            ${shouldDisplay(reportData.PERSONAL_DETAILS.organization_name) ? `
            <tr>
                <td>Organization Name</td>
                <td>${reportData.PERSONAL_DETAILS.organization_name}</td>
            </tr>` : ''}
            <tr>
                <td>Name</td>
                <td>${getDisplayValue(reportData.PERSONAL_DETAILS.name)}</td>
            </tr>
            <tr>
                <td>Assessment Date</td>
                <td>${getDisplayValue(reportData.PERSONAL_DETAILS.assessment_date)}</td>
            </tr>
            <tr>
                <td>Address</td>
                <td>${getDisplayValue(reportData.PERSONAL_DETAILS.address)}</td>
            </tr>
            ${shouldDisplay(reportData.PERSONAL_DETAILS.phone) ? `
            <tr>
                <td>Phone</td>
                <td>${reportData.PERSONAL_DETAILS.phone}</td>
            </tr>` : ''}
            ${shouldDisplay(reportData.PERSONAL_DETAILS.email) ? `
            <tr>
                <td>Email</td>
                <td>${reportData.PERSONAL_DETAILS.email}</td>
            </tr>` : ''}
        </table>
    </div>

    <!-- Assessment Result -->
    <div class="content_page">
        <h2 class="page_heading">Assessment Result</h2>
        <div class="achievement_card_container">
            <div class="${achievementCardClass}">
                <span class="_icon">
                    <img src="" alt="Achievement Icon" />
                </span>
                <div class="_content">
                    <p class="_text_1">OVERALL ASSESSMENT</p>
                    <h4 class="_text_2">${getFitDisplayText(reportData.CONCLUSION.fit_recommendation)}</h4>
                    <p class="_text_4">${getDisplayValue(reportData.CONCLUSION.overall_recommendation, 'N/A')}</p>
                </div>
                <div class="_score_wrap">
                    <p>Overall Score</p>
                    <p>${reportData.CONCLUSION.score || '0'}</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Executive Summary -->
    <div class="content_page">
        <h2 class="page_heading">Executive Summary</h2>
        <div class="card">
            <h3>Objective:</h3>
            <p>To evaluate the candidate's suitability and alignment with the role's requirements through comprehensive call analysis.</p>
        </div>

        <div class="card">
            <h3>Job Experience:</h3>
            <div>${jobExperienceHTML}</div>
        </div>

        <div class="card">
            <h3>Key Skills:</h3>
            <div>${keySkillsHTML}</div>
        </div>
    </div>

    <!-- Job Matching -->
    <div class="content_page">
        <h2 class="page_heading">Job Matching</h2>
        <table class="_job_matching_table">
            <thead>
                <tr>
                    <th style="width: 60%;">Criteria</th>
                    <th style="width: 15%;">Status</th>
                    <th style="width: 25%;">Notes</th>
                </tr>
            </thead>
            <tbody>
                ${jobMatchingHTML}
            </tbody>
        </table>
    </div>

    <!-- Call Analysis -->
    <div class="content_page">
        <h2 class="page_heading">Call Analysis</h2>

        <div class="card">
            <h3 class="card_heading_1">Call Summary</h3>
            <p>${getDisplayValue(reportData.CALL_ANALYSIS.call_summary, 'Call summary not available.')}</p>
        </div>

        <div class="card">
            <h3 class="card_heading_1">Recommendations</h3>
            <ul class="styled_list">
                ${recommendationsHTML}
            </ul>
        </div>

        <div class="card">
            <h3 class="card_heading_1">Reason for Assessment</h3>
            <p>${getDisplayValue(reportData.CALL_ANALYSIS.reason_for_fit, 'Assessment reasoning not available.')}</p>
        </div>
    </div>

    <script>
        // Auto-print when page loads (optional)
        // window.onload = function() {
        //     window.print();
        // }
    </script>
</body>
</html>`;
}

app.get("/api/call-report/:callId", async (req, res) => {
  const { callId } = req.params;
  const { format } = req.query; // Add query parameter to specify format

  // Validate callId format
  if (!callId || !/^[a-zA-Z0-9-_]+$/.test(callId)) {
    return res.status(400).json({ success: false, error: "Invalid call ID format" });
  }

  try {
    // 1. Fetch transcript from VAPI
    const response = await fetchFn(`https://api.vapi.ai/call/${callId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ success: false, error });
    }

    const data = await response.json();
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
        .filter((line) => line.trim() !== "")
        .slice(1)
        .join("\n");
    }

    // Extract only USER and AI lines
    transcript = extractUserAIConversation(transcript);

    console.log("===== FILTERED TRANSCRIPT TO SEND TO OPENAI =====");
    console.log(transcript);
    console.log("==================================================");
    console.log(`Transcript length: ${transcript.length} characters`);

    if (transcript.length > 12000) {
      return res.status(413).json({
        success: false,
        error: "Transcript too long to process safely",
      });
    }

    // 2. Send transcript to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `
# AI Interview Transcript Analysis Prompt

You are an AI assistant that analyzes interview transcripts and produces a structured candidate report in JSON format for TruckerHire.AI.
The JSON format must be exactly the same every time so it can be parsed into HTML/PDF without errors.
You must follow the extraction rules, evaluation logic, and fit classification below.
Use only information provided in the transcript.

## OUTPUT JSON FORMAT


{
  "PERSONAL_DETAILS": {
    "organization_name": "",
    "name": "",
    "phone": "",
    "email": "",
    "address": "",
    "assessment_date": "",
    "other_info": ""
  },
  "JOB_EXPERIENCE": [
    {
      "job_title": "",
      "company": "",
      "duration": {
        "start_date": "",
        "end_date": ""
      },
      "job_role": [
        ""
      ]
    }
  ],
  "KEY_SKILLS": [
    ""
  ],
  "JOB_MATCHING": {
    "age": {
      "criteria": "Age Requirements",
      "status": "",
      "notes": ""
    },
    "commute_time": {
      "criteria": "Commute Time",
      "status": "",
      "notes": ""
    },
    "background_check": {
      "criteria": "Felony / Misdemeanor",
      "status": "",
      "notes": ""
    },
    "drug_use": {
            "criteria": "Drug Use / Medications",
      "status": "",
      "notes": ""
    },
    "driving_experience": {
      "criteria": "Driving Experience (last 3 years)",
      "status": "",
      "notes": ""
    },
    "fedex_experience": {
      "criteria": "FedEx Experience",
      "status": "",
      "notes": ""
    },
    "employment_status_employed": {
      "criteria": "Employment Status (Employed)",
      "status": "",
      "notes": ""
    },
    "employment_status_unemployed": {
      "criteria": "Employment Status (Unemployed)",
      "status": "",
      "notes": ""
    },
    "transportation": {
      "criteria": "Transportation Availability",
      "status": "",
      "notes": ""
    },
    "relocating": {
      "criteria": "Relocating",
      "status": "",
      "notes": ""
    },
    "english_communication": {
      "criteria": "English Communication",
      "status": "",
      "notes": ""
    },
    "cdl_transition": {
      "criteria": "CDL to Non-CDL Transition",
      "status": "",
      "notes": ""
    },
    "license_class": {
      "criteria": "License Class Availability",
      "status": "",
      "notes": ""
    },
    "driving_job_understanding": {
      "criteria": "Understanding of Driving Job",
      "status": "",
      "notes": ""
    },
    "weekend_work": {
      "criteria": "Weekend Work Availability",
      "status": "",
      "notes": ""
    }
  },
  "CALL_ANALYSIS": {
    "call_summary": "",
    "recommendations": [
      ""
    ],
    "reason_for_fit": ""
  },
  "CONCLUSION": {
    "overall_recommendation": "",
    "reason": "",
    "fit_recommendation": "",
    "score": ""
  }
}
 

## EXTRACTION RULES

1. **Use only transcript content** — never infer beyond what is said
2. **Missing values:**
   - For name, phone, email, address → "Not mentioned in the transcript"
   - For fields that should remain empty when missing → leave as empty string ""
3. **Status values** in JOB_MATCHING must be exactly one of: "Pass", "Conditional Pass", "Fail", "Not Applicable"
4. **Notes field** must explain why the status was assigned, referring to transcript evidence
5. **fit_recommendation** must be "GOOD", "BAD", or "INCOMPLETE"
6. **assessment_date** should be current date in DD-MM-YYYY format
7. **Dates** must be exactly as mentioned in transcript
8. **Job roles** must be bullet points inside an array
9. **Call summary** should be 2-3 sentences providing an overall summary of the entire call conversation
10. **Recommendations** should be actionable items based on the transcript analysis in array format
11. **Reason for fit** should explain why the candidate is a good fit or bad fit based on the evaluation results

## JOB MATCHING EVALUATION LOGIC

Apply rules only if information is present in transcript:

### Age Requirements
- **Age ≥ 45** → Accepts physical demands → Pass; Hesitates/can't lift 150 lbs → Fail
- **Age > 60** → Fail  
- **Age < 45** → Pass

### Commute Time
- **≥ 40 min** → Willing/rural area → Conditional Pass; Else → Fail
- **< 40 min** → Pass

### Background Check
- **Felony/Misdemeanor** → Transparent disclosure → Conditional Pass; Hides info → Fail
- **Clean record** → Pass

### Drug Use/Medications
- **Any current usage** → Fail
- **No usage** → Pass

### Driving Experience
- **< 1 year in last 3 years** → Gig work/5-10 yrs history → Conditional Pass; None → Fail
- **≥ 1 year recent** → Pass

### FedEx Experience
- **< 1 month ago as driver** → Conditional Pass
- **Other experience or none** → Pass

### Employment Status
- **Currently Employed** → Valid reason for change → Pass; Vague issues → Conditional Pass
- **Unemployed < 1 month** → Pass
- **Unemployed 1+ months unclear** → Conditional Pass
- **Unemployed 6+ months** → Fail

### Transportation
- **< 5 min walk + punctual** → Pass
- **No reliable transport** → Conditional Pass

### Relocating
- **Recently moved or < 1 month timeline** → Conditional Pass
- **No definite move date** → Fail
- **Not relocating** → Pass

### English Communication
- **Cannot communicate effectively** → Conditional Pass
- **Good communication** → Pass

### CDL Transition
- **CDL to Non-CDL with reason** → Pass
- **CDL to Non-CDL no clear reason** → Conditional Pass

### License Class
- **Missing required class** → Will get before road test → Conditional Pass; Won't get → Fail
- **Has required class** → Pass

### Job Understanding
- **Understands driving job requirements** → Pass
- **Resists or misunderstands** → Fail

### Weekend Work
- **Accepts weekend work** → Pass
- **Hesitant but willing** → Conditional Pass
- **Unavailable for weekends** → Fail

## FIT CLASSIFICATION

- **GOOD** → All present criteria are "Pass" or "Conditional Pass"
- **BAD** → At least one present criterion has "Fail"  
- **INCOMPLETE** → Transcript is cut short, call rescheduled, or too incomplete to evaluate

## SCORING RULE

- **GOOD fit** → score = numeric score from evaluation (1-100)
- **BAD or INCOMPLETE fit** → score = "0"

## OUTPUT INSTRUCTIONS

When a transcript is provided:
1. Output **only** the JSON in the exact format above
2. **No extra commentary or text**
3. Follow the above rules **strictly**
4. Ensure all required fields are present
5. Use proper JSON formatting with correct quotes and commas
6. Be Consistent give same response content every time for the same input`,
        },
        { role: "user", content: `TRANSCRIPT:\n"""\n${transcript}\n"""` },
      ],
      temperature: 0.3,
    });

    const reportText = completion.choices?.[0]?.message?.content?.trim();
    if (!reportText) {
      return res
        .status(500)
        .json({ success: false, error: "No output from AI" });
    }

    // Parse JSON safely
    let parsedJson;
    try {
      parsedJson = JSON.parse(reportText);
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, error: "Invalid JSON returned by AI", raw: reportText });
    }

    // Check if PDF format is requested
    if (format === 'pdf') {
      const htmlReport = generateHTMLReport(parsedJson, true); // PDF mode
      const pdfBuffer = await generatePDFFromHTML(htmlReport);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="call-report-${callId}.pdf"`);
      return res.send(pdfBuffer);
    }

    // Check if HTML format is requested
    if (format === 'html') {
      const htmlReport = generateHTMLReport(parsedJson, false); // HTML mode
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="call-report-${callId}.html"`);
      return res.send(htmlReport);
    }

    // Return JSON by default
    res.json({ success: true, callId, report: parsedJson });
  } catch (error) {
    console.error("Error fetching transcript or generating summary:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      detail: error.message,
    });
  }
});

// New endpoint specifically for PDF download
app.get("/api/call-report/:callId/download", async (req, res) => {
  const { callId } = req.params;

  // Validate callId format
  if (!callId || !/^[a-zA-Z0-9-_]+$/.test(callId)) {
    return res.status(400).json({ success: false, error: "Invalid call ID format" });
  }

  try {
    // Get the JSON report first by making internal request
    const response = await fetchFn(`http://localhost:${PORT}/api/call-report/${callId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const jsonData = await response.json();

    if (!jsonData.success) {
      return res.status(500).json({ success: false, error: "Failed to generate report" });
    }

    // Generate HTML report for PDF
    const htmlReport = generateHTMLReport(jsonData.report, true); // PDF mode
    
    // Generate PDF from HTML
    const pdfBuffer = await generatePDFFromHTML(htmlReport);
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="call-report-${callId}-${new Date().toISOString().split('T')[0]}.pdf"`);
    
    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error("Error generating PDF report:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      detail: error.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});
 
// 404 handler - catch all undefined routes
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 JSON Reports: GET /api/call-report/:callId`);
  console.log(`📄 HTML Reports: GET /api/call-report/:callId?format=html`);
  console.log(`📑 PDF Reports: GET /api/call-report/:callId?format=pdf`);
  console.log(`⬇️  Download PDF: GET /api/call-report/:callId/download`);
  console.log(`❤️  Health Check: GET /health`);
});