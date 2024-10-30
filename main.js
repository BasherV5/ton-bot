const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const db = require('./database');
const { FieldValue } = require('firebase-admin/firestore');
const cron = require('node-cron');
require('dotenv').config();

// Create Express app
const app = express();
const port = 3000;

// Telegram bot setup
const token = process.env.BOT_TOKEN3;
const bot = new TelegramBot(token, { polling: true });

// Constants
const hashRateDurationDays = 30;

// Telegram bot logic
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name;
  const referrerId = msg.text.split(' ')[1]; 

  const userPhotos = await bot.getUserProfilePhotos(chatId);
  let profilePhotoUrl = null;

  if (userPhotos.total_count > 0) {
    const fileId = userPhotos.photos[0][0].file_id;
    const file = await bot.getFile(fileId);
    profilePhotoUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  }

  const userRef = db.collection('tonap').doc(chatId.toString());
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    const newUser = {
      referId: referrerId || null,
      referIdLevel2: null,
      referIdLevel3: null,
      profilePhotoUrl,
      level1User: [],
      level2User: [],
      level3User: [],
    };
    
    if (referrerId) {
      const referrerRef = db.collection('tonap').doc(referrerId);
      const referrerDoc = await referrerRef.get();

      if (referrerDoc.exists) {
        const referrerData = referrerDoc.data();
        newUser.referIdLevel2 = referrerData.referId || null;
        newUser.referIdLevel3 = referrerData.referIdLevel2 || null;

        let currentCounter = referrerData.counter || 0.0000001157;  
        const referralBonus = 0.00000000058;  
        const newCounterValue = currentCounter + referralBonus;

        const now = new Date();
        const expiryDate = new Date(now.setDate(now.getDate() + hashRateDurationDays));

        await referrerRef.update({
          tonapCoinBalance: FieldValue.increment(100),
          counter: parseFloat(newCounterValue.toFixed(10)),
          hashrateExpiryDate: expiryDate,
          invitedUsers: FieldValue.arrayUnion({ chatId }),
          level1User: FieldValue.arrayUnion(chatId),
        });

        if (newUser.referIdLevel2) {
          const level2Ref = db.collection('tonap').doc(newUser.referIdLevel2);
          await level2Ref.update({
            tonapCoinBalance: FieldValue.increment(50),
            counter: FieldValue.increment(0.000000000232),
            level2User: FieldValue.arrayUnion(chatId),
          });
        }

        if (newUser.referIdLevel3) {
          const level3Ref = db.collection('tonap').doc(newUser.referIdLevel3);
          await level3Ref.update({
            tonapCoinBalance: FieldValue.increment(25),
            counter: FieldValue.increment(0.000000000174),
            level3User: FieldValue.arrayUnion(chatId),
          });
        }
      }
    }
    
    await userRef.set(newUser);
  } else {
    if (!userDoc.data().referId && referrerId) {
      const referrerRef = db.collection('tonap').doc(referrerId);
      const referrerDoc = await referrerRef.get();
      const referrerData = referrerDoc.data();

      await userRef.update({
        referId: referrerId,
        referIdLevel2: referrerData.referId || null,
        referIdLevel3: referrerData.referIdLevel2 || null,
      });

      await referrerRef.update({
        level1User: FieldValue.arrayUnion(chatId),
      });

      if (referrerData.referId) {
        const level2Ref = db.collection('tonap').doc(referrerData.referId);
        await level2Ref.update({
          level2User: FieldValue.arrayUnion(chatId),
        });
      }

      if (referrerData.referIdLevel2) {
        const level3Ref = db.collection('tonap').doc(referrerData.referIdLevel2);
        await level3Ref.update({
          level3User: FieldValue.arrayUnion(chatId),
        });
      }
    }

    await userRef.update({ firstName: userName });
  }

  const referralLink = `https://t.me/MiningTonApp_bot?start=${chatId}`;
  const message = `Hello ${userName}! Welcome.

Your referral link is: 
<a href="${referralLink}">${referralLink}</a>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: 'Join Community 🧑‍💻', url: 'https://t.me/+ZbuZSPIGmbNlYmY8' }
      ],
      [
        { text: 'Start Mining', web_app: { url: 'https://ton-mining-6vsv.onrender.com/' } }
      ]
    ]
  };
  const photo = './assets/logo.png';

  bot.sendPhoto(chatId, fs.readFileSync(photo), {
    caption: message,
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
});

// Cron jobs
const incrementCounters = async () => {
  const usersRef = db.collection('tonap');
  const snapshot = await usersRef.get();
  
  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }

  const now = new Date();

  snapshot.forEach(async (doc) => {
    const data = doc.data();
    if (data.currentHashRate && (!data.hashrateExpiryDate || new Date(data.hashrateExpiryDate) > now)) {
      const incrementAmount = data.counter;
      const newCounter = (data.currentHashRate || 0) + incrementAmount;
      await doc.ref.update({ currentHashRate: parseFloat(newCounter.toFixed(9)) });
      console.log(`Updated currentHashRate for user ${doc.id}: ${newCounter.toFixed(9)}`);
    }
  });
  console.log('Counters updated for all users.');
};

cron.schedule('* * * * * *', () => {
  console.log('Running cron job every second to update counters');
  incrementCounters();
});

// Reset hash rate if expired
cron.schedule('0 0 * * *', async () => {
  const now = new Date();
  const usersSnapshot = await db.collection('tonap').get();

  usersSnapshot.forEach(async (userDoc) => {
    const userData = userDoc.data();
    if (userData.hashrateExpiryDate && new Date(userData.hashrateExpiryDate) <= now) {
      await db.collection('tonap').doc(userDoc.id).update({
        counter: 0.0000001157,  
        hashrateExpiryDate: null
      });
      console.log(`Hashrate reset for user ${userDoc.id}`);
    }
  });

  console.log('Daily cron job completed: Expired hash rates reset');
});

// Start Express server
app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`);
});
