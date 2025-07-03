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
        <h2>New Inquiry Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Number:</strong> ${number}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Requirements:</strong> ${requirements}</p>
      `,
    });

    return { success: true };
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return { success: false };
  }
};

module.exports = sendMail;
