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
      <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.5;">
        <p>Dear <strong>${name}</strong>,</p>
        <p>For your security, please use the following One-Time Password (OTP) to proceed with your request:</p>
        <h2 style="color: #ff6600;">${otp}</h2>
        <p><strong>This OTP is valid for the next 5 minutes and can only be used once.</strong></p>
        <p>Please ensure you do not share this OTP with anyone. If you did not request this OTP, kindly disregard this email.</p>
        <br>
        <p>For any assistance, feel free to contact us at <strong>+91 1234567890</strong>.</p>
        <br>
        <p>Thank you for your cooperation.</p>
        <p>Best regards,</p>
        <p><strong>Team XYZ</strong></p>
        <p><a href="https://www.xyz.com">www.xyz.com</a></p>
      </div>
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
