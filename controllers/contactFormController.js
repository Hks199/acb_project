const sendMail = require('../helpers/contactMailer');
const contactForm =  async (req, res) => {
    const { name, number, email, requirements } = req.body;
    const result = await sendMail(name, number, email, requirements);

    if (result.success) {
        return res.status(200).json({ success: true, message: "Email sent successfully." });
    } else {
        return res.status(500).json({ success: false, message: "Something went wrong, Please try again later!" });
    }
};

module.exports = contactForm;