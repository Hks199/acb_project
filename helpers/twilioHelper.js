const twilio = require('twilio');
const { CustomError } = require('../errors/CustomErrorHandler');
require('dotenv').config();

// Initialize Twilio client conditionally so the server doesn't crash if env variables are missing
let client;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const sendWhatsAppOTP = async (otp, mobileNumber) => {
    try {
        if (!client) {
            console.warn('Twilio client is not initialized. Please check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
            return;
        }

        if (!otp || !mobileNumber) {
            console.error('Missing required fields for sending WhatsApp OTP');
            return;
        }

        // Format the mobile number to E.164 format (+91 for India) if it doesn't start with a '+'
        let formattedNumber = mobileNumber.trim();
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = `+91${formattedNumber}`;
        }

        const message = `Your ArtAndCraftFromBharat verification code is ${otp}. It is valid for 5 minutes.`;

        await client.messages.create({
            body: message,
            // Use the provided Twilio WhatsApp number, or fallback to the generic sandbox number
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'}`,
            to: `whatsapp:${formattedNumber}`
        });

        console.log(`WhatsApp OTP sent successfully to ${formattedNumber}`);
    } catch (error) {
        // We log the error but do not throw it, ensuring the Gmail OTP and the overall registration flow are not disturbed.
        console.error(`Failed to send WhatsApp OTP to ${mobileNumber}:`, error.message);
    }
};

module.exports = {
    sendWhatsAppOTP
};
