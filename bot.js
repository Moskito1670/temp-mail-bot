const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Replace this with your Telegram bot token
const BOT_TOKEN = '8185690111:AAGUKOGlJzzvleH9WS7yxaCltPcrEKr-_sI';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Store user email details (Persistent storage per user)
const userMailData = {};

// Function to generate a temporary email
const generateTemporaryEmail = async () => {
    try {
        const response = await axios.get(
            'https://www.1secmail.com/api/v1/?action=genRandomMailbox'
        );
        if (response.data && response.data.length > 0) {
            const email = response.data[0];
            const [login, domain] = email.split('@');
            return { email, login, domain };
        }
    } catch (error) {
        console.error('Error generating email:', error.message);
        return null;
    }
};

// Function to fetch inbox messages
const fetchInboxMessages = async (login, domain) => {
    try {
        const response = await axios.get(
            `https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching inbox:', error.message);
        return [];
    }
};

// Function to fetch a specific message
const fetchMessageById = async (login, domain, id) => {
    try {
        const response = await axios.get(
            `https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${id}`
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching message by ID:', error.message);
        return null;
    }
};

// Telegram Bot Commands
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `Hello ${msg.from.first_name}! 👋\nWelcome to the Temp-Mail Bot.\n\nCommands:\n1. /getmail - Generate a reusable temporary email.\n2. /getmessages - Check your inbox.\n3. /deletemail - Delete your temporary email.`
    );
});

bot.onText(/\/getmail/, async (msg) => {
    const chatId = msg.chat.id;

    // Check if the user already has an email
    if (userMailData[chatId]) {
        bot.sendMessage(
            chatId,
            `You already have a reusable email! 📨\n\n**Email**: ${userMailData[chatId].email}\n\nUse this email to receive messages. Check your inbox with /getmessages or delete it with /deletemail.`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    // Generate a new temporary email for the user
    const mailData = await generateTemporaryEmail();
    if (mailData) {
        userMailData[chatId] = mailData; // Save the email for the user
        bot.sendMessage(
            chatId,
            `Your reusable temporary email has been created! 📨\n\n**Email**: ${mailData.email}\n\nYou can now receive messages sent to this email address. Use /getmessages to check your inbox or /deletemail to delete this email.`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId, '❌ Failed to generate a temporary email. Please try again later.');
    }
});

bot.onText(/\/getmessages/, async (msg) => {
    const chatId = msg.chat.id;

    // Check if the user has created an email
    if (!userMailData[chatId]) {
        bot.sendMessage(chatId, '⚠️ You need to create a temporary email first. Use /getmail.');
        return;
    }

    const { login, domain } = userMailData[chatId];
    const messages = await fetchInboxMessages(login, domain);

    if (messages.length > 0) {
        // Fetch and display each message
        for (const message of messages) {
            const fullMessage = await fetchMessageById(login, domain, message.id);
            const emailDetails = `
📧 **From**: ${fullMessage.from}
📩 **To**: ${userMailData[chatId].email}
📜 **Subject**: ${fullMessage.subject}
📝 **Body**: ${fullMessage.textBody || 'No text content.'}

📅 **Date**: ${new Date(fullMessage.date).toLocaleString()}
            `;
            bot.sendMessage(chatId, emailDetails, { parse_mode: 'Markdown' });
        }
    } else {
        bot.sendMessage(chatId, '📭 No messages found in your inbox.');
    }
});

bot.onText(/\/deletemail/, (msg) => {
    const chatId = msg.chat.id;

    // Check if the user has an email to delete
    if (!userMailData[chatId]) {
        bot.sendMessage(chatId, '⚠️ You do not have a temporary email to delete. Use /getmail to create one.');
        return;
    }

    // Delete the user's email
    delete userMailData[chatId];
    bot.sendMessage(chatId, '✅ Your temporary email has been successfully deleted.');
});
