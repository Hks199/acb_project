const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Create a test account or replace with real credentials.

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for port 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


const sendMail = async (name, number, email, requirements) => {
  try {
    const info = await transporter.sendMail({
      from: `"Inquiry Bot" <${process.env.EMAIL_ID}>`,
      to: "artandcraftfrombharat@gmail.com",
      subject: 'New Inquiry Received',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Inquiry Received</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f8f9fa;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            .header .icon {
              font-size: 48px;
              margin-bottom: 15px;
              display: block;
            }
            .content {
              padding: 40px 30px;
            }
            .info-grid {
              display: grid;
              gap: 20px;
              margin-bottom: 30px;
            }
            .info-item {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #667eea;
            }
            .info-label {
              font-weight: 600;
              color: #667eea;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            .info-value {
              font-size: 16px;
              color: #333;
              word-break: break-word;
            }
            .requirements-section {
              background-color: #e8f4fd;
              padding: 25px;
              border-radius: 8px;
              border: 1px solid #bee5eb;
            }
            .requirements-label {
              font-weight: 600;
              color: #0c5460;
              font-size: 16px;
              margin-bottom: 15px;
              display: block;
            }
            .requirements-text {
              color: #0c5460;
              font-size: 15px;
              line-height: 1.6;
              margin: 0;
            }
            .footer {
              background-color: #f8f9fa;
              padding: 20px 30px;
              text-align: center;
              color: #6c757d;
              font-size: 14px;
            }
            .timestamp {
              color: #adb5bd;
              font-size: 12px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <span class="icon">📧</span>
              <h1>New Inquiry Received</h1>
            </div>
            
            <div class="content">
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Customer Name</div>
                  <div class="info-value">${name}</div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">Contact Number</div>
                  <div class="info-value">${number}</div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">Email Address</div>
                  <div class="info-value">${email}</div>
                </div>
              </div>
              
              <div class="requirements-section">
                <span class="requirements-label">Customer Requirements</span>
                <p class="requirements-text">${requirements}</p>
              </div>
            </div>
            
            <div class="footer">
              <p>This inquiry was automatically generated from your website contact form.</p>
              <div class="timestamp">Received on ${new Date().toLocaleString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              })}</div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return { success: true };
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return { success: false };
  }
};

module.exports = sendMail;
