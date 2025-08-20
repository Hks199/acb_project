const nodemailer = require("nodemailer");
const { CustomError } = require("../errors/CustomErrorHandler"); // Import CustomError
require("dotenv").config();

// **Configure Nodemailer Transporter**
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


const sendEmail = async (email, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new CustomError("EmailSendError", `Failed to send email: ${error.message}`, 500);
  }
};


const sendOTP = async (otp, email, name) => {
  try {
    if (!otp || !email || !name) {
      throw new CustomError("InvalidInput", "Missing required fields for sending OTP", 400);
    }

    const subject = "Your OTP for Verification";
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Verification</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .email-container {
            max-width: 600px;
            width: 100%;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            overflow: hidden;
            position: relative;
          }
          
          .header {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 0%, #ff6348 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
            animation: float 6s ease-in-out infinite;
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          
          .header h1 {
            color: #ffffff;
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            position: relative;
            z-index: 1;
          }
          
          .header .subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 400;
            position: relative;
            z-index: 1;
          }
          
          .content {
            padding: 50px 40px;
            background: #ffffff;
          }
          
          .greeting {
            font-size: 20px;
            color: #2c3e50;
            margin-bottom: 25px;
            font-weight: 600;
          }
          
          .otp-section {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border: 2px solid #e9ecef;
            border-radius: 15px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
            position: relative;
            overflow: hidden;
          }
          
          .otp-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
            animation: shimmer 2s infinite;
          }
          
          @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
          }
          
          .otp-label {
            font-size: 18px;
            color: #6c757d;
            margin-bottom: 20px;
            font-weight: 500;
          }
          
          .otp-code {
            font-size: 48px;
            font-weight: 800;
            color: #e74c3c;
            letter-spacing: 8px;
            text-shadow: 0 4px 8px rgba(231, 76, 60, 0.3);
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: pulse 2s ease-in-out infinite;
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          
          .otp-info {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 10px;
            padding: 20px;
            margin: 25px 0;
            text-align: left;
          }
          
          .otp-info h3 {
            color: #856404;
            font-size: 16px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .otp-info p {
            color: #856404;
            font-size: 14px;
            line-height: 1.6;
            margin: 0;
          }
          
          .security-note {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            border-radius: 10px;
            padding: 20px;
            margin: 25px 0;
            text-align: left;
          }
          
          .security-note h3 {
            color: #0c5460;
            font-size: 16px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .security-note p {
            color: #0c5460;
            font-size: 14px;
            line-height: 1.6;
            margin: 0;
          }
          
          .contact-section {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 25px;
            margin: 25px 0;
            text-align: center;
          }
          
          .contact-section p {
            color: #495057;
            font-size: 16px;
            margin-bottom: 15px;
          }
          
          .contact-number {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 18px;
            display: inline-block;
            text-decoration: none;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            transition: all 0.3s ease;
          }
          
          .contact-number:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
          }
          
          .footer {
            background: #f8f9fa;
            padding: 30px 40px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }
          
          .footer p {
            color: #6c757d;
            font-size: 14px;
            margin-bottom: 8px;
          }
          
          .company-name {
            color: #495057;
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 15px;
          }
          
          .website-link {
            color: #007bff;
            text-decoration: none;
            font-weight: 500;
            padding: 8px 16px;
            border: 2px solid #007bff;
            border-radius: 20px;
            transition: all 0.3s ease;
            display: inline-block;
          }
          
          .website-link:hover {
            background: #007bff;
            color: white;
            transform: translateY(-2px);
          }
          
          .icon {
            font-size: 20px;
          }
          
          @media (max-width: 600px) {
            .email-container {
              margin: 10px;
              border-radius: 15px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .header h1 {
              font-size: 24px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .otp-code {
              font-size: 36px;
              letter-spacing: 6px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🔐 OTP Verification</h1>
            <p class="subtitle">Secure Access Code</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Dear <strong>${name}</strong>,
            </div>
            
            <p style="font-size: 16px; color: #495057; line-height: 1.6; margin-bottom: 20px;">
              For your security, please use the following One-Time Password (OTP) to proceed with your request:
            </p>
            
            <div class="otp-section">
              <div class="otp-label">Your Verification Code</div>
              <div class="otp-code">${otp}</div>
              <p style="color: #6c757d; font-size: 14px; margin: 0;">
                Enter this code to complete your verification
              </p>
            </div>
            
            <div class="otp-info">
              <h3>
                <span class="icon">⏰</span>
                Important Information
              </h3>
              <p>
                <strong>This OTP is valid for the next 5 minutes and can only be used once.</strong>
                Please complete your verification within this time frame.
              </p>
            </div>
            
            <div class="security-note">
              <h3>
                <span class="icon">🔒</span>
                Security Notice
              </h3>
              <p>
                Please ensure you do not share this OTP with anyone. If you did not request this OTP, 
                kindly disregard this email and contact our support team immediately.
              </p>
            </div>
            
            <div class="contact-section">
              <p>Need assistance? We're here to help!</p>
              <a href="tel:+919205400601" class="contact-number">
                📞 +91 9205400601
              </a>
            </div>
            
            <p style="font-size: 16px; color: #495057; line-height: 1.6; margin: 25px 0;">
              Thank you for your cooperation and for choosing our services.
            </p>
          </div>
          
          <div class="footer">
            <p>Best regards,</p>
            <div class="company-name">Team ArtAndCraftFromBharat</div>
            <a href="https://www.artandcraftfrombharat.com/" class="website-link">
              🌐 Visit Our Website
            </a>
            <p style="margin-top: 15px; font-size: 12px; color: #adb5bd;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(email, subject, htmlContent);
  } catch (error) {
    throw new CustomError("OTPSendError", `Failed to send OTP: ${error.message}`, 500);
  }
};

// **Export Functions**
module.exports = {
  sendOTP,
};
